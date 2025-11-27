import type { FC } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Dialog, Grid, Image, Input, List, Space, Toast } from 'antd-mobile';
import type { CascaderOption } from 'antd-mobile/es/components/cascader-view';
import { X, Circle } from 'lucide-react';

import { Page } from '@/components/Page.tsx';
import { useCamera } from '@/contexts/CameraContext';

interface RecognitionResult {
  plate_number: string;
  confidence: number;
  success: boolean;
  error_message?: string;
}

interface Destination {
  id: number;
  name: string;
  code: string;
  zone: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface DestinationsResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Destination[];
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

interface VehicleEntryPayload {
  license_plate: string;
  entry_photo_files: string[];
  entry_time: string;
  vehicle_type?: 'LIGHT' | 'CARGO';
  visitor_type?: 'EMPLOYEE' | 'CUSTOMER' | 'GUEST';
  transport_type?: 'PLATFORM' | 'FURA' | 'PRICEP' | 'MINI_FURA' | 'ZIL' | 'GAZEL' | 'LABO';
  entry_load_status?: 'LOADED' | 'EMPTY';
  cargo_type?: 'CONTAINER' | 'FOOD' | 'METAL' | 'WOOD' | 'CHEMICAL' | 'EQUIPMENT' | 'OTHER';
  container_size?: '1x20F' | '2x20F' | '40F';
  container_load_status?: 'LOADED' | 'EMPTY';
  destination?: number;
}

// Container type options with destinations
const buildContainerTypeOptions = (
  destinationOptions: CascaderOption[],
  containerSizes: ChoiceOption[],
  loadStatuses: ChoiceOption[]
): CascaderOption[] => {
  return containerSizes.map(size => ({
    label: size.label,
    value: size.value.toLowerCase(),
    children: loadStatuses.map(status => ({
      label: status.label,
      value: status.value.toLowerCase(),
      children: destinationOptions,
    })),
  }));
};

// Build cargo type options for container-capable vehicles
const buildCargoTypeOptionsWithContainer = (
  destinationOptions: CascaderOption[],
  cargoTypes: ChoiceOption[],
  containerSizes: ChoiceOption[],
  loadStatuses: ChoiceOption[]
): CascaderOption[] => {
  return cargoTypes.map(cargo => {
    if (cargo.value === 'CONTAINER') {
      return {
        label: cargo.label,
        value: cargo.value.toLowerCase(),
        children: buildContainerTypeOptions(destinationOptions, containerSizes, loadStatuses),
      };
    }
    return {
      label: cargo.label,
      value: cargo.value.toLowerCase(),
      children: destinationOptions,
    };
  });
};

// Build cargo type options for non-container vehicles
const buildCargoTypeOptionsWithoutContainer = (
  destinationOptions: CascaderOption[],
  cargoTypes: ChoiceOption[]
): CascaderOption[] => {
  return cargoTypes
    .filter(cargo => cargo.value !== 'CONTAINER')
    .map(cargo => ({
      label: cargo.label,
      value: cargo.value.toLowerCase(),
      children: destinationOptions,
    }));
};

// Cargo vehicle options with load status
const buildCargoVehicleOptions = (
  destinationOptions: CascaderOption[],
  transportTypes: ChoiceOption[],
  loadStatuses: ChoiceOption[],
  cargoTypes: ChoiceOption[],
  containerSizes: ChoiceOption[]
): CascaderOption[] => {
  // Container-capable vehicles
  const containerCapable = ['PLATFORM', 'TRUCK', 'TRAILER'];

  return transportTypes.map(transport => {
    const canCarryContainer = containerCapable.includes(transport.value);

    return {
      label: transport.label,
      value: transport.value.toLowerCase(),
      children: loadStatuses.map(status => {
        if (status.value === 'LOADED') {
          return {
            label: status.label,
            value: status.value.toLowerCase(),
            children: canCarryContainer
              ? buildCargoTypeOptionsWithContainer(destinationOptions, cargoTypes, containerSizes, loadStatuses)
              : buildCargoTypeOptionsWithoutContainer(destinationOptions, cargoTypes),
          };
        }
        return {
          label: status.label,
          value: status.value.toLowerCase(),
          children: destinationOptions,
        };
      }),
    };
  });
};

// Main vehicle type options
const buildVehicleTypeOptions = (
  destinationOptions: CascaderOption[],
  choices: ChoicesResponse
): CascaderOption[] => {
  return choices.vehicle_types.map(vehicleType => {
    if (vehicleType.value === 'LIGHT') {
      return {
        label: vehicleType.label,
        value: vehicleType.value.toLowerCase(),
        children: choices.visitor_types.map(visitor => ({
          label: visitor.label,
          value: visitor.value.toLowerCase(),
        })),
      };
    }
    // CARGO vehicle
    return {
      label: vehicleType.label,
      value: vehicleType.value.toLowerCase(),
      children: buildCargoVehicleOptions(
        destinationOptions,
        choices.transport_types,
        choices.load_statuses,
        choices.cargo_types,
        choices.container_sizes
      ),
    };
  });
};


export const CameraPage: FC = () => {
  const navigate = useNavigate();
  const { requestCameraAccess } = useCamera();
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmittingEntry, setIsSubmittingEntry] = useState(false);
  const [allPhotos, setAllPhotos] = useState<string[]>([]);
  const [currentProcessingIndex, setCurrentProcessingIndex] = useState<number>(-1);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [recognitionResult, setRecognitionResult] = useState<RecognitionResult | null>(null);
  const [plateNumber, setPlateNumber] = useState<string>('');
  const [selectedPath, setSelectedPath] = useState<{ label: string; value: string }[]>([]);
  const [destinationOptions, setDestinationOptions] = useState<CascaderOption[]>([]);
  const [vehicleTypeOptions, setVehicleTypeOptions] = useState<CascaderOption[]>([]);
  const [choices, setChoices] = useState<ChoicesResponse | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
        Toast.show({ content: 'Танловларни юклашда хатолик', icon: 'fail' });
        return;
      }

      const data = await response.json() as ChoicesResponse;
      console.log('Choices loaded:', data);
      setChoices(data);
    } catch (error) {
      console.error('Error fetching choices:', error);
      Toast.show({ content: 'Танловларни юклашда хатолик', icon: 'fail' });
    }
  };

  // Fetch destinations from API
  const fetchDestinations = async () => {
    try {
      const response = await fetch('https://api-mtt.xlog.uz/api/vehicles/destinations/', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        console.error('Failed to fetch destinations');
        Toast.show({ content: 'Жойларни юклашда хатолик', icon: 'fail' });
        return;
      }

      const data = await response.json() as DestinationsResponse;
      console.log('Destinations loaded:', data);

      // Convert destinations to CascaderOption format
      const destOptions: CascaderOption[] = data.results.map(dest => ({
        label: `${dest.zone} - ${dest.name}`,
        value: String(dest.id),
      }));

      setDestinationOptions(destOptions);
    } catch (error) {
      console.error('Error fetching destinations:', error);
      Toast.show({ content: 'Жойларни юклашда хатолик', icon: 'fail' });
    }
  };

  // Fetch choices and destinations on component mount
  useEffect(() => {
    void fetchChoices();
    void fetchDestinations();

    if (!isCameraOpen && allPhotos.length === 0) {
      void openCamera();
    }
  }, []);

  // Rebuild vehicle type options when choices and destinations are loaded
  useEffect(() => {
    if (choices && destinationOptions.length > 0) {
      setVehicleTypeOptions(buildVehicleTypeOptions(destinationOptions, choices));
    }
  }, [choices, destinationOptions]);

  const showOptionsDialog = (options: CascaderOption[], path: { label: string; value: string }[] = []) => {
    console.log('showOptionsDialog - path:', path);
    console.log('showOptionsDialog - options count:', options.length);
    console.log('showOptionsDialog - options:', options);

    const actions = options.map((option, index) => ({
      key: String(option.value),
      text: option.label || '',
      disabled: option.disabled,
      style: {
        backgroundColor: index % 2 === 0 ? '#f5f5f5' : 'transparent',
        color: option.color ? option.color : '#007aff',
      },
      onClick: () => {
        const newPath = [...path, { label: option.label || '', value: String(option.value) }];
        console.log('Option clicked:', option.label, '- has children:', option.children?.length || 0);

        if (option.children && option.children.length > 0) {
          // Has children, close current and show next level
          Dialog.clear();
          showOptionsDialog(option.children, newPath);
        } else {
          // No children, selection complete
          Dialog.clear();
          setSelectedPath(newPath);
          console.log('Final selection:', newPath);
        }
      }
    }));

    // Add back button at the bottom if not at root level
    if (path.length > 0) {
      actions.push({
        key: 'back',
        text: '← Орқага',
        disabled: false,
        style: {
          backgroundColor: 'transparent',
          color: 'rgb(130, 130, 130)',
        },
        onClick: () => {
          // Go back to previous level
          const previousPath = path.slice(0, -1);
          let previousOptions = vehicleTypeOptions;

          for (const item of previousPath) {
            const found = previousOptions.find(opt => String(opt.value) === item.value);
            if (found && found.children) {
              previousOptions = found.children;
            }
          }

          Dialog.clear();
          showOptionsDialog(previousOptions, previousPath);
        }
      });
    }

    // Get the title for the current level
    const getDialogTitle = (): string => {
      if (path.length === 0) return 'Мошина тури'; // Vehicle Type

      const vehicleType = path[0]?.value;

      // Light vehicle
      if (vehicleType === 'light') {
        if (path.length === 1) return 'Мақсад'; // Purpose
        return '';
      }

      // Cargo vehicle
      if (vehicleType === 'cargo') {
        if (path.length === 1) return 'Транспорт тури'; // Transport Type
        if (path.length === 2) return 'Ҳолати'; // Load Status

        const loadStatus = path[2]?.value;

        // Empty cargo
        if (loadStatus === 'empty') {
          if (path.length === 3) return 'Жой'; // Destination
          return '';
        }

        // Loaded cargo
        if (loadStatus === 'loaded' || loadStatus === 'with_load') {
          if (path.length === 3) return 'Юк тури'; // Cargo Type

          const cargoType = path[3]?.value;

          // Container
          if (cargoType === 'container') {
            if (path.length === 4) return 'Контейнер тури'; // Container Size
            if (path.length === 5) return 'Контейнер ҳолати'; // Container Load Status
            if (path.length === 6) return 'Жой'; // Destination
            return '';
          }

          // Other cargo
          if (path.length === 4) return 'Жой'; // Destination
          return '';
        }
      }

      return 'Танланг';
    };

    Dialog.show({
      title: getDialogTitle(),
      content: path.length > 0 ? path.map(p => p.label).join(' → ') : '',
      closeOnMaskClick: path.length === 0,
      closeOnAction: false,
      actions: actions,
      bodyStyle: {
        maxHeight: '90vh',
        overflowY: 'auto',
      },
    });
  };

  const handleVehicleTypeSelection = () => {
    showOptionsDialog(vehicleTypeOptions);
  };

  const handleEditSelection = (level: number) => {
    // Get the path up to the level we want to edit
    const pathToEdit = selectedPath.slice(0, level);

    // Find the options for that level
    let options = vehicleTypeOptions;
    for (const item of pathToEdit) {
      const found = options.find(opt => String(opt.value) === item.value);
      if (found && found.children) {
        options = found.children;
      }
    }

    showOptionsDialog(options, pathToEdit);
  };

  // Function to get appropriate label for each level based on selection context
  const getLabelForLevel = (level: number, path: { label: string; value: string }[]): string => {
    console.log('getLabelForLevel - level:', level, 'path:', path);

    if (level === 0) {
      return 'Мошина тури'; // Vehicle Type
    }

    const vehicleType = path[0]?.value;

    // Light vehicle path
    if (vehicleType === 'light') {
      if (level === 1) return 'Мақсад'; // Purpose
      return '';
    }

    // Cargo vehicle path
    if (vehicleType === 'cargo') {
      if (level === 1) return 'Транспорт тури'; // Transport Type
      if (level === 2) return 'Ҳолати'; // Load Status

      const loadStatus = path[2]?.value;

      // Empty cargo path
      if (loadStatus === 'empty') {
        if (level === 3) return 'Жой'; // Destination
        return '';
      }

      // With load path (check for both 'loaded' and 'with_load' to be safe)
      if (loadStatus === 'loaded' || loadStatus === 'with_load') {
        const cargoType = path[3]?.value;

        if (level === 3) {
          return 'Юк тури'; // Cargo Type (container or other)
        }

        // Container path
        if (cargoType === 'container') {
          if (level === 4) return 'Контейнер тури'; // Container Type
          if (level === 5) return 'Контейнер ҳолати'; // Container Status
          if (level === 6) return 'Жой'; // Destination
          return '';
        }

        // Other cargo types (direct to destination)
        if (level === 4) return 'Жой'; // Destination
        return '';
      }
    }

    return '';
  };

  const openCamera = async () => {
    try {
      console.log('Opening camera...');
      setIsCameraOpen(true);

      // Wait for video element to be rendered
      await new Promise(resolve => setTimeout(resolve, 150));

      // Request camera access from global context
      const stream = await requestCameraAccess();

      if (!stream) {
        throw new Error('Failed to get camera stream');
      }

      if (videoRef.current) {
        console.log('Setting video source...');
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
          console.log('Video playing successfully');
        } catch (playError) {
          console.error('Error playing video:', playError);
        }
      } else {
        console.error('Video ref is not available');
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      setIsCameraOpen(false);
      void Dialog.alert({
        content: `Unable to access camera: ${error instanceof Error ? error.message : 'Unknown error'}`,
        confirmText: 'OK',
        onConfirm: () => {
          if (!capturedImage) {
            navigate(-1); // Go back if camera access fails and no photo captured
          }
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
    // Stream is managed globally and will stay alive
    setIsCameraOpen(false);

    // If no photos taken, navigate back to vehicles list
    if (allPhotos.length === 0) {
      navigate('/vehicles');
    }
    // If photos exist, stay on camera page (just close camera view)
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

  // Convert destination value (string ID) to number
  const getDestinationId = (value: string): number => {
    return parseInt(value, 10);
  };

  // Build API payload from selected path
  const buildVehicleEntryPayload = (): VehicleEntryPayload | null => {
    if (selectedPath.length === 0) {
      Toast.show({ content: 'Илтимос, мошина турини танланг', icon: 'fail' });
      return null;
    }

    if (!plateNumber.trim()) {
      Toast.show({ content: 'Илтимос, номер киритинг', icon: 'fail' });
      return null;
    }

    if (allPhotos.length === 0) {
      Toast.show({ content: 'Илтимос, расм олинг', icon: 'fail' });
      return null;
    }

    if (!choices) {
      Toast.show({ content: 'Танловлар юкланмаган', icon: 'fail' });
      return null;
    }

    const payload: VehicleEntryPayload = {
      license_plate: plateNumber.trim(),
      entry_photo_files: allPhotos,
      entry_time: new Date().toISOString(),
    };

    const vehicleType = selectedPath[0]?.value;

    if (vehicleType === 'light') {
      // Light vehicle path: vehicle_type -> visitor_type
      payload.vehicle_type = 'LIGHT';

      const visitorTypeValue = selectedPath[1]?.value;
      const visitorType = choices.visitor_types.find(v => v.value.toLowerCase() === visitorTypeValue);

      if (!visitorType) {
        Toast.show({ content: 'Нотўғри танлов', icon: 'fail' });
        return null;
      }

      payload.visitor_type = visitorType.value as 'EMPLOYEE' | 'CUSTOMER' | 'GUEST';
    } else if (vehicleType === 'cargo') {
      // Cargo vehicle path
      payload.vehicle_type = 'CARGO';

      const transportTypeValue = selectedPath[1]?.value;
      const transportType = choices.transport_types.find(t => t.value.toLowerCase() === transportTypeValue);

      if (!transportType) {
        Toast.show({ content: 'Нотўғри транспорт тури', icon: 'fail' });
        return null;
      }

      payload.transport_type = transportType.value as 'PLATFORM' | 'FURA' | 'PRICEP' | 'MINI_FURA' | 'ZIL' | 'GAZEL' | 'LABO';

      const loadStatusValue = selectedPath[2]?.value;
      const loadStatus = choices.load_statuses.find(l => l.value.toLowerCase() === loadStatusValue);
      payload.entry_load_status = loadStatus?.value as 'LOADED' | 'EMPTY';

      if (loadStatusValue === 'empty') {
        // Empty cargo: get destination
        const destinationValue = selectedPath[3]?.value;
        if (destinationValue) {
          payload.destination = getDestinationId(destinationValue);
        }
      } else if (loadStatusValue === 'loaded') {
        // With load: get cargo type
        const cargoTypeValue = selectedPath[3]?.value;
        const cargoType = choices.cargo_types.find(c => c.value.toLowerCase() === cargoTypeValue);
        payload.cargo_type = cargoType?.value as 'CONTAINER' | 'FOOD' | 'METAL' | 'WOOD' | 'CHEMICAL' | 'EQUIPMENT' | 'OTHER';

        if (cargoTypeValue === 'container') {
          // Container flow
          const containerSizeValue = selectedPath[4]?.value;
          const containerSize = choices.container_sizes.find(cs => cs.value.toLowerCase() === containerSizeValue);
          payload.container_size = containerSize?.value as '1x20F' | '2x20F' | '40F';

          const containerLoadStatusValue = selectedPath[5]?.value;
          const containerLoadStatus = choices.load_statuses.find(l => l.value.toLowerCase() === containerLoadStatusValue);
          payload.container_load_status = containerLoadStatus?.value as 'LOADED' | 'EMPTY';

          const destinationValue = selectedPath[6]?.value;
          if (destinationValue) {
            payload.destination = getDestinationId(destinationValue);
          }
        } else {
          // Other cargo types: direct to destination
          const destinationValue = selectedPath[4]?.value;
          if (destinationValue) {
            payload.destination = getDestinationId(destinationValue);
          }
        }
      }
    }

    return payload;
  };

  const submitVehicleEntry = async () => {
    const payload = buildVehicleEntryPayload();
    if (!payload) return;

    setIsSubmittingEntry(true);

    try {
      console.log('Submitting vehicle entry:', payload);

      // Create FormData to send files
      const formData = new FormData();

      // Add all photo files
      for (let i = 0; i < allPhotos.length; i++) {
        const base64 = allPhotos[i];
        const blob = base64ToBlob(base64);
        formData.append('entry_photo_files', blob, `photo_${i + 1}.jpg`);
      }

      // Add other fields
      formData.append('license_plate', payload.license_plate);
      formData.append('entry_time', payload.entry_time);

      // Use a default recorded_by value of 1 if user doesn't exist in backend
      // You can change this to match your backend's default user ID
      // formData.append('recorded_by', '1');

      if (payload.vehicle_type) formData.append('vehicle_type', payload.vehicle_type);
      if (payload.visitor_type) formData.append('visitor_type', payload.visitor_type);
      if (payload.transport_type) formData.append('transport_type', payload.transport_type);
      if (payload.entry_load_status) formData.append('entry_load_status', payload.entry_load_status);
      if (payload.cargo_type) formData.append('cargo_type', payload.cargo_type);
      if (payload.container_size) formData.append('container_size', payload.container_size);
      if (payload.container_load_status) formData.append('container_load_status', payload.container_load_status);
      if (payload.destination) formData.append('destination', payload.destination.toString());

      const response = await fetch('https://api-mtt.xlog.uz/api/vehicles/entries/', {
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
      console.log('Entry created:', result);

      Toast.show({ content: 'Муваффақиятли сақланди!', icon: 'success' });

      // Navigate back to vehicles list after successful submission
      setTimeout(() => {
        navigate('/vehicles');
      }, 1000);
    } catch (error) {
      console.error('Error submitting entry:', error);
      Toast.show({ content: 'Хатолик: ' + (error instanceof Error ? error.message : 'Unknown'), icon: 'fail' });
    } finally {
      setIsSubmittingEntry(false);
    }
  };

  return (
    <>

      {!isCameraOpen ? (
        <Page back={true} onBack={handleBackNavigation} title="Машина қўшиш">
          <Space direction='vertical' block style={{ padding: '10px', paddingBottom: '104px' }}>


            <Card title="Rasmlar">
              <Grid columns={3} gap={16}>
                {allPhotos.map((photo, photo_index) => {

                  const isSuccessfulPhoto = capturedImage === photo && recognitionResult?.success;

                  return (
                    <Grid.Item className='relative'>
                      <Image className={`rounded ${isSuccessfulPhoto ? 'border-4 border-green-400' : ''}`} fit={'cover'} width={100} height={100} src={photo} />
                      <div
                        onClick={() => void deletePhoto(photo_index)}
                        className='absolute top-1 -right-0.5 bg-red-500 rounded-full p-1'>
                        <X size={14}></X>
                      </div>
                    </Grid.Item>
                  )
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
                placeholder='Введите номер автомобиля'
                clearable
              />
            </Card>

            {selectedPath.length === 0 && (
              <Button size='large' block onClick={handleVehicleTypeSelection} color='primary'>
                Мошина тури
              </Button>
            )}

            {selectedPath.length > 0 && (
              <List>
                {selectedPath.map((pathItem, index) => {
                  const label = getLabelForLevel(index, selectedPath);
                  // Only render if we have a label for this level
                  if (!label) return null;

                  return (
                    <List.Item
                      key={index}
                      onClick={() => handleEditSelection(index)}
                      clickable
                    >
                      <div className="flex justify-between items-center w-full gap-4">
                        <span className="text-neutral-600 flex-shrink-0">{label}</span>
                        <span className="font-medium truncate text-right">{pathItem.label}</span>
                      </div>
                    </List.Item>
                  );
                })}
              </List>
            )}

            {selectedPath.length > 0 && plateNumber.trim() && allPhotos.length > 0 && (
              <Button
                block
                color='success'
                size='large'
                onClick={submitVehicleEntry}
                loading={isSubmittingEntry}
                disabled={isSubmittingEntry}
              >
                {isSubmittingEntry ? 'Сақланмоқда...' : 'Сақлаш'}
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
                  video.play().catch(err => console.error('Error playing video:', err));
                }}
              />

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
