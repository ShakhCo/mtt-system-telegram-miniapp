import type { FC } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Dialog, Grid, Image, Input, Radio, Space, Toast, Loading } from 'antd-mobile';
import { X, Circle, Camera } from 'lucide-react';

import { Page } from '@/components/Page.tsx';
import { useCamera } from '@/contexts/CameraContext';

interface Customer {
  id: number;
  name: string;
  phone: string;
}

interface VehicleEntry {
  id: number;
  status: 'WAITING' | 'ON_TERMINAL' | 'EXITED';
  status_display: string;
  license_plate: string;
  vehicle_type: 'LIGHT' | 'CARGO';
  vehicle_type_display: string;
  customer: Customer | null;
  created_at: string;
}

interface RecognitionResult {
  plate_number: string;
  confidence: number;
  success: boolean;
  error_message?: string;
}

type LoadStatus = 'EMPTY' | 'LOADED';

export const ExitByIdPage: FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { requestCameraAccess } = useCamera();

  // Vehicle data state
  const [vehicleData, setVehicleData] = useState<VehicleEntry | null>(null);
  const [isLoadingVehicle, setIsLoadingVehicle] = useState(true);

  // Camera state
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const [isSubmittingExit, setIsSubmittingExit] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [plateNumber, setPlateNumber] = useState<string>('');
  const [exitLoadStatus, setExitLoadStatus] = useState<LoadStatus>('EMPTY');
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [_recognitionResult, setRecognitionResult] = useState<RecognitionResult | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Fetch vehicle data on mount
  useEffect(() => {
    if (id) {
      void fetchVehicleData(id);
    }
  }, [id]);

  const fetchVehicleData = async (vehicleId: string) => {
    setIsLoadingVehicle(true);
    try {
      const response = await fetch(`https://api-mtt.xlog.uz/api/vehicles/entries/${vehicleId}/`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        Toast.show({ content: 'Маълумот топилмади', icon: 'fail' });
        navigate('/vehicles');
        return;
      }

      const data = await response.json() as VehicleEntry;
      setVehicleData(data);
    } catch (error) {
      console.error('Error fetching vehicle:', error);
      Toast.show({ content: 'Хатолик юз берди', icon: 'fail' });
      navigate('/vehicles');
    } finally {
      setIsLoadingVehicle(false);
    }
  };

  const openCamera = async () => {
    try {
      setIsCameraOpen(true);
      setIsCameraLoading(true);

      await new Promise(resolve => setTimeout(resolve, 150));

      const stream = await requestCameraAccess();

      if (!stream) {
        throw new Error('Failed to get camera stream');
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;

        try {
          await videoRef.current.play();
          setIsCameraLoading(false);
        } catch (playError) {
          console.error('Error playing video:', playError);
          setIsCameraLoading(false);
        }
      } else {
        setIsCameraLoading(false);
        throw new Error('Video element not found');
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      setIsCameraLoading(false);
      setIsCameraOpen(false);
      void Dialog.alert({
        content: `Камерага кириш имкони бўлмади: ${error instanceof Error ? error.message : 'Unknown error'}`,
        confirmText: 'OK',
      });
    }
  };

  const capturePhoto = (): string | null => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      const maxWidth = 1280;
      const maxHeight = 720;
      const aspectRatio = video.videoWidth / video.videoHeight;

      if (video.videoWidth > maxWidth) {
        canvas.width = maxWidth;
        canvas.height = maxWidth / aspectRatio;
      } else if (video.videoHeight > maxHeight) {
        canvas.height = maxHeight;
        canvas.width = maxHeight * aspectRatio;
      } else {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = canvas.toDataURL('image/jpeg', 0.7);
        setCapturedPhoto(imageData);
        setIsCameraOpen(false);
        return imageData;
      }
    }
    return null;
  };

  const deletePhoto = () => {
    setCapturedPhoto(null);
    setRecognitionResult(null);
    setPlateNumber('');
  };

  const base64ToBlob = (base64: string): Blob => {
    const arr = base64.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  };

  const recognizePlate = async (imageData: string): Promise<RecognitionResult | null> => {
    try {
      const blob = base64ToBlob(imageData);
      const formData = new FormData();
      formData.append('image', blob, 'plate.jpg');
      formData.append('region', 'uz');

      const apiUrl = 'https://api-mtt.xlog.uz/api/terminal/plate-recognizer/recognize/';

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
        },
        body: formData,
      });

      if (!response.ok) {
        console.error('Plate recognition API error:', response.status);
        return null;
      }

      const result = await response.json() as RecognitionResult;
      return result;
    } catch (error) {
      console.error('Error recognizing plate:', error);
      return null;
    }
  };

  const handleCameraCapture = async () => {
    const imageData = capturePhoto();
    if (imageData) {
      setIsRecognizing(true);
      setRecognitionResult(null);

      const result = await recognizePlate(imageData);

      if (result && result.success) {
        setRecognitionResult(result);

        // Compare recognized plate with vehicle's license plate
        const recognizedPlate = result.plate_number.replace(/\s+/g, '').toUpperCase();
        const vehiclePlate = (vehicleData?.license_plate || '').replace(/\s+/g, '').toUpperCase();

        if (vehiclePlate && recognizedPlate !== vehiclePlate) {
          // Plate doesn't match - show recognized plate so user can see what was detected
          Toast.show({
            content: `Рақам мос келмади! Аниқланган: ${result.plate_number}, Кутилган: ${vehicleData?.license_plate}`,
            icon: 'fail',
            duration: 3000,
          });
        }
        // Always set the recognized plate number
        setPlateNumber(result.plate_number);
      } else {
        // Recognition failed
        setRecognitionResult(result);
        Toast.show({
          content: 'Рақам аниқланмади. Илтимос, қўлда киритинг',
          icon: 'fail',
          duration: 2000,
        });
      }

      setIsRecognizing(false);
    }
  };

  const goBack = () => {
    setIsCameraOpen(false);
  };

  const handleBackNavigation = () => {
    if (isCameraOpen) {
      goBack();
    } else {
      navigate('/vehicles');
    }
  };

  const submitExit = async () => {
    if (!capturedPhoto) {
      Toast.show({ content: 'Илтимос, расм олинг', icon: 'fail' });
      return;
    }

    if (!plateNumber.trim()) {
      Toast.show({ content: 'Илтимос, давлат рақамини киритинг', icon: 'fail' });
      return;
    }

    setIsSubmittingExit(true);

    try {
      const formData = new FormData();

      // Add license plate
      formData.append('license_plate', plateNumber.trim());

      // Add exit time
      formData.append('exit_time', new Date().toISOString());

      // Add exit load status
      formData.append('exit_load_status', exitLoadStatus);

      // Add photo file
      const blob = base64ToBlob(capturedPhoto);
      formData.append('exit_photo_files', blob, 'exit_photo_1.jpg');

      const response = await fetch('https://api-mtt.xlog.uz/api/vehicles/entries/exit/', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API error response:', errorText);

        try {
          const errorJson = JSON.parse(errorText) as { error?: { message?: string } };
          const errorMessage = errorJson.error?.message || 'Хатолик юз берди';
          Toast.show({ content: errorMessage, icon: 'fail', duration: 3000 });
        } catch {
          Toast.show({ content: 'Хатолик юз берди', icon: 'fail' });
        }
        return;
      }

      Toast.show({ content: 'Муваффақиятли чиқарилди!', icon: 'success' });

      setTimeout(() => {
        navigate('/vehicles');
      }, 1000);
    } catch (error) {
      console.error('Error submitting exit:', error);
      Toast.show({ content: 'Хатолик: ' + (error instanceof Error ? error.message : 'Unknown'), icon: 'fail' });
    } finally {
      setIsSubmittingExit(false);
    }
  };

  if (isLoadingVehicle) {
    return (
      <Page back={true} onBack={() => navigate('/vehicles')} title="Чиқариш">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
          <Loading color="primary" />
        </div>
      </Page>
    );
  }

  return (
    <>
      {!isCameraOpen ? (
        <Page back={true} onBack={handleBackNavigation} title="Чиқариш">
          <Space direction='vertical' block style={{ padding: '10px', paddingBottom: '100px' }}>
            {/* Vehicle Info Card */}
            {vehicleData && (
              <Card title="Машина маълумотлари">
                <Grid columns={1} gap={16}>
                  <Grid.Item>
                    <div className='text-base'>{vehicleData.license_plate}</div>
                    <div className='text-sm' style={{ color: '#999' }}>Давлат рақами</div>
                  </Grid.Item>
                  {vehicleData.customer && (
                    <>
                      <Grid.Item>
                        <div className='text-base'>{vehicleData.customer.name} ({vehicleData.customer.phone})</div>
                        <div className='text-sm' style={{ color: '#999' }}>Мижоз / Телефон</div>
                      </Grid.Item>
                    </>
                  )}
                </Grid>
              </Card>
            )}

            <Card title="Расм">
              {capturedPhoto ? (
                <div className='relative' style={{ display: 'inline-block' }}>
                  <Image
                    className='rounded'
                    fit={'cover'}
                    width={150}
                    height={150}
                    src={capturedPhoto}
                  />
                  <div
                    onClick={deletePhoto}
                    className='absolute top-1 right-1 bg-red-500 rounded-full p-1 cursor-pointer'
                  >
                    <X size={14} color='white' />
                  </div>
                </div>
              ) : (
                <Button block onClick={openCamera}>
                  <Camera size={18} style={{ marginRight: 8, display: 'inline' }} />
                  Расм олиш
                </Button>
              )}
            </Card>

            {/* Plate Number Card - shown after photo is captured */}
            {capturedPhoto && (
              <Card title="Давлат рақами">
                {isRecognizing ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Loading color="primary" />
                    <span style={{ color: '#999' }}>Рақам аниқланмоқда...</span>
                  </div>
                ) : (
                  <Input
                    value={plateNumber}
                    onChange={setPlateNumber}
                    placeholder="Давлат рақамини киритинг"
                    clearable
                  />
                )}
              </Card>
            )}

            {/* Load Status Card - shown after photo is captured */}
            {capturedPhoto && !isRecognizing && (
              <Card title="Юк ҳолати">
                <Radio.Group value={exitLoadStatus} onChange={(val) => setExitLoadStatus(val as LoadStatus)}>
                  <Space direction='vertical' block>
                    <Radio value='EMPTY'>Бўш</Radio>
                    <Radio value='LOADED'>Юкланган</Radio>
                  </Space>
                </Radio.Group>
              </Card>
            )}

            {capturedPhoto && plateNumber.trim() && !isRecognizing && (
              <Button
                block
                color='danger'
                size='large'
                onClick={submitExit}
                loading={isSubmittingExit}
                disabled={isSubmittingExit}
              >
                {isSubmittingExit ? 'Чиқарилмоқда...' : 'Чиқариш'}
              </Button>
            )}
          </Space>
        </Page>
      ) : null}

      {isCameraOpen && (
        <Page back={true} onBack={handleBackNavigation} title="Камера">
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'black',
              zIndex: 9999,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Camera view - full height */}
            <div
              style={{
                flex: 1,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
                onLoadedMetadata={(e) => {
                  const video = e.target as HTMLVideoElement;
                  video.play().catch(err => console.error('Error playing video on metadata:', err));
                }}
              />

              {/* Loading indicator */}
              {isCameraLoading && (
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  textAlign: 'center',
                  color: 'white',
                }}>
                  <div style={{
                    fontSize: '16px',
                    marginBottom: '12px',
                  }}>
                    Камера юкланмоқда...
                  </div>
                  <div style={{
                    fontSize: '14px',
                    opacity: 0.7,
                  }}>
                    Илтимос кутинг
                  </div>
                </div>
              )}

              {/* Camera controls overlay */}
              <div
                style={{
                  position: 'absolute',
                  bottom: '40px',
                  left: 0,
                  right: 0,
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '40px',
                }}
              >
                <Button
                  shape='rounded'
                  color='danger'
                  size='large'
                  onClick={goBack}
                  style={{
                    width: '60px',
                    height: '60px',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <X size={30} />
                </Button>

                <Button
                  shape='rounded'
                  color='primary'
                  size='large'
                  onClick={handleCameraCapture}
                  style={{
                    width: '80px',
                    height: '80px',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <Circle size={60} />
                </Button>
              </div>
            </div>

            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </div>
        </Page>
      )}
    </>
  );
};
