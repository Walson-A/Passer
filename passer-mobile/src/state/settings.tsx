import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { setHapticsEnabled } from '@/platform/haptics';
import { shareWithExtensions } from '@/platform/shared-state';
import { DEFAULT_SETTINGS, storage, type Settings } from '@/platform/storage';

type SettingsValue = {
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
};

const SettingsContext = createContext<SettingsValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const loaded = useRef(false);

  useEffect(() => {
    let active = true;
    void storage.loadSettings().then((stored) => {
      if (!active) return;
      loaded.current = true;
      setSettings(stored);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setHapticsEnabled(settings.haptics);
    if (!loaded.current) return;
    void storage.saveSettings(settings);
    shareWithExtensions({ photoDestination: settings.photoDestination });
  }, [settings]);

  const updateSettings = (patch: Partial<Settings>) =>
    setSettings((current) => ({ ...current, ...patch }));

  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>{children}</SettingsContext.Provider>
  );
}

export function useSettings(): SettingsValue {
  const value = useContext(SettingsContext);
  if (!value) throw new Error('useSettings must be used inside SettingsProvider');
  return value;
}
