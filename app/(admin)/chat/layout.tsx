'use client';

/**
 * Chat layout: negates admin layout padding + stretches to fill
 * the entire <main> area (100vh - 4rem header).
 *
 * Admin layout structure:
 *   <main class="h-[calc(100%-4rem)] overflow-y-auto">
 *     <div class="p-4 md:p-6 pb-12">   ← padding wrapper
 *       {children}                       ← this layout
 *     </div>
 *   </main>
 *
 * We negate padding with negative margins and use a fixed calc height
 * so the chat container fills the entire main area.
 */
export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="-m-4 md:-m-6 -mb-12 h-[calc(100vh-4rem)] overflow-hidden">
      {children}
    </div>
  );
}
