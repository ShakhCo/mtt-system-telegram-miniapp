import { useRef, useCallback } from 'react';
import { useCamera } from '@/contexts/CameraContext';

/**
 * Hook to simplify camera capture in any component
 * Provides functions to open camera, capture photos, and manage camera state
 */
export function useCameraCapture() {
  const { requestCameraAccess, stopCamera, isCameraActive } = useCamera();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  /**
   * Initialize camera and attach to video element
   */
  const initializeCamera = useCallback(async (): Promise<boolean> => {
    try {
      const stream = await requestCameraAccess();
      if (!stream) {
        return false;
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to initialize camera:', error);
      return false;
    }
  }, [requestCameraAccess]);

  /**
   * Capture photo from video stream
   * @param quality - JPEG quality (0.0 to 1.0, default 0.7)
   * @param maxWidth - Maximum width in pixels (default 1280)
   * @param maxHeight - Maximum height in pixels (default 720)
   * @returns Base64 encoded image data
   */
  const capturePhoto = useCallback(
    (quality = 0.7, maxWidth = 1280, maxHeight = 720): string | null => {
      if (!videoRef.current || !canvasRef.current) {
        console.error('Video or canvas ref not available');
        return null;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;

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
      if (!context) {
        console.error('Failed to get canvas context');
        return null;
      }

      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = canvas.toDataURL('image/jpeg', quality);

      return imageData;
    },
    []
  );

  return {
    videoRef,
    canvasRef,
    initializeCamera,
    capturePhoto,
    stopCamera,
    isCameraActive,
  };
}
