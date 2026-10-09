// components/ui/pagination.tsx
'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Tooltip } from '@/components/ui/tooltip';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
  showFirstLastButtons?: boolean; // เปลี่ยนชื่อ: รองรับทั้งปุ่มแรกและสุดท้าย
}

export function Pagination({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  showFirstLastButtons = false, // default ปิด
}: PaginationProps) {
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  // Calculate page numbers to show (3 for mobile, 5 for desktop)
  const getPageNumbers = (isMobile: boolean) => {
    const maxPages = isMobile ? 3 : 5;
    const pages: number[] = [];

    if (totalPages <= maxPages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      const halfMax = Math.floor(maxPages / 2);
      let startPage = Math.max(1, currentPage - halfMax);
      const endPage = Math.min(totalPages, startPage + maxPages - 1);

      if (endPage - startPage < maxPages - 1) {
        startPage = Math.max(1, endPage - maxPages + 1);
      }

      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
    }

    return pages;
  };

  // Don't show pagination if no items
  if (totalItems === 0) {
    return null;
  }

  const showNavigation = totalPages > 1;

  const canGoFirst = currentPage > 1;
  const canGoLast = currentPage < totalPages;

  return (
    <div className="border-t">
      {/* Mobile Layout */}
      <div className="md:hidden space-y-3 px-4 py-3">
        {/* Row 1: Page size selector */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-600">แสดง</span>
            <Select
              value={pageSize.toString()}
              onValueChange={(value) => onPageSizeChange(Number(value))}
            >
              <SelectTrigger className="w-16 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((size) => (
                  <SelectItem key={size} value={size.toString()}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <span className="text-xs text-gray-600">
            {startItem}-{endItem} / {totalItems}
          </span>
        </div>

        {/* Row 2: Navigation - only show when multiple pages */}
        {showNavigation && (
          <div className="flex items-center justify-center gap-1">
            {showFirstLastButtons && (
              <Tooltip label="หน้าแรก"><Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(1)}
                disabled={!canGoFirst}
                className="h-8 w-8"
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button></Tooltip>
            )}

            <Tooltip label="หน้าก่อนหน้า"><Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="h-8 w-8"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button></Tooltip>

            {getPageNumbers(true).map((pageNum) => (
              <Button
                key={pageNum}
                variant={currentPage === pageNum ? 'default' : 'outline'}
                size="sm"
                onClick={() => onPageChange(pageNum)}
                className="h-8 w-8 text-xs"
              >
                {pageNum}
              </Button>
            ))}

            <Tooltip label="หน้าถัดไป"><Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="h-8 w-8"
            >
              <ChevronRight className="h-4 w-4" />
            </Button></Tooltip>

            {showFirstLastButtons && (
              <Tooltip label="หน้าสุดท้าย"><Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(totalPages)}
                disabled={!canGoLast}
                className="h-8 w-8"
              >
                <ChevronsRight className="h-4 w-4" />
              </Button></Tooltip>
            )}
          </div>
        )}
      </div>

      {/* Desktop Layout */}
      <div className="hidden md:flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">แสดง</span>
          <Select
            value={pageSize.toString()}
            onValueChange={(value) => onPageSizeChange(Number(value))}
          >
            <SelectTrigger className="w-20 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((size) => (
                <SelectItem key={size} value={size.toString()}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-gray-600">
            รายการ (แสดง {startItem}-{endItem} จาก {totalItems})
          </span>
        </div>

        {showNavigation && (
          <div className="flex items-center gap-2">
            {showFirstLastButtons && (
              <Tooltip label="หน้าแรก"><Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(1)}
                disabled={!canGoFirst}
                className="w-9"
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button></Tooltip>
            )}

            <Tooltip label="หน้าก่อนหน้า"><Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="w-9"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button></Tooltip>

            <div className="flex items-center gap-1">
              {getPageNumbers(false).map((pageNum) => (
                <Button
                  key={pageNum}
                  variant={currentPage === pageNum ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onPageChange(pageNum)}
                  className="w-9"
                >
                  {pageNum}
                </Button>
              ))}
            </div>

            <Tooltip label="หน้าถัดไป"><Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="w-9"
            >
              <ChevronRight className="h-4 w-4" />
            </Button></Tooltip>

            {showFirstLastButtons && (
              <Tooltip label="หน้าสุดท้าย"><Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(totalPages)}
                disabled={!canGoLast}
                className="w-9"
              >
                <ChevronsRight className="h-4 w-4" />
              </Button></Tooltip>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Hook สำหรับจัดการ Pagination State
export function usePagination(initialPageSize: number = 20) {
  const [currentPage, setCurrentPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(initialPageSize);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1); // Reset to first page
  };

  const resetPagination = React.useCallback(() => {
    setCurrentPage(1);
  }, []);

  // Calculate paginated data
  const getPaginatedData = React.useCallback(
    <T,>(data: T[]): T[] => {
      const startIndex = (currentPage - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      return data.slice(startIndex, endIndex);
    },
    [currentPage, pageSize]
  );

  const totalPages = React.useCallback(
    (totalItems: number) => Math.ceil(totalItems / pageSize),
    [pageSize]
  );

  return {
    currentPage,
    pageSize,
    handlePageChange,
    handlePageSizeChange,
    resetPagination,
    getPaginatedData,
    totalPages,
  };
}