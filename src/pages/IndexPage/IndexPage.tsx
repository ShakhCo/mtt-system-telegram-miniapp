import type { FC } from 'react';
import { useEffect, useState } from 'react';

import { Page } from '@/components/Page.tsx';
import { Card, Space, List, Tag, DotLoading } from 'antd-mobile';
import { initData, useSignal } from '@tma.js/sdk-react';

interface VehicleTypeData {
  count: number;
  label: string;
}

interface Statistics {
  current: {
    total_on_terminal: number;
    by_vehicle_type: Record<string, VehicleTypeData>;
    by_transport_type: Record<string, VehicleTypeData>;
    by_load_status: Record<string, VehicleTypeData>;
  };
  time_metrics: {
    avg_dwell_hours: number;
    avg_dwell_by_type: Record<string, number>;
    longest_current_stay: {
      license_plate: string;
      hours: number;
      vehicle_type: string;
    };
  };
  overstayers: {
    threshold_hours: number;
    count: number;
    vehicles: Array<{
      license_plate: string;
      hours: number;
      vehicle_type: string;
    }>;
  };
  last_30_days: {
    total_entries: number;
    total_exits: number;
    entries_by_day: Array<{
      date: string;
      count: number;
    }>;
  };
}

export const IndexPage: FC = () => {
  const initDataState = useSignal(initData.state);
  const user = initDataState?.user;
  const firstName = `${user?.first_name}` || 'Guest';

  const [stats, setStats] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStatistics = async () => {
      try {
        setLoading(true);
        const response = await fetch('https://api-mtt.xlog.uz/api/vehicles/statistics/');
        if (!response.ok) {
          throw new Error('Failed to fetch statistics');
        }
        const data = await response.json();
        setStats(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchStatistics();
  }, []);

  return (
    <Page back={false} title="Home">
      <Space direction='vertical' block style={{ padding: '10px' }}>

        <Card title={`Assalamu alaykum, ${firstName}!`}>
          <span className='text-base'>
            Welcome to the Vehicle Management System
          </span>
        </Card>

        {loading && (
          <Card>
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <DotLoading color='primary' />
              <div style={{ marginTop: '10px' }}>Loading statistics...</div>
            </div>
          </Card>
        )}

        {error && (
          <Card>
            <div style={{ color: 'var(--adm-color-danger)', textAlign: 'center' }}>
              Error: {error}
            </div>
          </Card>
        )}

        {stats && !loading && (
          <Space direction='vertical' block>
            <Card title="Current Terminal Status">
              <List>
                <List.Item
                  extra={<Tag color='primary' fill='solid'>{stats.current.total_on_terminal}</Tag>}
                >
                  Total Vehicles on Terminal
                </List.Item>
              </List>
            </Card>

            <Card title="By Vehicle Type">
              <List>
                {Object.entries(stats.current.by_vehicle_type).map(([key, value]) => (
                  <List.Item
                    key={key}
                    extra={<Tag color='primary'>{value.count}</Tag>}
                  >
                    {value.label}
                  </List.Item>
                ))}
              </List>
            </Card>

            <Card title="By Transport Type">
              <List>
                {Object.entries(stats.current.by_transport_type).map(([key, value]) => (
                  <List.Item
                    key={key}
                    extra={<Tag color='success'>{value.count}</Tag>}
                  >
                    {value.label}
                  </List.Item>
                ))}
              </List>
            </Card>

            <Card title="By Load Status">
              <List>
                {Object.entries(stats.current.by_load_status).map(([key, value]) => (
                  <List.Item
                    key={key}
                    extra={<Tag color='warning'>{value.count}</Tag>}
                  >
                    {value.label}
                  </List.Item>
                ))}
              </List>
            </Card>

            <Card title="Time Metrics">
              <List>
                <List.Item
                  extra={`${stats.time_metrics.avg_dwell_hours.toFixed(1)} hrs`}
                >
                  Average Dwell Time
                </List.Item>
                {Object.entries(stats.time_metrics.avg_dwell_by_type).map(([type, hours]) => (
                  <List.Item
                    key={type}
                    extra={`${hours.toFixed(1)} hrs`}
                    description={`Average for ${type}`}
                  >
                    {type}
                  </List.Item>
                ))}
                <List.Item
                  extra={`${stats.time_metrics.longest_current_stay.hours.toFixed(1)} hrs`}
                  description={`Vehicle: ${stats.time_metrics.longest_current_stay.license_plate}`}
                >
                  Longest Current Stay
                </List.Item>
              </List>
            </Card>

            {stats.overstayers.count > 0 && (
              <Card title={`Overstayers (>${stats.overstayers.threshold_hours}h)`}>
                <List>
                  {stats.overstayers.vehicles.map((vehicle) => (
                    <List.Item
                      key={vehicle.license_plate}
                      extra={<Tag color='danger'>{vehicle.hours.toFixed(1)} hrs</Tag>}
                      description={vehicle.vehicle_type}
                    >
                      {vehicle.license_plate}
                    </List.Item>
                  ))}
                </List>
              </Card>
            )}

            <Card title="Last 30 Days Activity">
              <List>
                <List.Item extra={stats.last_30_days.total_entries}>
                  Total Entries
                </List.Item>
                <List.Item extra={stats.last_30_days.total_exits}>
                  Total Exits
                </List.Item>
              </List>
              <div style={{ marginTop: '16px' }}>
                <strong>Recent Daily Entries:</strong>
                <List>
                  {stats.last_30_days.entries_by_day.map((entry) => (
                    <List.Item
                      key={entry.date}
                      extra={<Tag>{entry.count}</Tag>}
                    >
                      {entry.date}
                    </List.Item>
                  ))}
                </List>
              </div>
            </Card>
          </Space>
        )}
      </Space>
    </Page>
  );
};
