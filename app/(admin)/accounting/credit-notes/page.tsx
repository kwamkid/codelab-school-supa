'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Printer, CreditCard, Loader2 } from 'lucide-react';
import { formatDate, formatCurrency } from '@/lib/utils';
import { SectionLoading } from '@/components/ui/loading';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { useBranch } from '@/contexts/BranchContext';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { CreditNote, InvoiceCompany } from '@/types/models';
import { getCreditNotes } from '@/lib/services/credit-notes';
import { getInvoiceCompanies } from '@/lib/services/invoice-companies';
import {
  DocumentData,
  generateDocumentHTML,
  openPrintWindow,
  formatAddress,
} from '@/components/invoices/document-template';
import { useDocumentPrint } from '@/hooks/useDocumentPrint';
import PrintDialogs from '@/components/shared/print-dialogs';

const DEFAULT_PAGE_SIZE = 20;

function getCurrentMonthRange(): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
  return { from: `${y}-${m}-01`, to: `${y}-${m}-${String(lastDay).padStart(2, '0')}` };
}

export default function CreditNotesPage() {
  const router = useRouter();
  const { selectedBranchId } = useBranch();
  const [companies, setCompanies] = useState<InvoiceCompany[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<string>('');
  const [loadingCompanies, setLoadingCompanies] = useState(true);

  // Per-company lazy-loaded data stored in a Map
  const [cnCache, setCnCache] = useState<Map<string, CreditNote[]>>(new Map());
  const [loadingCreditNotes, setLoadingCreditNotes] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<{ from: string; to: string } | undefined>(getCurrentMonthRange());
  const print = useDocumentPrint();
  const { currentPage, pageSize, handlePageChange, handlePageSizeChange, resetPagination } = usePagination(DEFAULT_PAGE_SIZE);
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

  useEffect(() => {
    if (!activeCompanyId) return;
    if (cnCache.has(cacheKey)) return;

    let cancelled = false;
    setLoadingCreditNotes(true);
    getCreditNotes(selectedBranchId || undefined, activeCompanyId)
      .then((cn) => {
        if (!cancelled) {
          setCnCache((prev) => new Map(prev).set(cacheKey, cn));
        }
      })
      .catch((error) => console.error('Error loading credit notes:', error))
      .finally(() => { if (!cancelled) setLoadingCreditNotes(false); });

    return () => { cancelled = true; };
  }, [activeCompanyId, selectedBranchId, cacheKey]);

  const handleTabChange = (companyId: string) => {
    setActiveCompanyId(companyId);
    setSearchQuery('');
    setDateRange(undefined);
    resetPagination();
    setSelectedIds(new Set());
  };

  // When branch changes: clear cache
  useEffect(() => {
    setCnCache(new Map());
  }, [selectedBranchId]);

  useEffect(() => {
    resetPagination();
  }, [searchQuery, dateRange]);

  // Filter to credit notes only (exclude refund notes)
  const creditNotes = (cnCache.get(cacheKey) || []).filter(cn => cn.documentType !== 'refund-note');

  const filteredCreditNotes = creditNotes.filter((cn) => {
    if (dateRange) {
      const docDate = (cn.issuedDate || cn.createdAt).toString().slice(0, 10);
      if (docDate < dateRange.from || docDate > dateRange.to) return false;
    }
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      cn.creditNoteNumber.toLowerCase().includes(q) ||
      cn.customerName.toLowerCase().includes(q) ||
      (cn.customerPhone && cn.customerPhone.includes(q))
    );
  });

  const totalPages = Math.ceil(filteredCreditNotes.length / pageSize);
  const paginatedCreditNotes = filteredCreditNotes.slice(
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
    const allIds = filteredCreditNotes.map((cn) => cn.id);
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
      const res = await fetch('/api/admin/credit-notes/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      if (!res.ok) throw new Error('Failed to fetch credit notes');
      const { results } = await res.json();

      const htmlParts: string[] = [];
      for (const result of results) {
        if (!result?.creditNote || !result?.company) continue;
        const { creditNote, company, branch, originalInvoice } = result;

        const refundAmount = creditNote.refund_amount || 0;
        const vatAmount = creditNote.vat_amount || 0;
        const priceBeforeVat = refundAmount - vatAmount;
        const isTaxCreditNote = vatAmount > 0 || creditNote.tax_invoice_id;
        const isRefundNote = creditNote.document_type === 'refund-note';
        const showBillingDetails = !isRefundNote && (creditNote.billing_tax_id || creditNote.billing_type === 'company');

        let documentTitle: string;
        if (isRefundNote) {
          documentTitle = 'ใบบันทึกคืนเงิน / Refund Note';
        } else if (isTaxCreditNote) {
          documentTitle = 'ใบลดหนี้/ใบกำกับภาษี';
        } else {
          documentTitle = 'ใบลดหนี้ / Credit Note';
        }

        const docData: DocumentData = {
          documentType: isRefundNote ? 'refund-note' : (isTaxCreditNote ? 'credit-note-tax' : 'credit-note'),
          documentTitle,
          company: {
            name: company.name || '-',
            address: company.address ? formatAddress(company.address) : undefined,
            taxId: company.tax_id || undefined,
            phone: company.phone || undefined,
            email: company.email || undefined,
            branchName: branch?.name || undefined,
          },
          documentNumber: creditNote.credit_note_number,
          documentDate: formatDate(creditNote.issued_date || creditNote.created_at, 'long'),
          reference: originalInvoice ? {
            label: isRefundNote ? 'ใบเสร็จอ้างอิง / Reference Receipt' : 'เอกสารอ้างอิง / Reference Document',
            number: originalInvoice.invoice_number,
            date: formatDate(originalInvoice.issued_at, 'long'),
          } : undefined,
          customer: {
            name: creditNote.customer_name,
            phone: creditNote.customer_phone || undefined,
            email: creditNote.customer_email || undefined,
          },
          billing: showBillingDetails ? {
            name: creditNote.billing_name || creditNote.customer_name,
            address: creditNote.billing_address ? formatAddress(creditNote.billing_address) : undefined,
            taxId: creditNote.billing_tax_id || undefined,
            branch: creditNote.billing_company_branch || undefined,
          } : undefined,
          items: (creditNote.items || []).map((item: any) => ({
            description: item.description,
            amount: item.amount,
          })),
          summary: {
            subtotal: refundAmount,
            vatBreakdown: isTaxCreditNote ? { priceBeforeVat, vatAmount } : undefined,
            total: refundAmount,
            totalLabel: 'ยอดคืนสุทธิ / Total Refund',
          },
          reason: creditNote.reason,
          signatures: {
            left: { label: isRefundNote ? 'ผู้ออกเอกสาร / Issuer' : 'ผู้ออกใบลดหนี้ / Issuer' },
            right: { label: 'ผู้รับเงินคืน / Recipient' },
          },
        };

        htmlParts.push(generateDocumentHTML(docData));
      }

      if (htmlParts.length > 0) {
        openPrintWindow(`ใบลดหนี้ (${htmlParts.length} ใบ)`, htmlParts.join(''));
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
        <h1 className="text-2xl font-bold text-gray-900 mb-6">ใบลดหนี้</h1>
        <SectionLoading />
      </div>
    );
  }

  if (companies.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">ใบลดหนี้</h1>
        <div className="text-center py-12 text-gray-500">
          <CreditCard className="h-10 w-10 mx-auto mb-3 text-gray-300" />
          <p className="text-base">ยังไม่มีบริษัท</p>
        </div>
      </div>
    );
  }

  const allSelected = filteredCreditNotes.length > 0 && filteredCreditNotes.every((cn) => selectedIds.has(cn.id));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">ใบลดหนี้</h1>
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
          <span className="text-base text-gray-500">{filteredCreditNotes.length} รายการ</span>
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
            placeholder="ค้นหาเลข CN, ชื่อลูกค้า, เบอร์โทร..."
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

      {loadingCreditNotes ? (
        <SectionLoading />
      ) : (
        <>
          {filteredCreditNotes.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <CreditCard className="h-10 w-10 mx-auto mb-3 text-gray-300" />
              <p className="text-base">ไม่พบใบลดหนี้</p>
            </div>
          ) : (
            <>
              {/* Mobile card view */}
              <div className="md:hidden space-y-3">
                {paginatedCreditNotes.map((cn) => (
                  <Card
                    key={cn.id}
                    className="cursor-pointer active:bg-gray-50 transition-colors"
                    onClick={() => cn.enrollmentId && router.push(`/enrollments/${cn.enrollmentId}`)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-base text-red-600">
                              {cn.creditNoteNumber}
                            </span>
                            {cn.status === 'void' && (
                              <Badge variant="secondary" className="text-xs">ยกเลิก</Badge>
                            )}
                            <Badge variant="outline" className="text-xs">
                              {cn.refundType === 'full' ? 'คืนเต็มจำนวน' : 'คืนบางส่วน'}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-700 mt-1">{cn.customerName}</p>
                          <p className="text-sm text-gray-400 mt-0.5">{cn.reason}</p>
                          <p className="text-sm text-gray-400 mt-0.5">
                            {formatDate(cn.issuedDate || cn.createdAt, 'short')}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-semibold text-base text-red-600">
                            -{formatCurrency(cn.refundAmount)}
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              print.printCreditNote(cn.id);
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
                        <span>เลือกทั้งหมด ({filteredCreditNotes.length} ใบ)</span>
                      </div>
                      {paginatedCreditNotes.map((cn) => (
                        <div
                          key={cn.id}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                        >
                          <Checkbox
                            checked={selectedIds.has(cn.id)}
                            onCheckedChange={() => toggleSelect(cn.id)}
                          />
                          <div
                            className="flex items-center justify-between flex-1 min-w-0 cursor-pointer"
                            onClick={() => cn.enrollmentId && router.push(`/enrollments/${cn.enrollmentId}`)}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-base text-red-600">
                                  {cn.creditNoteNumber}
                                </span>
                                {cn.status === 'void' && (
                                  <Badge variant="secondary" className="text-xs">ยกเลิก</Badge>
                                )}
                                <Badge variant="outline" className="text-xs">
                                  {cn.refundType === 'full' ? 'คืนเต็มจำนวน' : 'คืนบางส่วน'}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                                <span>{cn.customerName}</span>
                                <span>{cn.reason}</span>
                                <span>{formatDate(cn.issuedDate || cn.createdAt, 'short')}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <div className="font-semibold text-base text-red-600">
                                  -{formatCurrency(cn.refundAmount)}
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  print.printCreditNote(cn.id);
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

          {/* Pagination */}
          {totalPages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              totalItems={filteredCreditNotes.length}
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
