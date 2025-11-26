import { Outlet } from 'react-router-dom';
import { Card, NavBar, TabBar } from 'antd-mobile';
import { useNavigate, useLocation } from 'react-router-dom';
import { usePageContext } from '@/contexts/PageContext';
import { Car, House, User } from 'lucide-react';
import { useEffect, useState } from 'react';

export function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { title } = usePageContext();
  const [isInputFocused, setIsInputFocused] = useState(false);

  // Hide navbar when input/textarea is focused
  useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        setIsInputFocused(true);
      }
    };

    const handleFocusOut = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
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
    {
      key: '/',
      title: 'Home',
      icon: <House />,
    },
    {
      key: '/vehicles',
      icon: <Car />,
      title: 'Moshina',
    },
    {
      key: '/ton-connect',
      title: 'Me',
      icon: <User />,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>

      <Card style={{ borderRadius: 0 }} className='h-25 flex flex-col justify-end'>
        <NavBar>
          {title}
        </NavBar>
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
        <TabBar activeKey={location.pathname} onChange={value => navigate(value)}>
          {tabs.map(item => (
            <TabBar.Item
              key={item.key}
              icon={item.icon}
              title={<span className='text-base'>{item.title}</span>}
            />
          ))}
        </TabBar>
      </Card>
    </div>
  );
}
