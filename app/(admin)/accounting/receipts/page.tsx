'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Printer, Receipt as ReceiptIcon, Loader2 } from 'lucide-react';
import { formatDate, formatCurrency } from '@/lib/utils';
import { SectionLoading } from '@/components/ui/loading';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { useBranch } from '@/contexts/BranchContext';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Receipt, InvoiceCompany } from '@/types/models';
import { getReceipts } from '@/lib/services/receipts';
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

export default function ReceiptsPage() {
  const router = useRouter();
  const { selectedBranchId } = useBranch();
  const print = useDocumentPrint();
  const [companies, setCompanies] = useState<InvoiceCompany[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<string>('');
  const [loadingCompanies, setLoadingCompanies] = useState(true);

  const [receiptCache, setReceiptCache] = useState<Map<string, Receipt[]>>(new Map());
  const [loadingReceipts, setLoadingReceipts] = useState(false);

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

  useEffect(() => {
    if (!activeCompanyId) return;
    if (receiptCache.has(cacheKey)) return;

    let cancelled = false;
    setLoadingReceipts(true);
    getReceipts(selectedBranchId || undefined, activeCompanyId)
      .then((data) => {
        if (!cancelled) {
          setReceiptCache((prev) => new Map(prev).set(cacheKey, data));
        }
      })
      .catch((error) => console.error('Error loading receipts:', error))
      .finally(() => { if (!cancelled) setLoadingReceipts(false); });

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
    setReceiptCache(new Map());
  }, [selectedBranchId]);

  useEffect(() => {
    resetPagination();
  }, [searchQuery, dateRange, resetPagination]);

  const receipts = receiptCache.get(cacheKey) || [];

  const filteredReceipts = receipts.filter((r) => {
    if (dateRange) {
      const docDate = (r.issuedAt || r.createdAt).toISOString().slice(0, 10);
      if (docDate < dateRange.from || docDate > dateRange.to) return false;
    }
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.receiptNumber.toLowerCase().includes(q) ||
      r.customerName.toLowerCase().includes(q) ||
      (r.customerPhone && r.customerPhone.includes(q))
    );
  });

  const totalPages = Math.ceil(filteredReceipts.length / pageSize);
  const paginatedReceipts = filteredReceipts.slice(
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
    const allIds = filteredReceipts.map((r) => r.id);
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
      if (!res.ok) throw new Error('Failed to fetch receipts');
      const { results } = await res.json();

      const htmlParts: string[] = [];
      for (const result of results) {
        if (!result?.invoice || !result?.company) continue;
        const { invoice, company, branch } = result;

        const totalAmount = invoice.total_amount || 0;
        const remaining = totalAmount - (invoice.paid_amount || 0);

        const docData: DocumentData = {
          documentType: 'receipt',
          documentTitle: 'ใบเสร็จรับเงิน / Receipt',
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
        <h1 className="text-2xl font-bold text-gray-900 mb-6">ใบเสร็จรับเงิน</h1>
        <SectionLoading />
      </div>
    );
  }

  if (companies.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">ใบเสร็จรับเงิน</h1>
        <div className="text-center py-12 text-gray-500">
          <ReceiptIcon className="h-10 w-10 mx-auto mb-3 text-gray-300" />
          <p className="text-base">ยังไม่มีบริษัทออกใบเสร็จ</p>
        </div>
      </div>
    );
  }

  const allSelected = filteredReceipts.length > 0 && filteredReceipts.every((r) => selectedIds.has(r.id));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">ใบเสร็จรับเงิน</h1>
        <div className="flex items-center gap-3">
          {selectedIds.size > 0 && (
            <Button
              onClick={handleBulkPrint}
              disabled={bulkPrinting}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {bulkPrinting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Printer className="h-4 w-4 mr-2" />
              )}
              พิมพ์ {selectedIds.size} ใบ
            </Button>
          )}
          <span className="text-base text-gray-500">{filteredReceipts.length} รายการ</span>
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
                  ? 'border-primary text-primary'
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

      {loadingReceipts ? (
        <SectionLoading />
      ) : (
        <>
          {/* Mobile card view */}
          {filteredReceipts.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <ReceiptIcon className="h-10 w-10 mx-auto mb-3 text-gray-300" />
              <p className="text-base">ไม่พบใบเสร็จ</p>
            </div>
          ) : (
            <>
              <div className="md:hidden space-y-3">
                {paginatedReceipts.map((r) => (
                  <Card
                    key={r.id}
                    className="cursor-pointer active:bg-gray-50 transition-colors"
                    onClick={() => r.enrollmentId && router.push(`/enrollments/${r.enrollmentId}`)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-base text-emerald-700">
                              {r.receiptNumber}
                            </span>
                            {r.status === 'void' && (
                              <Badge variant="secondary" className="text-xs">ยกเลิก</Badge>
                            )}
                            {r.status !== 'void' && r.paidAmount > 0 && r.paidAmount < r.totalAmount && (
                              <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">จ่ายบางส่วน</Badge>
                            )}
                            {r.linkedRefundNotes && r.linkedRefundNotes.some(rn => rn.status !== 'void') && (
                              <Badge variant="outline" className="text-xs text-orange-600 border-orange-300 bg-orange-50">มีคืนเงิน</Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-700 mt-1">{r.customerName}</p>
                          <p className="text-sm text-gray-400 mt-0.5">
                            {formatDate(r.issuedAt || r.createdAt, 'short')}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-semibold text-base">{formatCurrency(r.totalAmount)}</div>
                          {r.paidAmount < r.totalAmount && (
                            <div className="text-xs text-red-500">
                              ค้าง {formatCurrency(r.totalAmount - r.paidAmount)}
                            </div>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              print.printReceipt(r.id);
                            }}
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
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
                        <span>เลือกทั้งหมด ({filteredReceipts.length} ใบ)</span>
                      </div>
                      {paginatedReceipts.map((r) => (
                        <div
                          key={r.id}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                        >
                          <Checkbox
                            checked={selectedIds.has(r.id)}
                            onCheckedChange={() => toggleSelect(r.id)}
                          />
                          <div
                            className="flex items-center justify-between flex-1 min-w-0 cursor-pointer"
                            onClick={() => r.enrollmentId && router.push(`/enrollments/${r.enrollmentId}`)}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-base text-emerald-700">
                                  {r.receiptNumber}
                                </span>
                                {r.status === 'void' && (
                                  <Badge variant="secondary" className="text-xs">ยกเลิก</Badge>
                                )}
                                {r.status !== 'void' && r.paidAmount > 0 && r.paidAmount < r.totalAmount && (
                                  <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">จ่ายบางส่วน</Badge>
                                )}
                                {r.linkedRefundNotes && r.linkedRefundNotes.some(rn => rn.status !== 'void') && (
                                  <Badge variant="outline" className="text-xs text-orange-600 border-orange-300 bg-orange-50">มีคืนเงิน</Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                                <span>{r.customerName}</span>
                                {r.customerPhone && <span>{r.customerPhone}</span>}
                                <span>{formatDate(r.issuedAt || r.createdAt, 'short')}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <div className="font-semibold text-base">{formatCurrency(r.totalAmount)}</div>
                                {r.paidAmount < r.totalAmount && (
                                  <div className="text-xs text-red-500">
                                    ค้าง {formatCurrency(r.totalAmount - r.paidAmount)}
                                  </div>
                                )}
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  print.printReceipt(r.id);
                                }}
                              >
                                <Printer className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}

          {filteredReceipts.length > 0 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              totalItems={filteredReceipts.length}
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
