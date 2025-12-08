// components/common/dynamic-title.tsx

'use client';

import { useEffect } from 'react';
import { useSettings } from '@/hooks/useSettings';

interface DynamicTitleProps {
  pageTitle?: string;
}

export default function DynamicTitle({ pageTitle }: DynamicTitleProps) {
  const { settings } = useSettings();

  useEffect(() => {
    if (settings?.schoolName) {
      document.title = pageTitle 
        ? `${pageTitle} - ${settings.schoolName}`
        : settings.schoolName;
    }
  }, [settings, pageTitle]);

  return null;
}