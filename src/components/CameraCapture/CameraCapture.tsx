import { useRef, useState } from 'react';
import { Button, Dialog } from 'antd-mobile';
import { Camera, X, Circle } from 'lucide-react';
import { useCamera } from '@/contexts/CameraContext';

interface CameraCaptureProps {
  onCapture: (imageData: string) => void;
  buttonText?: string;
  buttonColor?: 'primary' | 'success' | 'warning' | 'danger' | 'default';
  buttonSize?: 'mini' | 'small' | 'middle' | 'large';
  buttonBlock?: boolean;
  showIcon?: boolean;
}

export function CameraCapture({
  onCapture,
  buttonText = 'Open Camera',
  buttonColor = 'primary',
  buttonSize = 'large',
  buttonBlock = true,
  showIcon = true,
}: CameraCaptureProps) {
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const { requestCameraAccess } = useCamera();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const openCamera = async () => {
    try {
      setIsCameraOpen(true);

      // Wait for next frame to ensure video element is rendered
      await new Promise(resolve => setTimeout(resolve, 100));

      // Use global camera context
      const stream = await requestCameraAccess();

      if (!stream) {
        throw new Error('Failed to get camera stream');
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Ensure video plays
        await videoRef.current.play();
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      setIsCameraOpen(false);
      void Dialog.alert({
        content: 'Unable to access camera. Please check permissions.',
        confirmText: 'OK',
      });
    }
  };

  const closeCamera = () => {
    // Just hide the camera UI - stream managed globally
    setIsCameraOpen(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = canvas.toDataURL('image/png');

        // Emit the captured image to parent
        onCapture(imageData);

        // Close the camera
        closeCamera();
      }
    }
  };

  return (
    <>
      <Button
        color={buttonColor}
        size={buttonSize}
        block={buttonBlock}
        onClick={openCamera}
      >
        {showIcon && <Camera size={20} style={{ marginRight: '8px' }} />}
        {buttonText}
      </Button>

      {/* Camera Modal */}
      {isCameraOpen && (
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
              video.play().catch(err => console.error('Error playing video:', err));
            }}
          />

          <div
            style={{
              position: 'absolute',
              bottom: '40px',
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
              onClick={closeCamera}
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
              onClick={capturePhoto}
              style={{
                width: '60px',
                height: '60px',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Circle size={50} />
            </Button>
          </div>

          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>
      )}
    </>
  );
}
