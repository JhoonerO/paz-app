import { useEffect, useState } from 'react';
import { Linking } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '../lib/supabase';

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.upaz.app';

function isOutdated(current: string, latest: string): boolean {
  const c = current.split('.').map(Number);
  const l = latest.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((l[i] ?? 0) > (c[i] ?? 0)) return true;
    if ((l[i] ?? 0) < (c[i] ?? 0)) return false;
  }
  return false;
}

export function useVersionCheck() {
  const [showUpdate, setShowUpdate] = useState(false);
  const [forceUpdate, setForceUpdate] = useState(false);

  useEffect(() => {
    supabase
      .from('app_config')
      .select('latest_version, force_update')
      .eq('id', 'global')
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        const current = Constants.expoConfig?.version ?? '1.0.0';
        if (isOutdated(current, data.latest_version)) {
          setForceUpdate(data.force_update ?? false);
          setShowUpdate(true);
        }
      });
  }, []);

  const openPlayStore = () => Linking.openURL(PLAY_STORE_URL);
  const dismiss = () => { if (!forceUpdate) setShowUpdate(false); };

  return { showUpdate, forceUpdate, openPlayStore, dismiss };
}
