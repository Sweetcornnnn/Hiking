import { ImageSourcePropType } from 'react-native';

export type MountainMap = {
  source: ImageSourcePropType;
};

// IDs are checked first; slugs also match the corresponding mountain names.
export const MOUNTAIN_MAPS: Record<string, MountainMap> = {
  balinsayaw:     { source: require('../../assets/maps/balinsayaw.png') },
  'mt-m':         { source: require('../../assets/maps/mt-m.png') },
  madjaas:        { source: require('../../assets/maps/madjaas.png') },
  nangtud:        { source: require('../../assets/maps/nangtud.png') },
  'pandan-hills': { source: require('../../assets/maps/pandan-hills.png') },
};

const normalizeMountainName = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]/g, '');

export const getMountainMap = (
  mountainId?: string,
  mountainName?: string
): MountainMap | undefined => {
  if (mountainId && MOUNTAIN_MAPS[mountainId]) {
    return MOUNTAIN_MAPS[mountainId];
  }

  if (!mountainName) return undefined;

  const normalizedName = normalizeMountainName(mountainName);
  const matchingEntry = Object.entries(MOUNTAIN_MAPS).find(([key]) =>
    normalizedName.endsWith(normalizeMountainName(key))
  );

  return matchingEntry?.[1];
};