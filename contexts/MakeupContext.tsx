'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { getPendingMakeupCount } from '@/lib/services/makeup';
import { getClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface MakeupContextType {
  pendingMakeupCount: number;
  refreshMakeupCount: () => Promise<void>;
}

const MakeupContext = createContext<MakeupContextType>({
  pendingMakeupCount: 0,
  refreshMakeupCount: async () => {},
});

export function MakeupProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [pendingMakeupCount, setPendingMakeupCount] = useState(0);

  const refreshMakeupCount = async () => {
    try {
      const count = await getPendingMakeupCount();
      setPendingMakeupCount(count);
    } catch (error) {
      console.error('Error loading makeup count:', error);
    }
  };

  useEffect(() => {
    if (!user) return;

    refreshMakeupCount();

    // Fallback polling ทุก 5 นาที
    const interval = setInterval(refreshMakeupCount, 300000);

    // Realtime: refresh ทันทีเมื่อ makeup_classes เปลี่ยน
    const supabase = getClient();
    const channel = supabase
      .channel('makeup-ctx-count')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'makeup_classes' }, () => refreshMakeupCount())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'makeup_classes' }, () => refreshMakeupCount())
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [user]);

  return (
    <MakeupContext.Provider value={{ pendingMakeupCount, refreshMakeupCount }}>
      {children}
    </MakeupContext.Provider>
  );
}

export const useMakeup = () => useContext(MakeupContext);