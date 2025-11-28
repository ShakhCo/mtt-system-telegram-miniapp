import { Outlet } from 'react-router-dom';
import { Card, NavBar, TabBar } from 'antd-mobile';
import { useNavigate, useLocation } from 'react-router-dom';
import { usePageContext } from '@/contexts/PageContext';
import { Car, House, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import { initData, useSignal } from '@tma.js/sdk-react';

export function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { title } = usePageContext();
  const [isInputFocused, setIsInputFocused] = useState(false);

  const initDataRaw = useSignal(initData.state);

  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  // Reusable access check function
  const checkAccess = async () => {
    const userId = initDataRaw?.user?.id;
    if (!userId) return;

    setLoading(true);

    try {
      const res = await fetch(
        `https://api-mtt.xlog.uz/api/auth/managers/gate_access/?telegram_id=${userId}`
      );

      const data = await res.json();

      if (res.ok && data.success === true) {
        setHasAccess(true);
      } else {
        setHasAccess(false);
      }
    } catch (e) {
      setHasAccess(false);
    } finally {
      setLoading(false);
    }
  };

  // First check on mount
  useEffect(() => {
    if (initDataRaw?.user?.id) checkAccess();
  }, [initDataRaw]);


  // Retry button handler
  const retry = () => {
    checkAccess();
  };


  // Hide navbar when input focused
  useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA'].includes(target.tagName)) {
        setIsInputFocused(true);
      }
    };

    const handleFocusOut = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA'].includes(target.tagName)) {
        setIsInputFocused(false);
      }
    };

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);

    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
    };
  }, []);

  const tabs = [
    { key: '/', title: 'Бош саҳифа', icon: <House /> },
    { key: '/vehicles', title: 'Машина', icon: <Car /> },
    // { key: '/ton-connect', title: 'Мен', icon: <User /> },
  ];

  // Loading
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-lg">
        Iltimos kuting....
      </div>
    );
  }

  // Access Denied screen with TRY AGAIN button
  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-center p-6">
        <h2 className="text-2xl font-bold mb-4 text-red-600">Ruxsat Yo'q</h2>
        <p className="text-gray-700 text-base mb-4">
          Iltimos botga start bosib keyin yana urinib ko'ring
        </p>

        <button
          onClick={retry}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg text-base shadow hover:bg-blue-700"
        >
          Qayta urinish
        </button>
      </div>
    );
  }

  // ACCESS GRANTED → show app
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Card style={{ borderRadius: 0 }} className="h-25 flex flex-col justify-end">
        <NavBar>{title}</NavBar>
      </Card>

      <div style={{ flex: 1, overflow: 'auto' }}>
        <Outlet />
      </div>

      <Card
        style={{
          padding: '0px',
          transform: isInputFocused ? 'translateY(100%)' : 'translateY(0)',
          opacity: isInputFocused ? 0 : 1,
          transition: 'transform 0.3s ease-in-out, opacity 0.3s ease-in-out',
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          pointerEvents: isInputFocused ? 'none' : 'auto',
        }}
      >
        <TabBar
          activeKey={location.pathname}
          onChange={value => navigate(value)}
        >
          {tabs.map(item => (
            <TabBar.Item
              key={item.key}
              icon={item.icon}
              title={<span className="text-base">{item.title}</span>}
            />
          ))}
        </TabBar>
      </Card>
    </div>
  );
}
