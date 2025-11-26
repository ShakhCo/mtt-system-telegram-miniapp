import type { FC } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Dialog, Grid, Image, Input, Radio, Space, Toast } from 'antd-mobile';
import { X, Circle } from 'lucide-react';

import { Page } from '@/components/Page.tsx';
import { useCamera } from '@/contexts/CameraContext';

interface RecognitionResult {
  plate_number: string;
  confidence: number;
  success: boolean;
  error_message?: string;
}

type LoadStatus = 'EMPTY' | 'LOADED';

export const ExitEntryPage: FC = () => {
  const navigate = useNavigate();
  const { requestCameraAccess } = useCamera();

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmittingExit, setIsSubmittingExit] = useState(false);
  const [allPhotos, setAllPhotos] = useState<string[]>([]);
  const [currentProcessingIndex, setCurrentProcessingIndex] = useState<number>(-1);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [recognitionResult, setRecognitionResult] = useState<RecognitionResult | null>(null);
  const [plateNumber, setPlateNumber] = useState<string>('');
  const [exitLoadStatus, setExitLoadStatus] = useState<LoadStatus>('EMPTY');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Auto-open camera on mount
  useEffect(() => {
    console.log('[ExitEntry] Component mounted, opening camera...');
    void openCamera();
  }, []);

  const openCamera = async () => {
    try {
      console.log('[ExitEntry] Opening camera...');
      setIsCameraOpen(true);
      setIsCameraLoading(true);

      // Wait for video element to be rendered
      await new Promise(resolve => setTimeout(resolve, 150));

      // Request camera access from global context
      const stream = await requestCameraAccess();

      if (!stream) {
        throw new Error('Failed to get camera stream');
      }

      console.log('[ExitEntry] Camera stream obtained, tracks:', stream.getTracks().length);

      if (videoRef.current) {
        console.log('[ExitEntry] Setting video source...');
        videoRef.current.srcObject = stream;

        // Play video immediately after setting source
        try {
          await videoRef.current.play();
          console.log('[ExitEntry] Video playing successfully');
          setIsCameraLoading(false);
        } catch (playError) {
          console.error('[ExitEntry] Error playing video:', playError);
          setIsCameraLoading(false);
        }
      } else {
        console.error('[ExitEntry] Video ref is not available');
        setIsCameraLoading(false);
        throw new Error('Video element not found');
      }
    } catch (error) {
      console.error('[ExitEntry] Error accessing camera:', error);
      setIsCameraLoading(false);
      setIsCameraOpen(false);
      void Dialog.alert({
        content: `Unable to access camera: ${error instanceof Error ? error.message : 'Unknown error'}`,
        confirmText: 'OK',
        onConfirm: () => {
          navigate('/vehicles');
        },
      });
    }
  };

  const capturePhoto = async () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      // Reduce resolution to save storage space
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
        // Use JPEG with 0.7 quality to reduce size significantly
        const imageData = canvas.toDataURL('image/jpeg', 0.7);
        console.log('Captured image size:', (imageData.length / 1024).toFixed(2), 'KB');

        // Add photo to collection
        const photoIndex = allPhotos.length;
        setAllPhotos(prev => [...prev, imageData]);
        console.log('Photo added to collection, processing immediately...');

        // Process this photo immediately
        await processPhoto(imageData, photoIndex);
      }
    }
  };

  const deletePhoto = async (index: number) => {
    const photoToDelete = allPhotos[index];

    // Remove the photo from the array first
    setAllPhotos(prev => prev.filter((_, i) => i !== index));

    // If deleting the successful photo, clear the result and reopen camera
    if (photoToDelete === capturedImage && recognitionResult?.success) {
      console.log('Deleting successful photo - clearing result to restart search');
      setCapturedImage(null);
      setRecognitionResult(null);
      setPlateNumber('');
      // Reopen camera to continue capturing
      await openCamera();
    }
  };

  const processPhoto = async (imageData: string, photoIndex: number) => {
    // If already found a result, don't process more photos
    if (recognitionResult && recognitionResult.success) {
      console.log('Plate already found, skipping processing');
      return;
    }

    setIsSubmitting(true);
    setCurrentProcessingIndex(photoIndex);
    console.log(`Processing photo ${photoIndex + 1}...`);

    try {
      const result = await submitPhotoWithImage(imageData);

      // If successful, save result but KEEP camera open
      if (result && result.success) {
        console.log('Plate number found in photo', photoIndex + 1);
        setCapturedImage(imageData);
        setRecognitionResult(result);
        setPlateNumber(result.plate_number); // Update editable plate number
        // Don't close camera - let user continue capturing
        setIsSubmitting(false);
        setCurrentProcessingIndex(-1);
        return;
      }

      // If not successful, keep camera open for next photo
      console.log('No plate found in photo', photoIndex + 1, '- ready for next photo');
      setIsSubmitting(false);
      setCurrentProcessingIndex(-1);
    } catch (error) {
      console.error('Error processing photo:', error);
      setIsSubmitting(false);
      setCurrentProcessingIndex(-1);
    }
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

  const submitPhotoWithImage = async (imageData: string): Promise<RecognitionResult | null> => {
    try {
      // Convert base64 to blob
      const blob = base64ToBlob(imageData);

      // Create FormData
      const formData = new FormData();
      formData.append('image', blob, 'plate.png');
      formData.append('region', 'uz');

      console.log('Submitting image to API...');
      console.log('Blob size:', blob.size, 'bytes');

      const apiUrl = 'https://api-mtt.xlog.uz/api/terminal/plate-recognizer/recognize/';

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
        },
        body: formData,
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API error response:', errorText);
        return null;
      }

      const result = await response.json() as RecognitionResult;
      console.log('Recognition result:', result);
      return result;
    } catch (error) {
      console.error('Error submitting photo:', error);
      return null;
    }
  };

  const handleCameraCapture = async () => {
    await capturePhoto();
    // Camera stays open for more photos
  };

  const goBack = () => {
    // Just hide camera UI
    setIsCameraOpen(false);

    // If no photos taken, navigate back to vehicles list
    if (allPhotos.length === 0) {
      navigate('/vehicles');
    }
    // If photos exist, stay on page (just close camera view)
  };

  const handleBackNavigation = () => {
    if (isCameraOpen) {
      // Close camera if it's open
      goBack();
    } else {
      // Navigate back to vehicles list
      navigate('/vehicles');
    }
  };

  const submitExitEntry = async () => {
    if (!plateNumber.trim()) {
      Toast.show({ content: 'Илтимос, номер киритинг', icon: 'fail' });
      return;
    }

    if (allPhotos.length === 0) {
      Toast.show({ content: 'Илтимос, расм олинг', icon: 'fail' });
      return;
    }

    setIsSubmittingExit(true);

    try {
      console.log('Submitting exit entry for vehicle with plate:', plateNumber);

      // Create FormData to send files
      const formData = new FormData();

      // Add all photo files
      for (let i = 0; i < allPhotos.length; i++) {
        const base64 = allPhotos[i];
        const blob = base64ToBlob(base64);
        formData.append('exit_photo_files', blob, `exit_photo_${i + 1}.jpg`);
      }

      // Add license plate
      formData.append('license_plate', plateNumber.trim());

      // Add exit time
      formData.append('exit_time', new Date().toISOString());

      // Add exit load status
      formData.append('exit_load_status', exitLoadStatus);

      const response = await fetch('https://api-mtt.xlog.uz/api/vehicles/entries/exit/', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
        },
        body: formData,
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API error response:', errorText);

        // Try to parse error for better message
        try {
          const errorJson = JSON.parse(errorText) as { error?: { message?: string } };
          const errorMessage = errorJson.error?.message || 'Хатолик юз берди';
          Toast.show({ content: errorMessage, icon: 'fail', duration: 3000 });
        } catch {
          Toast.show({ content: 'Хатолик юз берди', icon: 'fail' });
        }
        return;
      }

      const result = await response.json() as unknown;
      console.log('Exit entry updated:', result);

      Toast.show({ content: 'Муваффақиятли чиқарилди!', icon: 'success' });

      // Navigate back to vehicles list after successful submission
      setTimeout(() => {
        navigate('/vehicles');
      }, 1000);
    } catch (error) {
      console.error('Error submitting exit entry:', error);
      Toast.show({ content: 'Хатолик: ' + (error instanceof Error ? error.message : 'Unknown'), icon: 'fail' });
    } finally {
      setIsSubmittingExit(false);
    }
  };

  return (
    <>
      {!isCameraOpen ? (
        <Page back={true} onBack={handleBackNavigation} title="Терминалдан чиқариш">
          <Space direction='vertical' block style={{ padding: '10px' }}>
            <Card title="Rasmlar">
              <Grid columns={3} gap={16}>
                {allPhotos.map((photo, photo_index) => {
                  const isSuccessfulPhoto = capturedImage === photo && recognitionResult?.success;

                  return (
                    <Grid.Item key={photo_index} className='relative'>
                      <Image
                        className={`rounded ${isSuccessfulPhoto ? 'border-2 border-primary' : ''}`}
                        fit={'cover'}
                        width={100}
                        height={100}
                        src={photo}
                      />
                      <div
                        onClick={() => void deletePhoto(photo_index)}
                        className='absolute top-1 -right-0.5 bg-red-500 rounded-full p-1'
                      >
                        <X size={14} />
                      </div>
                    </Grid.Item>
                  );
                })}

                {allPhotos.length === 0 && (
                  <Grid.Item span={3} className='h-24 flex items-center justify-center'>
                    <span className='text-neutral-500'>Hali rasmga olinmagan</span>
                  </Grid.Item>
                )}

                <Grid.Item span={3}>
                  <Button block onClick={openCamera}>
                    Kamera
                  </Button>
                </Grid.Item>
              </Grid>
            </Card>

            <Card title="Номер автомобиля">
              <Input
                value={plateNumber}
                onChange={setPlateNumber}
                placeholder='Номер автомобиля'
                clearable
              />
            </Card>

            <Card title="Состояние загрузки">
              <Radio.Group value={exitLoadStatus} onChange={(val) => setExitLoadStatus(val as LoadStatus)}>
                <Space direction='vertical' block>
                  <Radio value='EMPTY'>Пустой</Radio>
                  <Radio value='LOADED'>Загружен</Radio>
                </Space>
              </Radio.Group>
            </Card>

            {plateNumber.trim() && allPhotos.length > 0 && (
              <Button
                block
                color='success'
                size='large'
                onClick={submitExitEntry}
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
        <Page back={true} onBack={handleBackNavigation} title="Kamera">
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
            {/* Camera view - 80vh */}
            <div
              style={{
                height: '80vh',
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
                  video.play().catch(err => console.error('[ExitEntry] Error playing video on metadata:', err));
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
                  bottom: '20px',
                  left: 0,
                  right: 0,
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '20px',
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
                  disabled={isSubmitting}
                  style={{
                    width: '70px',
                    height: '70px',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    opacity: isSubmitting ? 0.5 : 1,
                  }}
                >
                  <Circle size={50} />
                </Button>

                <Button
                  shape='rounded'
                  color={recognitionResult?.success ? 'success' : 'default'}
                  size='large'
                  onClick={() => setIsCameraOpen(false)}
                  style={{
                    width: '60px',
                    height: '60px',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    fontSize: '14px',
                    fontWeight: 'bold',
                  }}
                >
                  Done
                </Button>
              </div>
            </div>

            {/* Photo thumbnails - 20vh */}
            <div
              style={{
                height: '20vh',
                backgroundColor: '#1a1a1a',
                display: 'flex',
                alignItems: 'center',
                padding: '0 12px',
                overflowX: 'auto',
                gap: '8px',
              }}
            >
              {allPhotos.length === 0 ? (
                <div
                  style={{
                    width: '100%',
                    textAlign: 'center',
                    color: '#666',
                  }}
                >
                  No photos captured yet
                </div>
              ) : (
                allPhotos.map((img, index) => {
                  const isSuccessfulPhoto = capturedImage === img && recognitionResult?.success;
                  const isProcessing = currentProcessingIndex === index;

                  return (
                    <div
                      key={index}
                      style={{
                        position: 'relative',
                        flexShrink: 0,
                        width: '100px',
                        height: '100px',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        border: isSuccessfulPhoto
                          ? '2px solid #00b578'
                          : isProcessing
                            ? '2px solid #1677ff'
                            : '2px solid #333',
                      }}
                    >
                      <img
                        src={img}
                        alt={`Photo ${index + 1}`}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          opacity: isProcessing ? 0.6 : 1,
                        }}
                      />
                      {isProcessing && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            backgroundColor: 'rgba(22, 119, 255, 0.9)',
                            color: 'white',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 'bold',
                          }}
                        >
                          Processing...
                        </div>
                      )}

                      {!isProcessing && (
                        <Button
                          color='danger'
                          fill='solid'
                          size='mini'
                          onClick={() => deletePhoto(index)}
                          style={{
                            position: 'absolute',
                            top: '4px',
                            right: '4px',
                            minWidth: '24px',
                            height: '24px',
                            padding: 0,
                            borderRadius: '50%',
                          }}
                        >
                          <X size={14} className='mx-auto' />
                        </Button>
                      )}
                      <div
                        style={{
                          position: 'absolute',
                          bottom: '4px',
                          left: '4px',
                          backgroundColor: 'rgba(0, 0, 0, 0.7)',
                          color: 'white',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: 'bold',
                        }}
                      >
                        {index + 1}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </div>
        </Page>
      )}
    </>
  );
};
