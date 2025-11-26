import type { ComponentType, JSX } from 'react';

import { IndexPage } from '@/pages/IndexPage/IndexPage';
import { VehiclesPage } from '@/pages/VehiclesPage/VehiclesPage';
import { CameraPage } from '@/pages/CameraPage/CameraPage';
import { ExitEntryPage } from '@/pages/ExitEntryPage/ExitEntryPage';

interface Route {
  path: string;
  Component: ComponentType;
  title?: string;
  icon?: JSX.Element;
}

export const routes: Route[] = [
  { path: '/', Component: IndexPage },
  { path: '/vehicles', Component: VehiclesPage, title: 'Vehicles' },
  { path: '/vehicles/add-entry', Component: CameraPage, title: 'Add Vehicle Entry' },
  { path: '/vehicles/exit-entry', Component: ExitEntryPage, title: 'Exit Vehicle' },
];
