// hooks/useSettings.ts

import { useState, useEffect } from 'react';
import { getGeneralSettings, GeneralSettings } from '@/lib/services/settings';
import { getClient } from '@/lib/supabase/client';

export function useSettings() {
  const [settings, setSettings] = useState<GeneralSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let active = true;

    const loadSettings = async () => {
      try {
        const data = await getGeneralSettings();
        if (active) setSettings(data);
      } catch (err) {
        if (active) setError(err as Error);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadSettings();

    // Real-time updates: re-fetch whenever the settings table changes.
    // (Replaces the old Firestore onSnapshot subscription.)
    const supabase = getClient();
    const channel = supabase
      .channel('settings-general')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'settings' },
        () => {
          loadSettings();
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return { settings, loading, error };
}
