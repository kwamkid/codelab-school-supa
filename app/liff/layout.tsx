import type { Metadata, Viewport } from 'next'
import { Toaster } from 'sonner'
import { LiffErrorBoundary } from '@/components/liff/error-boundary'

export const metadata: Metadata = {
  title: 'CodeLab School',
  description: 'ระบบจัดการโรงเรียนสอนเขียนโปรแกรม',
}

// แยก viewport ออกมาเป็น export แยง
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#f97316',
}

export default function LiffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <LiffErrorBoundary>
      {children}
      <Toaster position="top-center" />
    </LiffErrorBoundary>
  );
}