export interface MountainInfo {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

export const MOUNTAINS_INFO: MountainInfo[] = [
  { id: '1', name: 'Mt. Madja-as', latitude: 11.3892, longitude: 122.1629 },
  { id: '2', name: 'Mt. Guiting-Guiting', latitude: 11.7650, longitude: 121.8650 },
  { id: '3', name: 'Mt. Pulag', latitude: 16.6020, longitude: 121.0315 },
  { id: '4', name: 'Mt. Apo', latitude: 7.0060, longitude: 125.3561 },
  { id: '5', name: 'Mt. Mayon', latitude: 13.2600, longitude: 123.6940 },
  { id: '6', name: 'Mt. Batulao', latitude: 13.7867, longitude: 120.8867 },
  { id: '7', name: 'Mt. Maculot', latitude: 13.8694, longitude: 120.9894 },
  { id: '8', name: 'Mt. Ulap', latitude: 16.5850, longitude: 120.9183 },
  { id: '9', name: 'Mt. Pinatubo', latitude: 15.1383, longitude: 120.3500 },
  { id: '10', name: 'Mt. Kanlaon', latitude: 10.4080, longitude: 123.1370 },
];

export const getMountainById = (mountainId: string): MountainInfo | null => {
  return MOUNTAINS_INFO.find((mountain) => mountain.id === mountainId) || null;
};
