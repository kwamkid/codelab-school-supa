'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Printer, FileText, Loader2 } from 'lucide-react';
import { formatDate, formatCurrency } from '@/lib/utils';
import { SectionLoading } from '@/components/ui/loading';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { useBranch } from '@/contexts/BranchContext';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { TaxInvoice, InvoiceCompany } from '@/types/models';
import { getTaxInvoices } from '@/lib/services/tax-invoices';
import { getInvoiceCompanies } from '@/lib/services/invoice-companies';
import { useDocumentPrint } from '@/hooks/useDocumentPrint';
import PrintDialogs from '@/components/shared/print-dialogs';
import {
  DocumentData,
  generateDocumentHTML,
  openPrintWindow,
  formatAddress,
} from '@/components/invoices/document-template';

const DEFAULT_PAGE_SIZE = 20;

function getCurrentMonthRange(): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
  return { from: `${y}-${m}-01`, to: `${y}-${m}-${String(lastDay).padStart(2, '0')}` };
}

const paymentMethodLabels: Record<string, string> = {
  cash: 'เงินสด',
  bank_transfer: 'โอนเงิน',
  promptpay: 'PromptPay',
  credit_card: 'บัตรเครดิต',
  online: 'ชำระออนไลน์',
  transfer: 'โอนเงิน',
  credit: 'บัตรเครดิต',
};

export default function TaxInvoicesPage() {
  const router = useRouter();
  const { selectedBranchId } = useBranch();
  const print = useDocumentPrint();
  const [companies, setCompanies] = useState<InvoiceCompany[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<string>('');
  const [loadingCompanies, setLoadingCompanies] = useState(true);

  const [invoiceCache, setInvoiceCache] = useState<Map<string, TaxInvoice[]>>(new Map());
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<{ from: string; to: string } | undefined>(getCurrentMonthRange());
  const { currentPage, pageSize, handlePageChange, handlePageSizeChange, resetPagination } = usePagination(DEFAULT_PAGE_SIZE);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkPrinting, setBulkPrinting] = useState(false);

  useEffect(() => {
    (async () => {
      setLoadingCompanies(true);
      try {
        const comp = await getInvoiceCompanies();
        // Only show VAT-registered companies
        const vatCompanies = comp.filter(c => c.isVatRegistered);
        setCompanies(vatCompanies);
        if (vatCompanies.length > 0) {
          setActiveCompanyId(vatCompanies[0].id);
        }
      } catch (error) {
        console.error('Error loading companies:', error);
      } finally {
        setLoadingCompanies(false);
      }
    })();
  }, []);

  const cacheKey = `${activeCompanyId}__${selectedBranchId || ''}`;

  useEffect(() => {
    if (!activeCompanyId) return;
    if (invoiceCache.has(cacheKey)) return;

    let cancelled = false;
    setLoadingInvoices(true);
    getTaxInvoices(selectedBranchId || undefined, activeCompanyId)
      .then((data) => {
        if (!cancelled) {
          setInvoiceCache((prev) => new Map(prev).set(cacheKey, data));
        }
      })
      .catch((error) => console.error('Error loading tax invoices:', error))
      .finally(() => { if (!cancelled) setLoadingInvoices(false); });

    return () => { cancelled = true; };
  }, [activeCompanyId, selectedBranchId, cacheKey]);

  const handleTabChange = (companyId: string) => {
    setActiveCompanyId(companyId);
    setSearchQuery('');
    setDateRange(undefined);
    resetPagination();
    setSelectedIds(new Set());
  };

  useEffect(() => {
    setInvoiceCache(new Map());
  }, [selectedBranchId]);

  useEffect(() => {
    resetPagination();
  }, [searchQuery, dateRange, resetPagination]);

  const invoices = invoiceCache.get(cacheKey) || [];

  const filteredInvoices = invoices.filter((inv) => {
    if (dateRange) {
      const docDate = (inv.issuedAt || inv.createdAt).toString().slice(0, 10);
      if (docDate < dateRange.from || docDate > dateRange.to) return false;
    }
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      inv.taxInvoiceNumber.toLowerCase().includes(q) ||
      inv.customerName.toLowerCase().includes(q) ||
      (inv.customerPhone && inv.customerPhone.includes(q))
    );
  });

  const totalPages = Math.ceil(filteredInvoices.length / pageSize);
  const paginatedInvoices = filteredInvoices.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
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

        const docType = result.documentType || 'tax-invoice-receipt';
        const totalAmount = invoice.total_amount || 0;
        const vatAmount = invoice.vat_amount || 0;
        const priceBeforeVat = totalAmount - vatAmount;
        const remaining = totalAmount - (invoice.paid_amount || 0);

        const documentTitle = docType === 'tax-invoice'
          ? 'ใบกำกับภาษี / Tax Invoice'
          : 'ใบกำกับภาษี/ใบเสร็จรับเงิน';

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
          billing: {
            name: invoice.billing_name || invoice.customer_name,
            address: invoice.billing_address ? formatAddress(invoice.billing_address) : undefined,
            taxId: invoice.billing_tax_id || undefined,
            branch: invoice.billing_company_branch || undefined,
          },
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
            vatBreakdown: { priceBeforeVat, vatAmount },
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
        openPrintWindow(`ใบกำกับภาษี (${htmlParts.length} ใบ)`, htmlParts.join(''));
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
        <h1 className="text-2xl font-bold text-gray-900 mb-6">ใบกำกับภาษี</h1>
        <SectionLoading />
      </div>
    );
  }

  if (companies.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">ใบกำกับภาษี</h1>
        <div className="text-center py-12 text-gray-500">
          <FileText className="h-10 w-10 mx-auto mb-3 text-gray-300" />
          <p className="text-base">ไม่มีบริษัทจด VAT</p>
        </div>
      </div>
    );
  }

  const allSelected = filteredInvoices.length > 0 && filteredInvoices.every((inv) => selectedIds.has(inv.id));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">ใบกำกับภาษี</h1>
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

      {companies.length > 1 && (
        <div className="flex gap-1 mb-4 border-b">
          {companies.map((c) => (
            <button
              key={c.id}
              onClick={() => handleTabChange(c.id)}
              className={`px-4 py-2 text-base font-medium border-b-2 transition-colors ${
                activeCompanyId === c.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="ค้นหาเลขใบกำกับภาษี, ชื่อลูกค้า, เบอร์โทร..."
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
          {filteredInvoices.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <FileText className="h-10 w-10 mx-auto mb-3 text-gray-300" />
              <p className="text-base">ไม่พบใบกำกับภาษี</p>
            </div>
          ) : (
            <>
              {/* Mobile card view */}
              <div className="md:hidden space-y-3">
                {paginatedInvoices.map((inv) => {
                  const isVoided = inv.status === 'void';
                  return (
                    <Card
                      key={inv.id}
                      className={`cursor-pointer active:bg-gray-50 transition-colors ${isVoided ? 'opacity-50' : ''}`}
                      onClick={() => inv.enrollmentId && router.push(`/enrollments/${inv.enrollmentId}`)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`font-semibold text-base ${isVoided ? 'text-gray-400 line-through' : 'text-blue-700'}`}>
                                {inv.taxInvoiceNumber}
                              </span>
                              {inv.receiptId && (
                                <Badge variant="outline" className="text-xs text-blue-600 border-blue-300">ออกทีหลัง</Badge>
                              )}
                              {isVoided && inv.voidedById && (
                                <Badge variant="secondary" className="text-xs">ยกเลิก (ออกใหม่)</Badge>
                              )}
                              {isVoided && !inv.voidedById && (
                                <Badge variant="secondary" className="text-xs">ยกเลิก</Badge>
                              )}
                              {inv.replacesId && (
                                <Badge variant="outline" className="text-xs text-purple-600 border-purple-300">แทนใบเดิม</Badge>
                              )}
                              {!isVoided && inv.paidAmount > 0 && inv.paidAmount < inv.totalAmount && (
                                <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">จ่ายบางส่วน</Badge>
                              )}
                              </div>
                            <p className="text-sm text-gray-700 mt-1">{inv.customerName}</p>
                            <p className="text-sm text-gray-400 mt-0.5">
                              {formatDate(inv.issuedAt || inv.createdAt, 'short')}
                            </p>
                            {inv.linkedCreditNotes && inv.linkedCreditNotes.filter(cn => cn.status !== 'void').length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {inv.linkedCreditNotes.filter(cn => cn.status !== 'void').map(cn => (
                                  <span
                                    key={cn.id}
                                    className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-1.5 py-0.5 cursor-pointer hover:bg-red-100 transition-colors"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      router.push('/accounting/credit-notes');
                                    }}
                                  >
                                    CN: {cn.creditNoteNumber} (-{formatCurrency(cn.refundAmount)})
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-semibold text-base">{formatCurrency(inv.totalAmount)}</div>
                            {inv.paidAmount < inv.totalAmount && (
                              <div className="text-xs text-red-500">
                                ค้าง {formatCurrency(inv.totalAmount - inv.paidAmount)}
                              </div>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              className="mt-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                print.printReceipt(inv.id);
                              }}
                            >
                              <Printer className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Desktop list view */}
              <div className="hidden md:block">
                <Card>
                  <CardContent className="p-0">
                    <div className="divide-y">
                      <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 text-sm text-gray-500">
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={toggleSelectAll}
                        />
                        <span>เลือกทั้งหมด ({filteredInvoices.length} ใบ)</span>
                      </div>
                      {paginatedInvoices.map((inv) => {
                        const isVoided = inv.status === 'void';
                        const isReissued = inv.receiptId ? 'tax-invoice' : 'tax-invoice-receipt';
                        return (
                        <div
                          key={inv.id}
                          className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${isVoided ? 'opacity-50' : ''}`}
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
                                <span className={`font-semibold text-base ${isVoided ? 'text-gray-400 line-through' : 'text-blue-700'}`}>
                                  {inv.taxInvoiceNumber}
                                </span>
                                {isReissued === 'tax-invoice' && (
                                  <Badge variant="outline" className="text-xs text-blue-600 border-blue-300">ออกทีหลัง</Badge>
                                )}
                                {isVoided && inv.voidedById && (
                                  <Badge variant="secondary" className="text-xs">ยกเลิก (ออกใหม่)</Badge>
                                )}
                                {isVoided && !inv.voidedById && (
                                  <Badge variant="secondary" className="text-xs">ยกเลิก</Badge>
                                )}
                                {inv.replacesId && (
                                  <Badge variant="outline" className="text-xs text-purple-600 border-purple-300">แทนใบเดิม</Badge>
                                )}
                                {!isVoided && inv.paidAmount > 0 && inv.paidAmount < inv.totalAmount && (
                                  <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">จ่ายบางส่วน</Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                                <span>{inv.customerName}</span>
                                {inv.customerPhone && <span>{inv.customerPhone}</span>}
                                <span>{formatDate(inv.issuedAt || inv.createdAt, 'short')}</span>
                              </div>
                              {inv.linkedCreditNotes && inv.linkedCreditNotes.filter(cn => cn.status !== 'void').length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {inv.linkedCreditNotes.filter(cn => cn.status !== 'void').map(cn => (
                                    <span
                                      key={cn.id}
                                      className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-1.5 py-0.5 cursor-pointer hover:bg-red-100 transition-colors"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        router.push('/accounting/credit-notes');
                                      }}
                                    >
                                      CN: {cn.creditNoteNumber} (-{formatCurrency(cn.refundAmount)})
                                    </span>
                                  ))}
                                </div>
                              )}
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
                                  print.printReceipt(inv.id);
                                }}
                              >
                                <Printer className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}

          {filteredInvoices.length > 0 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              totalItems={filteredInvoices.length}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
              pageSizeOptions={[20, 50, 100]}
              showFirstLastButtons={false}
            />
          )}
        </>
      )}

      <PrintDialogs print={print} />
    </div>
  );
}
