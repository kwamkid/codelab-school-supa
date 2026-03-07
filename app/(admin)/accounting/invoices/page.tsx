'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Printer, Receipt as ReceiptIcon, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { formatDate, formatCurrency } from '@/lib/utils';
import { SectionLoading } from '@/components/ui/loading';
import { useBranch } from '@/contexts/BranchContext';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Receipt, TaxInvoice, InvoiceCompany } from '@/types/models';
import { getReceipts } from '@/lib/services/receipts';
import { getTaxInvoices } from '@/lib/services/tax-invoices';
import { getInvoiceCompanies } from '@/lib/services/invoice-companies';
import ReceiptPrintDialog from '@/components/invoices/receipt-print-dialog';
import {
  DocumentData,
  generateDocumentHTML,
  openPrintWindow,
  formatAddress,
} from '@/components/invoices/document-template';

// Unified document type for display
interface DocumentItem {
  id: string;
  documentType: 'receipt' | 'tax-invoice' | 'tax-invoice-receipt';
  documentNumber: string;
  invoiceCompanyId: string;
  enrollmentId?: string;
  branchId: string;
  customerName: string;
  customerPhone?: string;
  totalAmount: number;
  paidAmount: number;
  status: string;
  issuedAt?: Date;
  createdAt: Date;
  receiptId?: string; // for tax invoices
  linkedCreditNotes?: { id: string; creditNoteNumber: string; refundType: string; refundAmount: number; status: string }[];
  linkedTaxInvoices?: { id: string; taxInvoiceNumber: string }[];
}

function receiptToDoc(r: Receipt): DocumentItem {
  return {
    id: r.id,
    documentType: 'receipt',
    documentNumber: r.receiptNumber,
    invoiceCompanyId: r.invoiceCompanyId,
    enrollmentId: r.enrollmentId,
    branchId: r.branchId,
    customerName: r.customerName,
    customerPhone: r.customerPhone,
    totalAmount: r.totalAmount,
    paidAmount: r.paidAmount,
    status: r.status,
    issuedAt: r.issuedAt,
    createdAt: r.createdAt,
    linkedTaxInvoices: r.linkedTaxInvoices,
    linkedCreditNotes: r.linkedCreditNotes,
  };
}

function taxInvoiceToDoc(t: TaxInvoice): DocumentItem {
  return {
    id: t.id,
    documentType: t.receiptId ? 'tax-invoice' : 'tax-invoice-receipt',
    documentNumber: t.taxInvoiceNumber,
    invoiceCompanyId: t.invoiceCompanyId,
    enrollmentId: t.enrollmentId,
    branchId: t.branchId,
    customerName: t.customerName,
    customerPhone: t.customerPhone,
    totalAmount: t.totalAmount,
    paidAmount: t.paidAmount,
    status: t.status,
    issuedAt: t.issuedAt,
    createdAt: t.createdAt,
    receiptId: t.receiptId,
    linkedCreditNotes: t.linkedCreditNotes,
  };
}

const PAGE_SIZE = 20;

const paymentMethodLabels: Record<string, string> = {
  cash: 'เงินสด',
  bank_transfer: 'โอนเงิน',
  promptpay: 'PromptPay',
  credit_card: 'บัตรเครดิต',
  online: 'ชำระออนไลน์',
  transfer: 'โอนเงิน',
  credit: 'บัตรเครดิต',
};

export default function InvoicesPage() {
  const router = useRouter();
  const { selectedBranchId } = useBranch();
  const [companies, setCompanies] = useState<InvoiceCompany[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<string>('');
  const [loadingCompanies, setLoadingCompanies] = useState(true);

  // Per-company lazy-loaded data stored in a Map
  const [invoiceCache, setInvoiceCache] = useState<Map<string, DocumentItem[]>>(new Map());
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<{ from: string; to: string } | undefined>();
  const [printInvoiceId, setPrintInvoiceId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkPrinting, setBulkPrinting] = useState(false);

  // Load companies on mount
  useEffect(() => {
    (async () => {
      setLoadingCompanies(true);
      try {
        const comp = await getInvoiceCompanies();
        setCompanies(comp);
        if (comp.length > 0) {
          setActiveCompanyId(comp[0].id);
        }
      } catch (error) {
        console.error('Error loading companies:', error);
      } finally {
        setLoadingCompanies(false);
      }
    })();
  }, []);

  const cacheKey = `${activeCompanyId}__${selectedBranchId || ''}`;

  // Lazy load invoices when tab changes or branch changes
  useEffect(() => {
    if (!activeCompanyId) return;
    if (invoiceCache.has(cacheKey)) return;

    let cancelled = false;
    setLoadingInvoices(true);
    Promise.all([
      getReceipts(selectedBranchId || undefined, activeCompanyId),
      getTaxInvoices(selectedBranchId || undefined, activeCompanyId),
    ])
      .then(([receipts, taxInvoices]) => {
        if (!cancelled) {
          const merged = [
            ...receipts.map(receiptToDoc),
            ...taxInvoices.map(taxInvoiceToDoc),
          ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
          setInvoiceCache((prev) => new Map(prev).set(cacheKey, merged));
        }
      })
      .catch((error) => console.error('Error loading documents:', error))
      .finally(() => { if (!cancelled) setLoadingInvoices(false); });

    return () => { cancelled = true; };
  }, [activeCompanyId, selectedBranchId, cacheKey]);

  // When switching tabs: reload if not cached, reset filters
  const handleTabChange = (companyId: string) => {
    setActiveCompanyId(companyId);
    setSearchQuery('');
    setDateRange(undefined);
    setCurrentPage(1);
    setSelectedIds(new Set());
  };

  // When branch changes: clear cache so tabs reload
  useEffect(() => {
    setInvoiceCache(new Map());
  }, [selectedBranchId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, dateRange]);

  const invoices = invoiceCache.get(cacheKey) || [];

  const filteredInvoices = invoices.filter((inv) => {
    if (dateRange) {
      const docDate = (inv.issuedAt || inv.createdAt).toString().slice(0, 10);
      if (docDate < dateRange.from || docDate > dateRange.to) return false;
    }
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      inv.documentNumber.toLowerCase().includes(q) ||
      inv.customerName.toLowerCase().includes(q) ||
      (inv.customerPhone && inv.customerPhone.includes(q))
    );
  });

  const totalPages = Math.ceil(filteredInvoices.length / PAGE_SIZE);
  const paginatedInvoices = filteredInvoices.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const allIds = filteredInvoices.map((inv) => inv.id);
    const allSelected = allIds.every((id) => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allIds));
    }
  };

  const handleBulkPrint = async () => {
    if (selectedIds.size === 0) return;
    setBulkPrinting(true);
    try {
      const res = await fetch('/api/admin/invoices/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      if (!res.ok) throw new Error('Failed to fetch invoices');
      const { results } = await res.json();

      const htmlParts: string[] = [];
      for (const result of results) {
        if (!result?.invoice || !result?.company) continue;
        const { invoice, company, branch } = result;

        const isVatRegistered = company.is_vat_registered;
        const docType = result.documentType || invoice.documentType || 'receipt';
        const isTaxInv = docType === 'tax-invoice' || docType === 'tax-invoice-receipt';
        const totalAmount = invoice.total_amount || 0;
        const vatAmount = invoice.vat_amount || 0;
        const priceBeforeVat = totalAmount - vatAmount;
        const showVat = isTaxInv || (isVatRegistered && vatAmount > 0);
        const remaining = totalAmount - (invoice.paid_amount || 0);
        const showBillingDetails = isTaxInv;

        let documentTitle: string;
        if (docType === 'tax-invoice') {
          documentTitle = 'ใบกำกับภาษี / Tax Invoice';
        } else if (docType === 'tax-invoice-receipt') {
          documentTitle = 'ใบกำกับภาษี/ใบเสร็จรับเงิน';
        } else {
          documentTitle = 'ใบเสร็จรับเงิน / Receipt';
        }

        const docData: DocumentData = {
          documentType: docType as any,
          documentTitle,
          company: {
            name: company.name || '-',
            address: company.address ? formatAddress(company.address) : undefined,
            taxId: company.tax_id || undefined,
            phone: company.phone || undefined,
            email: company.email || undefined,
            branchName: branch?.name || undefined,
          },
          documentNumber: invoice.invoice_number,
          documentDate: formatDate(invoice.issued_at || invoice.created_at, 'long'),
          customer: {
            name: invoice.customer_name,
            phone: invoice.customer_phone || undefined,
            email: invoice.customer_email || undefined,
          },
          billing: showBillingDetails ? {
            name: invoice.billing_name,
            address: invoice.billing_address ? formatAddress(invoice.billing_address) : undefined,
            taxId: invoice.billing_tax_id || undefined,
            branch: invoice.billing_company_branch || undefined,
          } : undefined,
          items: (invoice.items || []).map((item: any) => ({
            description: item.description || item.className,
            studentName: item.studentName,
            amount: item.amount,
          })),
          summary: {
            subtotal: invoice.subtotal,
            discount: invoice.discount_amount > 0 ? {
              label: `ส่วนลด / Discount${invoice.discount_type === 'percentage' ? ` (${invoice.discount_value}%)` : ''}`,
              amount: invoice.discount_amount,
            } : undefined,
            vatBreakdown: showVat ? { priceBeforeVat, vatAmount } : undefined,
            total: totalAmount,
            totalLabel: 'ยอดสุทธิ / Total',
          },
          payment: {
            method: paymentMethodLabels[invoice.payment_method] || invoice.payment_method || '-',
            paidAmount: invoice.paid_amount || 0,
            remaining: remaining > 0 ? remaining : undefined,
          },
          signatures: {
            left: { label: 'ผู้รับเงิน / Receiver' },
            right: { label: 'ผู้จ่ายเงิน / Payer' },
          },
        };

        htmlParts.push(generateDocumentHTML(docData));
      }

      if (htmlParts.length > 0) {
        openPrintWindow(`ใบเสร็จ (${htmlParts.length} ใบ)`, htmlParts.join(''));
      }
    } catch (error) {
      console.error('Error bulk printing:', error);
    } finally {
      setBulkPrinting(false);
    }
  };

  if (loadingCompanies) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">ใบเสร็จ</h1>
        <SectionLoading />
      </div>
    );
  }

  if (companies.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">ใบเสร็จ</h1>
        <div className="text-center py-12 text-gray-500">
          <ReceiptIcon className="h-10 w-10 mx-auto mb-3 text-gray-300" />
          <p className="text-base">ยังไม่มีบริษัทออกใบเสร็จ</p>
        </div>
      </div>
    );
  }

  const allSelected = filteredInvoices.length > 0 && filteredInvoices.every((inv) => selectedIds.has(inv.id));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">ใบเสร็จ</h1>
        <div className="flex items-center gap-3">
          {selectedIds.size > 0 && (
            <Button
              onClick={handleBulkPrint}
              disabled={bulkPrinting}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {bulkPrinting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Printer className="h-4 w-4 mr-2" />
              )}
              พิมพ์ {selectedIds.size} ใบ
            </Button>
          )}
          <span className="text-base text-gray-500">{filteredInvoices.length} รายการ</span>
        </div>
      </div>

      {/* Company Tabs */}
      {companies.length > 1 && (
        <div className="flex gap-1 mb-4 border-b">
          {companies.map((c) => (
            <button
              key={c.id}
              onClick={() => handleTabChange(c.id)}
              className={`px-4 py-2 text-base font-medium border-b-2 transition-colors ${
                activeCompanyId === c.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="ค้นหาเลขใบเสร็จ, ชื่อลูกค้า, เบอร์โทร..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <DateRangePicker
          value={dateRange}
          onChange={setDateRange}
          placeholder="ช่วงวันที่"
          className="w-[280px]"
        />
      </div>

      {loadingInvoices ? (
        <SectionLoading />
      ) : (
        <>
          <Card>
            <CardContent className="p-0">
              {filteredInvoices.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <ReceiptIcon className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                  <p className="text-base">ไม่พบใบเสร็จ</p>
                </div>
              ) : (
                <div className="divide-y">
                  {/* Header row with select all */}
                  <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 text-sm text-gray-500">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={toggleSelectAll}
                    />
                    <span>เลือกทั้งหมด ({filteredInvoices.length} ใบ)</span>
                  </div>
                  {paginatedInvoices.map((inv) => (
                    <div
                      key={inv.id}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <Checkbox
                        checked={selectedIds.has(inv.id)}
                        onCheckedChange={() => toggleSelect(inv.id)}
                      />
                      <div
                        className="flex items-center justify-between flex-1 min-w-0 cursor-pointer"
                        onClick={() => inv.enrollmentId && router.push(`/enrollments/${inv.enrollmentId}`)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-base text-gray-900">
                              {inv.documentNumber}
                            </span>
                            {inv.documentType === 'tax-invoice' || inv.documentType === 'tax-invoice-receipt' ? (
                              <Badge className="text-xs bg-blue-100 text-blue-700 hover:bg-blue-100">ใบกำกับภาษี</Badge>
                            ) : (
                              <Badge className="text-xs bg-green-100 text-green-700 hover:bg-green-100">ใบเสร็จ</Badge>
                            )}
                            {inv.documentType === 'tax-invoice' && inv.receiptId && (
                              <Badge variant="outline" className="text-xs text-blue-600 border-blue-300">ออกทีหลัง</Badge>
                            )}
                            {inv.status === 'void' && (
                              <Badge variant="secondary" className="text-xs">ยกเลิก</Badge>
                            )}
                            {inv.status !== 'void' && inv.paidAmount > 0 && inv.paidAmount < inv.totalAmount && (
                              <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">จ่ายบางส่วน</Badge>
                            )}
                            {inv.status !== 'void' && inv.paidAmount === 0 && inv.totalAmount > 0 && (
                              <Badge variant="outline" className="text-xs text-red-600 border-red-300">ยังไม่ชำระ</Badge>
                            )}
                            {inv.linkedCreditNotes && inv.linkedCreditNotes.some(cn => cn.status !== 'void') && (
                              <Badge variant="outline" className="text-xs text-red-600 border-red-300 bg-red-50">มี CN</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                            <span>{inv.customerName}</span>
                            {inv.customerPhone && <span>{inv.customerPhone}</span>}
                            <span>{formatDate(inv.issuedAt || inv.createdAt, 'short')}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="font-semibold text-base">{formatCurrency(inv.totalAmount)}</div>
                            {inv.paidAmount < inv.totalAmount && (
                              <div className="text-xs text-red-500">
                                ค้าง {formatCurrency(inv.totalAmount - inv.paidAmount)}
                              </div>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPrintInvoiceId(inv.id);
                            }}
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-sm text-gray-500">
                หน้า {currentPage} / {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {printInvoiceId && (
        <ReceiptPrintDialog
          open={!!printInvoiceId}
          onOpenChange={(open) => !open && setPrintInvoiceId(null)}
          invoiceId={printInvoiceId}
        />
      )}
    </div>
  );
}
