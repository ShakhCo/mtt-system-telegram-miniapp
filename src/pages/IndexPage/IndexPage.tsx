import type { FC } from 'react';

import { Page } from '@/components/Page.tsx';
import { Card, Space } from 'antd-mobile';
import { initData, useSignal } from '@tma.js/sdk-react';

export const IndexPage: FC = () => {
  const initDataState = useSignal(initData.state);
  const user = initDataState?.user;
  const firstName = `${user?.first_name}` || 'Guest';

  return (
    <Page back={false} title="Home">
      <Space direction='vertical' block style={{ padding: '10px' }}>
        <Card title={`Assalamu alaykum, ${firstName}!`}>
          <span className='text-base'>
            Welcome to the app
          </span>
        </Card>
      </Space>
    </Page>
  );
};
