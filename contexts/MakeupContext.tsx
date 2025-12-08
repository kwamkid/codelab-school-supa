'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { getMakeupClasses } from '@/lib/services/makeup';
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
      const makeupClasses = await getMakeupClasses();
      const pendingAuto = makeupClasses.filter(
        m => m.status === 'pending' && m.requestedBy === 'system'
      ).length;
      setPendingMakeupCount(pendingAuto);
    } catch (error) {
      console.error('Error loading makeup count:', error);
    }
  };

  useEffect(() => {
    if (user) {
      refreshMakeupCount();
      const interval = setInterval(refreshMakeupCount, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  return (
    <MakeupContext.Provider value={{ pendingMakeupCount, refreshMakeupCount }}>
      {children}
    </MakeupContext.Provider>
  );
}

export const useMakeup = () => useContext(MakeupContext);