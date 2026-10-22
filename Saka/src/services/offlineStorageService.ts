import { Alert } from 'react-native';
import { Paths } from 'expo-file-system';

const LOW_STORAGE_THRESHOLD_BYTES = 100 * 1024 * 1024;
let hasWarnedThisSession = false;

export function warnIfDeviceStorageLow(): void {
  if (hasWarnedThisSession || Paths.availableDiskSpace >= LOW_STORAGE_THRESHOLD_BYTES) return;
  hasWarnedThisSession = true;
  Alert.alert(
    'Device storage is low',
    'Offline photos need space on this device. Free up storage soon to avoid losing unsynced photos.',
  );
}
