import { Navigate, Route, Routes, HashRouter } from 'react-router-dom';
import { useLaunchParams, useSignal, miniApp } from '@tma.js/sdk-react';
import { AppRoot } from '@telegram-apps/telegram-ui';

import { routes } from '@/navigation/routes.tsx';
import { Layout } from '@/components/Layout.tsx';
import { PageProvider } from '@/contexts/PageContext.tsx';
import { CameraProvider } from '@/contexts/CameraContext.tsx';
import { useAntdMobileTheme } from '@/hooks/useAntdMobileTheme.ts';

export function App() {
  const lp = useLaunchParams();
  const isDark = useSignal(miniApp.isDark);

  // Sync Telegram dark mode with antd-mobile theme
  useAntdMobileTheme();

  return (
    <AppRoot
      appearance={isDark ? 'dark' : 'light'}
      platform={['macos', 'ios'].includes(lp.tgWebAppPlatform) ? 'ios' : 'base'}
    >
      <CameraProvider>
        <PageProvider>
          <HashRouter>
            <Routes>
              <Route element={<Layout />}>
                {routes.map((route) => <Route key={route.path} {...route} />)}
              </Route>
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </HashRouter>
        </PageProvider>
      </CameraProvider>
    </AppRoot>
  );
}
