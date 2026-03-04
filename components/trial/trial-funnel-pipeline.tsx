'use client';

import { cn } from '@/lib/utils';
import {
  AlertCircle,
  PhoneCall,
  CalendarCheck,
  Check,
  UserPlus,
  ChevronRight,
} from 'lucide-react';

const funnelStages = [
  { key: 'new', label: 'ใหม่', icon: AlertCircle, color: 'blue' },
  { key: 'contacted', label: 'ติดต่อแล้ว', icon: PhoneCall, color: 'yellow' },
  { key: 'scheduled', label: 'นัดหมายแล้ว', icon: CalendarCheck, color: 'purple' },
  { key: 'completed', label: 'เรียนแล้ว', icon: Check, color: 'green' },
  { key: 'converted', label: 'ลงทะเบียนแล้ว', icon: UserPlus, color: 'emerald' },
] as const;

const colorMap: Record<string, { bg: string; bgActive: string; text: string; border: string }> = {
  blue:    { bg: 'bg-blue-50',    bgActive: 'bg-blue-100 ring-2 ring-blue-400',    text: 'text-blue-700',    border: 'border-blue-200' },
  yellow:  { bg: 'bg-yellow-50',  bgActive: 'bg-yellow-100 ring-2 ring-yellow-400',  text: 'text-yellow-700',  border: 'border-yellow-200' },
  purple:  { bg: 'bg-purple-50',  bgActive: 'bg-purple-100 ring-2 ring-purple-400',  text: 'text-purple-700',  border: 'border-purple-200' },
  green:   { bg: 'bg-green-50',   bgActive: 'bg-green-100 ring-2 ring-green-400',   text: 'text-green-700',   border: 'border-green-200' },
  emerald: { bg: 'bg-emerald-50', bgActive: 'bg-emerald-100 ring-2 ring-emerald-400', text: 'text-emerald-700', border: 'border-emerald-200' },
};

interface TrialFunnelPipelineProps {
  statusCounts: Record<string, number>;
  selectedStatus: string;
  onStatusClick: (status: string) => void;
}

export function TrialFunnelPipeline({
  statusCounts,
  selectedStatus,
  onStatusClick,
}: TrialFunnelPipelineProps) {
  // Cumulative counts: how many bookings have ever reached each stage
  // A booking at "completed" has passed through new → contacted → scheduled → completed
  const cumulativeCounts = funnelStages.map((_, i) =>
    funnelStages.slice(i).reduce((sum, s) => sum + (statusCounts[s.key] || 0), 0)
  );

  const cancelledCount = statusCounts['cancelled'] || 0;
  const totalCount = statusCounts['all'] || 0;

  return (
    <div className="space-y-4 py-1">
      {/* Main funnel pipeline — horizontal cards */}
      <div className="flex items-center gap-1 overflow-x-auto py-1 px-1">
        {funnelStages.map((stage, index) => {
          const count = statusCounts[stage.key] || 0;
          const colors = colorMap[stage.color];
          const isActive = selectedStatus === stage.key;
          const isAllActive = selectedStatus === 'all';
          const Icon = stage.icon;

          // Conversion rate between this stage and next (cumulative)
          const showArrow = index < funnelStages.length - 1;
          const rate = showArrow && cumulativeCounts[index] > 0
            ? Math.round((cumulativeCounts[index + 1] / cumulativeCounts[index]) * 100)
            : null;

          return (
            <div key={stage.key} className="flex items-center">
              {/* Stage card — horizontal layout */}
              <button
                onClick={() => onStatusClick(isActive ? 'all' : stage.key)}
                className={cn(
                  'flex items-center gap-2.5 px-4 py-2.5 rounded-lg border transition-all cursor-pointer whitespace-nowrap',
                  isActive ? colors.bgActive : isAllActive ? colors.bg : 'bg-gray-50 border-gray-200 opacity-60',
                  !isActive && !isAllActive ? 'hover:opacity-80' : '',
                  isActive ? colors.border : 'border-transparent',
                )}
              >
                <Icon className={cn('h-5 w-5 shrink-0', colors.text)} />
                <div className={cn('text-xl font-bold leading-none', colors.text)}>{count}</div>
                <div className={cn('text-xs font-medium leading-none', colors.text)}>
                  {stage.label}
                </div>
              </button>

              {/* Conversion arrow */}
              {showArrow && (
                <div className="flex flex-col items-center justify-center px-1 min-w-[36px]">
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                  {rate !== null && (
                    <span className="text-[10px] text-gray-400 font-medium">{rate}%</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom row: total summary */}
      <div className="flex items-center gap-3 text-sm text-gray-500 px-1">
        <button
          onClick={() => onStatusClick('all')}
          className={cn(
            'hover:text-gray-700 transition-colors cursor-pointer',
            selectedStatus === 'all' && 'font-semibold text-gray-700',
          )}
        >
          ทั้งหมด {totalCount} รายการ
        </button>
        {cancelledCount > 0 && (
          <>
            <span className="text-gray-300">|</span>
            <button
              onClick={() => onStatusClick(selectedStatus === 'cancelled' ? 'all' : 'cancelled')}
              className={cn(
                'hover:text-gray-700 transition-colors cursor-pointer',
                selectedStatus === 'cancelled' && 'font-semibold text-gray-700',
              )}
            >
              ยกเลิกแล้ว {cancelledCount} รายการ
            </button>
          </>
        )}
      </div>
    </div>
  );
}
