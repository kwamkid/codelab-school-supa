// Shared Recharts styling so every report chart looks the same.
// Usage: <XAxis tick={chartAxisTick} />, <CartesianGrid {...chartGridProps} />,
// series colours from BRANCH_COLORS (stable per branch index) / CHART_COLORS.

export const BRANCH_COLORS = ['#2563eb', '#F4511E', '#10b981', '#8b5cf6', '#eab308']

export const CHART_COLORS = {
  primary: '#F4511E',
  indigo: '#6366f1',
  indigoSoft: '#c7d2fe',
  green: '#10b981',
  amber: '#f59e0b',
  cyan: '#0891b2',
  muted: '#d1d5db',
  ink: '#374151',
} as const

export const chartAxisTick = { fontSize: 13, fill: '#6b7280' }

export const chartGridProps = { strokeDasharray: '3 3', vertical: false, stroke: '#e5e7eb' } as const

export const chartLegendStyle = { fontSize: 14 }

/** Colour for branch `id` given the ordered branch list (falls back to the first colour). */
export function branchColor(branchIds: string[], id: string): string {
  return BRANCH_COLORS[Math.max(0, branchIds.indexOf(id)) % BRANCH_COLORS.length]
}
