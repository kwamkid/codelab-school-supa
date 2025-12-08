// hooks/useSettings.ts

import { useState, useEffect } from 'react';
import { getGeneralSettings, GeneralSettings } from '@/lib/services/settings';

export function useSettings() {
  const [settings, setSettings] = useState<GeneralSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Initial load
    const loadSettings = async () => {
      try {
        const data = await getGeneralSettings();
        setSettings(data);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();

    // Subscribe to real-time updates
    const unsubscribe = onSnapshot(
      doc(db, 'settings', 'general'),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          setSettings({
            ...data,
            updatedAt: data.updatedAt?.toDate() || new Date()
          } as GeneralSettings);
        }
      },
      (err) => {
        console.error('Error listening to settings:', err);
        setError(err as Error);
      }
    );

    return () => unsubscribe();
  }, []);

  return { settings, loading, error };
}