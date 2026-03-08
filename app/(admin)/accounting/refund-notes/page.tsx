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

export default function RefundNotesPage() {
  const router = useRouter();
  const { selectedBranchId } = useBranch();
  const [companies, setCompanies] = useState<InvoiceCompany[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<string>('');
  const [loadingCompanies, setLoadingCompanies] = useState(true);

  const [cnCache, setCnCache] = useState<Map<string, CreditNote[]>>(new Map());
  const [loadingNotes, setLoadingNotes] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<{ from: string; to: string } | undefined>(getCurrentMonthRange());
  const print = useDocumentPrint();
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
    if (cnCache.has(cacheKey)) return;

    let cancelled = false;
    setLoadingNotes(true);
    getCreditNotes(selectedBranchId || undefined, activeCompanyId)
      .then((cn) => {
        if (!cancelled) {
          setCnCache((prev) => new Map(prev).set(cacheKey, cn));
        }
      })
      .catch((error) => console.error('Error loading refund notes:', error))
      .finally(() => { if (!cancelled) setLoadingNotes(false); });

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
    setCnCache(new Map());
  }, [selectedBranchId]);

  useEffect(() => {
    resetPagination();
  }, [searchQuery, dateRange]);

  // Filter to refund notes only
  const refundNotes = (cnCache.get(cacheKey) || []).filter(cn => cn.documentType === 'refund-note');

  const filteredNotes = refundNotes.filter((cn) => {
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

  const totalPages = Math.ceil(filteredNotes.length / pageSize);
  const paginatedNotes = filteredNotes.slice(
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
    const allIds = filteredNotes.map((cn) => cn.id);
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
      if (!res.ok) throw new Error('Failed to fetch refund notes');
      const { results } = await res.json();

      const htmlParts: string[] = [];
      for (const result of results) {
        if (!result?.creditNote || !result?.company) continue;
        const { creditNote, company, branch, originalInvoice } = result;

        const refundAmount = creditNote.refund_amount || 0;

        const docData: DocumentData = {
          documentType: 'refund-note',
          documentTitle: 'ใบบันทึกคืนเงิน / Refund Note',
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
            label: 'ใบเสร็จอ้างอิง / Reference Receipt',
            number: originalInvoice.invoice_number,
            date: formatDate(originalInvoice.issued_at, 'long'),
          } : undefined,
          customer: {
            name: creditNote.customer_name,
            phone: creditNote.customer_phone || undefined,
            email: creditNote.customer_email || undefined,
          },
          items: (creditNote.items || []).map((item: any) => ({
            description: item.description,
            amount: item.amount,
          })),
          summary: {
            subtotal: refundAmount,
            total: refundAmount,
            totalLabel: 'ยอดคืนสุทธิ / Total Refund',
          },
          reason: creditNote.reason,
          signatures: {
            left: { label: 'ผู้ออกเอกสาร / Issuer' },
            right: { label: 'ผู้รับเงินคืน / Recipient' },
          },
        };

        htmlParts.push(generateDocumentHTML(docData));
      }

      if (htmlParts.length > 0) {
        openPrintWindow(`ใบบันทึกคืนเงิน (${htmlParts.length} ใบ)`, htmlParts.join(''));
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
        <h1 className="text-2xl font-bold text-gray-900 mb-6">ใบบันทึกคืนเงิน</h1>
        <SectionLoading />
      </div>
    );
  }

  if (companies.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">ใบบันทึกคืนเงิน</h1>
        <div className="text-center py-12 text-gray-500">
          <CreditCard className="h-10 w-10 mx-auto mb-3 text-gray-300" />
          <p className="text-base">ยังไม่มีบริษัท</p>
        </div>
      </div>
    );
  }

  const allSelected = filteredNotes.length > 0 && filteredNotes.every((cn) => selectedIds.has(cn.id));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">ใบบันทึกคืนเงิน</h1>
        <div className="flex items-center gap-3">
          {selectedIds.size > 0 && (
            <Button
              onClick={handleBulkPrint}
              disabled={bulkPrinting}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {bulkPrinting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Printer className="h-4 w-4 mr-2" />
              )}
              พิมพ์ {selectedIds.size} ใบ
            </Button>
          )}
          <span className="text-base text-gray-500">{filteredNotes.length} รายการ</span>
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
                  ? 'border-orange-600 text-orange-600'
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
            placeholder="ค้นหาเลข RN, ชื่อลูกค้า, เบอร์โทร..."
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

      {loadingNotes ? (
        <SectionLoading />
      ) : (
        <>
          {filteredNotes.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <CreditCard className="h-10 w-10 mx-auto mb-3 text-gray-300" />
              <p className="text-base">ไม่พบใบบันทึกคืนเงิน</p>
            </div>
          ) : (
            <>
              {/* Mobile card view */}
              <div className="md:hidden space-y-3">
                {paginatedNotes.map((cn) => (
                  <Card
                    key={cn.id}
                    className="cursor-pointer active:bg-gray-50 transition-colors"
                    onClick={() => cn.enrollmentId && router.push(`/enrollments/${cn.enrollmentId}`)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-base text-orange-600">
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
                          <div className="font-semibold text-base text-orange-600">
                            -{formatCurrency(cn.refundAmount)}
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              print.printRefundNote(cn.id);
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
                        <span>เลือกทั้งหมด ({filteredNotes.length} ใบ)</span>
                      </div>
                      {paginatedNotes.map((cn) => (
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
                                <span className="font-semibold text-base text-orange-600">
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
                                <div className="font-semibold text-base text-orange-600">
                                  -{formatCurrency(cn.refundAmount)}
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  print.printRefundNote(cn.id);
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

          {totalPages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              totalItems={filteredNotes.length}
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
