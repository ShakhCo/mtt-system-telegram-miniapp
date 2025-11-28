import type { FC } from 'react';
import { useEffect, useState } from 'react';

import { Page } from '@/components/Page.tsx';
import { Card, Space, List, Tag, DotLoading } from 'antd-mobile';

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
      <Space direction='vertical' block style={{ padding: '10px', paddingBottom: '100px' }}>

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

        {stats && !loading && stats.current && stats.current.total_on_terminal !== undefined && stats.current.total_on_terminal !== null && (
          <List header="Терминалдаги ҳозирги ҳолат">
            <List.Item
              extra={<Tag color='primary' fill='solid' style={{ fontSize: '16px' }}>{stats.current.total_on_terminal}</Tag>}
            >
              Терминалдаги жами транспорт
            </List.Item>
          </List>
        )}

        {stats && !loading && stats.current && stats.current.by_vehicle_type && (
          <List header="Транспорт тури бўйича">
            {Object.entries(stats.current.by_vehicle_type).map(([key, value]) => (
              <List.Item
                key={key}
                extra={<Tag color='primary' style={{ fontSize: '15px' }}>{value.count}</Tag>}
              >
                {value.label}
              </List.Item>
            ))}
          </List>
        )}

        {stats && !loading && stats.current && stats.current.by_transport_type && (
          <List header="Ташиш тури бўйича">
            {Object.entries(stats.current.by_transport_type).map(([key, value]) => (
              <List.Item
                key={key}
                extra={<Tag color='success' style={{ fontSize: '15px' }}>{value.count}</Tag>}
              >
                {value.label}
              </List.Item>
            ))}
          </List>
        )}

        {stats && !loading && stats.current && stats.current.by_load_status && (
          <List header="Юк ҳолати бўйича">
            {Object.entries(stats.current.by_load_status).map(([key, value]) => (
              <List.Item
                key={key}
                extra={<Tag color='warning' style={{ fontSize: '15px' }}>{value.count}</Tag>}
              >
                {value.label}
              </List.Item>
            ))}
          </List>
        )}

        {stats && !loading && stats.time_metrics && (
          <List header="Вақт кўрсаткичлари">
            {stats.time_metrics.avg_dwell_hours !== undefined && stats.time_metrics.avg_dwell_hours !== null && (
              <List.Item
                extra={<span style={{ fontSize: '15px' }}>{stats.time_metrics.avg_dwell_hours.toFixed(1)} соат</span>}
              >
                Ўртача турган вақти
              </List.Item>
            )}
            {stats.time_metrics.avg_dwell_by_type && Object.entries(stats.time_metrics.avg_dwell_by_type).map(([type, hours]) => (
              <List.Item
                key={type}
                extra={<span style={{ fontSize: '15px' }}>{hours.toFixed(1)} соат</span>}
                description={`${type} учун ўртача`}
              >
                {type}
              </List.Item>
            ))}
            {stats.time_metrics.longest_current_stay && stats.time_metrics.longest_current_stay.hours !== undefined && stats.time_metrics.longest_current_stay.license_plate && (
              <List.Item
                extra={<span style={{ fontSize: '15px' }}>{stats.time_metrics.longest_current_stay.hours.toFixed(1)} соат</span>}
                description={`Транспорт: ${stats.time_metrics.longest_current_stay.license_plate}`}
              >
                Энг узоқ турган
              </List.Item>
            )}
          </List>
        )}

        {stats && !loading && stats.overstayers && stats.overstayers.count > 0 && stats.overstayers.vehicles && stats.overstayers.threshold_hours !== undefined && (
          <List header={`Муддатидан ошганлар (>${stats.overstayers.threshold_hours}с)`}>
            {stats.overstayers.vehicles.map((vehicle) => (
              <List.Item
                key={vehicle.license_plate}
                extra={<Tag color='danger' style={{ fontSize: '15px' }}>{vehicle.hours.toFixed(1)} соат</Tag>}
                description={vehicle.vehicle_type}
              >
                {vehicle.license_plate}
              </List.Item>
            ))}
          </List>
        )}

        {stats && !loading && stats.last_30_days && (
          <List header="Сўнгги 30 кунлик фаолият">
            {stats.last_30_days.total_entries !== undefined && stats.last_30_days.total_entries !== null && (
              <List.Item extra={<span style={{ fontSize: '16px', fontWeight: '500' }}>{stats.last_30_days.total_entries}</span>}>
                Жами кирганлар
              </List.Item>
            )}
            {stats.last_30_days.total_exits !== undefined && stats.last_30_days.total_exits !== null && (
              <List.Item extra={<span style={{ fontSize: '16px', fontWeight: '500' }}>{stats.last_30_days.total_exits}</span>}>
                Жами чиққанлар
              </List.Item>
            )}
          </List>
        )}

        {stats && !loading && stats.last_30_days && stats.last_30_days.entries_by_day && (
          <List header="Сўнгги кунлик киришлар">
            {stats.last_30_days.entries_by_day.map((entry) => (
              <List.Item
                key={entry.date}
                extra={<Tag style={{ fontSize: '14px' }}>{entry.count}</Tag>}
              >
                {entry.date}
              </List.Item>
            ))}
          </List>
        )}
      </Space>
    </Page>
  );
};
