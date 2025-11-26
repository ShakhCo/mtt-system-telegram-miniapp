import { createContext, useContext, useRef, useCallback, ReactNode, useState, useEffect } from 'react';

interface CameraContextType {
  streamRef: React.MutableRefObject<MediaStream | null>;
  requestCameraAccess: () => Promise<MediaStream | null>;
  stopCamera: () => void;
  isCameraActive: boolean;
}

const CameraContext = createContext<CameraContextType | undefined>(undefined);

export function CameraProvider({ children }: { children: ReactNode }) {
  const streamRef = useRef<MediaStream | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);

  // Request camera access - reuses existing stream if available
  const requestCameraAccess = useCallback(async (): Promise<MediaStream | null> => {
    try {
      // If stream already exists and is active, return it
      if (streamRef.current && streamRef.current.active) {
        console.log('[CameraContext] Reusing existing camera stream');
        setIsCameraActive(true);
        return streamRef.current;
      }

      console.log('[CameraContext] Requesting new camera stream...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false,
      });

      console.log('[CameraContext] Camera stream obtained');
      streamRef.current = stream;
      setIsCameraActive(true);

      // Listen for stream ending (e.g., if user revokes permission)
      stream.getTracks().forEach(track => {
        track.onended = () => {
          console.log('[CameraContext] Camera track ended');
          setIsCameraActive(false);
          streamRef.current = null;
        };
      });

      return stream;
    } catch (error) {
      console.error('[CameraContext] Error accessing camera:', error);
      setIsCameraActive(false);
      return null;
    }
  }, []);

  // Stop camera completely
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      console.log('[CameraContext] Stopping camera stream');
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      setIsCameraActive(false);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        console.log('[CameraContext] Cleanup: stopping camera on unmount');
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const value: CameraContextType = {
    streamRef,
    requestCameraAccess,
    stopCamera,
    isCameraActive,
  };

  return (
    <CameraContext.Provider value={value}>
      {children}
    </CameraContext.Provider>
  );
}

export function useCamera() {
  const context = useContext(CameraContext);
  if (context === undefined) {
    throw new Error('useCamera must be used within a CameraProvider');
  }
  return context;
}
