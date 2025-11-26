import { useEffect } from 'react';
import { useSignal, miniApp } from '@tma.js/sdk-react';

/**
 * Hook to sync Telegram's dark mode with antd-mobile theme
 * Sets data-prefers-color-scheme attribute on html element
 */
export function useAntdMobileTheme() {
  const isDark = useSignal(miniApp.isDark);

  useEffect(() => {
    const htmlElement = document.documentElement;

    if (isDark) {
      htmlElement.setAttribute('data-prefers-color-scheme', 'dark');
    } else {
      htmlElement.setAttribute('data-prefers-color-scheme', 'light');
    }
  }, [isDark]);

  return isDark;
}
