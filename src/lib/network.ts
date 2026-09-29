import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

function currentlyOnlineWeb(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine;
}

/** True when there's a working connection — NetInfo on native, browser events on web (this app's PWA path). */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() => (Platform.OS === 'web' ? currentlyOnlineWeb() : true));

  useEffect(() => {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
      const goOnline = () => setOnline(true);
      const goOffline = () => setOnline(false);
      window.addEventListener('online', goOnline);
      window.addEventListener('offline', goOffline);
      return () => {
        window.removeEventListener('online', goOnline);
        window.removeEventListener('offline', goOffline);
      };
    }

    return NetInfo.addEventListener((state) => {
      setOnline(state.isConnected !== false && state.isInternetReachable !== false);
    });
  }, []);

  return online;
}
