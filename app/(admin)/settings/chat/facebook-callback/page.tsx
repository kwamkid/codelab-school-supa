'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

function CallbackHandler() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    if (window.opener) {
      window.opener.postMessage(
        {
          type: 'fb-oauth-callback',
          code: code || null,
          error: error || null,
          errorDescription: errorDescription || null,
        },
        window.location.origin
      );
      window.close();
    }
  }, [searchParams]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-3">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      <p className="text-base text-gray-600">กำลังเชื่อมต่อ Facebook...</p>
    </div>
  );
}

export default function FacebookCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      }
    >
      <CallbackHandler />
    </Suspense>
  );
}
