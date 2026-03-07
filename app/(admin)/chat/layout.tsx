'use client';

import { Sarabun } from 'next/font/google';

const sarabun = Sarabun({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['thai', 'latin'],
  display: 'swap',
  variable: '--font-chat',
});

/**
 * Chat layout: negates admin layout padding + stretches to fill
 * the entire <main> area (100vh - 4rem header).
 * Sarabun font available via var(--font-chat) for chat text only.
 */
export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`-m-4 md:-m-6 -mb-12 h-[calc(100vh-4rem)] overflow-hidden ${sarabun.variable}`}>
      {children}
    </div>
  );
}
