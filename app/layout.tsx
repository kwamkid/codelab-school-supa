import type { Metadata } from "next";
import { IBM_Plex_Sans_Thai } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/hooks/useSupabaseAuth";
import { Toaster } from "@/components/ui/sonner";
import { QueryProvider } from '@/providers/query-provider';
import '@/lib/suppress-warnings';


const ibmPlexSansThai = IBM_Plex_Sans_Thai({ 
  weight: ['100', '200', '300', '400', '500', '600', '700'],
  subsets: ["thai", "latin"],
  display: 'swap',
});

export const metadata: Metadata = {
  title: "CodeLab School Management System",
  description: "ระบบจัดการโรงเรียนสอนพิเศษ Coding & Robotics",
};

// ในส่วน body ให้ wrap children ด้วย QueryProvider
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="th" suppressHydrationWarning>
      <body className={ibmPlexSansThai.className}>
        <QueryProvider>
          <AuthProvider>
            <Toaster />
            {children}
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  )
}