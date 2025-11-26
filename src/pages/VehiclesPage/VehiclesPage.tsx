import type { FC } from 'react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Image, List, InfiniteScroll, Space, Toast, ImageViewer, Popup, Grid } from 'antd-mobile';

import { Page } from '@/components/Page.tsx';

interface PhotoFile {
  id: string;
  file_url: string;
  original_filename: string;
  file_category: number;
  category_name: string;
  mime_type: string;
  size: number;
  size_mb: string;
  uploaded_by: number;
  uploaded_by_username: string;
  is_public: boolean;
  is_active: boolean;
  width: number;
  height: number;
  created_at: string;
  updated_at: string;
}

interface VehicleEntry {
  id: number;
  license_plate: string;
  entry_photos: PhotoFile[];
  entry_time: string;
  recorded_by: number;
  recorded_by_username: string;
  vehicle_type: 'LIGHT' | 'CARGO';
  visitor_type?: 'EMPLOYEE' | 'CUSTOMER' | 'GUEST';
  transport_type?: 'PLATFORM' | 'FURA' | 'PRICEP' | 'MINI_FURA' | 'ZIL' | 'GAZEL' | 'LABO';
  entry_load_status?: 'LOADED' | 'EMPTY';
  cargo_type?: 'CONTAINER' | 'FOOD' | 'METAL' | 'WOOD' | 'CHEMICAL' | 'EQUIPMENT' | 'OTHER';
  container_size?: '1x20F' | '2x20F' | '40F';
  container_load_status?: 'LOADED' | 'EMPTY';
  destination?: number;
  destination_name?: string;
  destination_zone?: string;
  exit_photo?: PhotoFile | null;
  exit_time?: string | null;
  exit_load_status?: 'LOADED' | 'EMPTY' | null;
  is_on_terminal: boolean;
  dwell_time_hours: number;
  created_at: string;
  updated_at: string;
}

interface VehicleEntriesResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: VehicleEntry[];
}

interface ChoiceOption {
  value: string;
  label: string;
}

interface ChoicesResponse {
  vehicle_types: ChoiceOption[];
  visitor_types: ChoiceOption[];
  transport_types: ChoiceOption[];
  load_statuses: ChoiceOption[];
  cargo_types: ChoiceOption[];
  container_sizes: ChoiceOption[];
}

export const VehiclesPage: FC = () => {
  const navigate = useNavigate();

  // List view state
  const [vehicleEntries, setVehicleEntries] = useState<VehicleEntry[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [hasMoreData, setHasMoreData] = useState(true);
  const [nextPageUrl, setNextPageUrl] = useState<string | null>(null);

  // Image viewer state
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerImages, setViewerImages] = useState<string[]>([]);
  const [viewerStartIndex, setViewerStartIndex] = useState(0);

  // Detail popup state
  const [detailPopupVisible, setDetailPopupVisible] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<VehicleEntry | null>(null);

  // Choices API state
  const [choices, setChoices] = useState<ChoicesResponse | null>(null);

  // Handle back navigation
  const handleBackNavigation = () => {
    if (detailPopupVisible) {
      // If detail popup is open, just close it
      setDetailPopupVisible(false);
      return;
    }
    // Otherwise, navigate back
    navigate(-1);
  };

  // Fetch choices from API
  const fetchChoices = async () => {
    try {
      const response = await fetch('https://api-mtt.xlog.uz/api/vehicles/choices/', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        console.error('Failed to fetch choices');
        return;
      }

      const data = await response.json() as ChoicesResponse;
      console.log('Choices loaded:', data);
      setChoices(data);
    } catch (error) {
      console.error('Error fetching choices:', error);
    }
  };

  // Fetch vehicle entries
  const fetchVehicleEntries = async (url?: string) => {
    if (isLoadingList) return;

    setIsLoadingList(true);
    try {
      const apiUrl = url || 'https://api-mtt.xlog.uz/api/vehicles/entries/';
      console.log('Fetching vehicle entries from:', apiUrl);

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API error response:', errorText);
        Toast.show({ content: 'Маълумотларни юклашда хатолик', icon: 'fail' });
        setIsLoadingList(false);
        return;
      }

      const data = await response.json() as VehicleEntriesResponse;
      console.log('Vehicle entries loaded:', data);

      if (url) {
        // Loading more data (pagination)
        setVehicleEntries(prev => [...prev, ...data.results]);
      } else {
        // Initial load
        setVehicleEntries(data.results);
      }

      setNextPageUrl(data.next);
      setHasMoreData(data.next !== null);
    } catch (error) {
      console.error('Error fetching vehicle entries:', error);
      Toast.show({ content: 'Маълумотларни юклашда хатолик', icon: 'fail' });
    } finally {
      setIsLoadingList(false);
    }
  };

  // Load initial data when component mounts
  useEffect(() => {
    void fetchChoices();
    void fetchVehicleEntries();
  }, []);

  // Load more data for infinite scroll
  const loadMore = async () => {
    if (nextPageUrl && hasMoreData && !isLoadingList) {
      await fetchVehicleEntries(nextPageUrl);
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('uz-UZ', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Helper function to get label from choices API
  const getLabelFromChoices = (choiceArray: ChoiceOption[] | undefined, value: string | undefined): string => {
    if (!choiceArray || !value) return '';
    const choice = choiceArray.find(c => c.value === value);
    return choice?.label || value;
  };

  // Get vehicle type label in Uzbek
  const getVehicleTypeLabel = (entry: VehicleEntry) => {
    if (!choices) {
      // Fallback to old static labels if choices not loaded yet
      if (entry.vehicle_type === 'LIGHT') {
        const visitorTypeMap: Record<string, string> = {
          'EMPLOYEE': 'Ходим',
          'CUSTOMER': 'Мижоз',
          'GUEST': 'Мехмон',
        };
        return `Енгил автомашина - ${visitorTypeMap[entry.visitor_type || ''] || ''}`;
      }

      if (entry.vehicle_type === 'CARGO') {
        const transportTypeMap: Record<string, string> = {
          'PLATFORM': 'Платформа',
          'FURA': 'Фура',
          'PRICEP': 'Прицеп',
          'MINI_FURA': 'Мини Фура',
          'ZIL': 'Зил',
          'GAZEL': 'Газель',
          'LABO': 'Лабо',
        };
        return `Юк машина - ${transportTypeMap[entry.transport_type || ''] || ''}`;
      }

      return entry.vehicle_type;
    }

    // Use API labels
    const vehicleTypeLabel = getLabelFromChoices(choices.vehicle_types, entry.vehicle_type);

    if (entry.vehicle_type === 'LIGHT') {
      const visitorTypeLabel = getLabelFromChoices(choices.visitor_types, entry.visitor_type);
      return `${vehicleTypeLabel} - ${visitorTypeLabel}`;
    }

    if (entry.vehicle_type === 'CARGO') {
      const transportTypeLabel = getLabelFromChoices(choices.transport_types, entry.transport_type);
      return `${vehicleTypeLabel} - ${transportTypeLabel}`;
    }

    return vehicleTypeLabel;
  };

  // Handle image click to open viewer
  const handleImageClick = (entry: VehicleEntry, startIndex = 0) => {
    if (entry.entry_photos.length > 0) {
      const imageUrls = entry.entry_photos.map(photo => photo.file_url);
      setViewerImages(imageUrls);
      setViewerStartIndex(startIndex);
      setViewerVisible(true);
    }
  };

  // Handle list item click to show details
  const handleItemClick = (entry: VehicleEntry) => {
    setSelectedEntry(entry);
    setDetailPopupVisible(true);
  };

  // Get detailed vehicle info for popup
  const getDetailedInfo = (entry: VehicleEntry) => {
    const details: { label: string; value: string }[] = [];

    // License plate
    details.push({ label: 'Давлат рақами', value: entry.license_plate });

    // Entry time
    details.push({ label: 'Кириш вақти', value: formatDate(entry.entry_time) });

    // Vehicle type
    details.push({ label: 'Мошина тури', value: getVehicleTypeLabel(entry) });

    // Status
    details.push({
      label: 'Ҳолати',
      value: entry.is_on_terminal ? 'Терминалда' : 'Чиқиб кетди',
    });

    // Destination
    if (entry.destination_name) {
      details.push({ label: 'Жой', value: entry.destination_name });
    }

    // Cargo type
    if (entry.cargo_type) {
      const cargoTypeLabel = choices
        ? getLabelFromChoices(choices.cargo_types, entry.cargo_type)
        : entry.cargo_type;
      details.push({ label: 'Юк тури', value: cargoTypeLabel });
    }

    // Container size
    if (entry.container_size) {
      const containerSizeLabel = choices
        ? getLabelFromChoices(choices.container_sizes, entry.container_size)
        : entry.container_size;
      details.push({ label: 'Контейнер ўлчами', value: containerSizeLabel });
    }

    // Load status
    if (entry.entry_load_status) {
      const loadStatusLabel = choices
        ? getLabelFromChoices(choices.load_statuses, entry.entry_load_status)
        : entry.entry_load_status;
      details.push({ label: 'Юкланиш ҳолати', value: loadStatusLabel });
    }

    // Container load status (if different from entry load status)
    if (entry.container_load_status && entry.container_load_status !== entry.entry_load_status) {
      const containerLoadStatusLabel = choices
        ? getLabelFromChoices(choices.load_statuses, entry.container_load_status)
        : entry.container_load_status;
      details.push({ label: 'Контейнер юкланиш ҳолати', value: containerLoadStatusLabel });
    }

    // Dwell time
    if (entry.dwell_time_hours > 0) {
      details.push({ label: 'Туриш вақти', value: `${entry.dwell_time_hours} соат` });
    }

    // Recorded by
    if (entry.recorded_by_username) {
      details.push({ label: 'Қайд қилган', value: entry.recorded_by_username });
    }

    // Exit time
    if (entry.exit_time) {
      details.push({ label: 'Чиқиш вақти', value: formatDate(entry.exit_time) });
    }

    // Exit load status
    if (entry.exit_load_status) {
      const exitLoadStatusLabel = choices
        ? getLabelFromChoices(choices.load_statuses, entry.exit_load_status)
        : entry.exit_load_status;
      details.push({ label: 'Чиқиш юкланиш ҳолати', value: exitLoadStatusLabel });
    }

    return details;
  };

  return (
    <Page back={true} onBack={handleBackNavigation} title="Машиналар рўйхати">

      <Grid columns={2} className='p-3' gap={12}>
        <Grid.Item>
          <Button
            block
            size='large'
            color='success'
            onClick={() => navigate('/vehicles/add-entry')}
            className='text-center'
          >
            Киритиш
          </Button>
        </Grid.Item>
        <Grid.Item>
          <Button
            block
            size='large'
            color='danger'
            className='text-center'
            onClick={() => {
              setDetailPopupVisible(false);
              navigate('/vehicles/exit-entry');
            }}
          >
            Чиқариш
          </Button>
        </Grid.Item>
      </Grid>

      <div style={{ paddingBottom: '80px' }}>
        {vehicleEntries.length === 0 && !isLoadingList ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#999' }}>
            <p>Хали хеч қандай машина қўшилмаган</p>
            <p style={{ fontSize: '14px', marginTop: '10px' }}>
              Машина қўшиш учун қуйидаги тугмани босинг
            </p>
          </div>
        ) : (
          <List>
            {vehicleEntries.map((entry) => (
              <List.Item
                key={entry.id}
                onClick={() => handleItemClick(entry)}
                prefix={
                  entry.entry_photos.length > 0 ? (
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        handleImageClick(entry, 0);
                      }}
                      style={{ cursor: 'pointer', position: 'relative' }}
                    >
                      <Image
                        src={entry.entry_photos[0].file_url}
                        style={{ borderRadius: 8 }}
                        fit='cover'
                        width={80}
                        height={80}
                      />
                      {entry.entry_photos.length > 1 && (
                        <div style={{
                          position: 'absolute',
                          bottom: 4,
                          right: 4,
                          backgroundColor: 'rgba(0, 0, 0, 0.6)',
                          color: 'white',
                          padding: '2px 6px',
                          borderRadius: 4,
                          fontSize: '11px',
                          fontWeight: 'bold',
                        }}>
                          +{entry.entry_photos.length - 1}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{
                      width: 80,
                      height: 80,
                      backgroundColor: '#f5f5f5',
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      color: '#999',
                    }}>
                      Расм йўқ
                    </div>
                  )
                } 
                description={
                  <Space direction='vertical' style={{ '--gap': '4px' }}>
                    <div className='text-base'>
                      {formatDate(entry.is_on_terminal ? entry.entry_time : entry.exit_time ? entry.exit_time : entry.entry_time)}
                    </div>
                    <div className='text-base' style={{
                      color: entry.is_on_terminal ? '#00b578' : '#999',
                    }}>
                      {entry.is_on_terminal ? 'Терминалда' : 'Чиқиб кетди'}
                    </div>
                  </Space>
                }
              >
                <div className='font-bold text-lg'>
                  {entry.license_plate}
                </div>
              </List.Item>
            ))}
          </List>
        )}

        <InfiniteScroll loadMore={loadMore} hasMore={hasMoreData}>
          {hasMoreData ? 'Юкланмоқда...' : vehicleEntries.length > 0 ? 'Барчаси юкланди' : ''}
        </InfiniteScroll>
      </div>


      {/* Image Viewer */}
      <ImageViewer.Multi
        images={viewerImages}
        visible={viewerVisible}
        defaultIndex={viewerStartIndex}
        onClose={() => {
          setViewerVisible(false);
        }}
      />

      {/* Detail Popup */}
      <Popup
        visible={detailPopupVisible}
        onMaskClick={() => {
          setDetailPopupVisible(false);
        }}
        onClose={() => {
          setDetailPopupVisible(false);
        }}
        bodyStyle={{
          borderTopLeftRadius: '16px',
          borderTopRightRadius: '16px',
          minHeight: '50vh',
          maxHeight: '80vh',
          overflowY: 'auto',
        }}
      >
        {selectedEntry && (
          <div style={{ padding: '20px' }}>
            {/* Title */}
            <div style={{
              fontSize: '20px',
              fontWeight: 'bold',
              marginBottom: '16px',
              paddingBottom: '12px',
              borderBottom: '1px solid #f0f0f0',
            }}>
              Машина маълумотлари
            </div>



            {/* Details List */}
            <Space direction='vertical' block style={{ '--gap': '12px' }}>

              {getDetailedInfo(selectedEntry).map((detail, index) => (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    paddingBottom: '12px',
                    borderBottom: '1px solid #f5f5f5',
                  }}
                >
                  <div style={{
                    fontSize: '14px',
                    color: '#999',
                    flex: '0 0 40%',
                  }}>
                    {detail.label}
                  </div>
                  <div style={{
                    fontSize: '14px',
                    color: '#333',
                    fontWeight: '500',
                    flex: '1',
                    textAlign: 'right',
                  }}>
                    {detail.value}
                  </div>
                </div>
              ))}
            </Space>

            {selectedEntry?.is_on_terminal && (
              <div className='my-5'>
                <Button
                  block
                  color='primary'
                  onClick={() => {
                    setDetailPopupVisible(false);
                    navigate('/vehicles/exit-entry');
                  }}
                >
                  Terminaldan Chiqarish
                </Button>
              </div>
            )}
          </div>
        )}
      </Popup>
    </Page>
  );
};
