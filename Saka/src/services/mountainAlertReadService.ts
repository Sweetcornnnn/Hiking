import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Alert, MountainTips } from '../data/mountainTips';

const READ_ALERTS_KEY_PREFIX = '@saka/read-mountain-alerts/v1:';

function getAlertKey(mountainId: string, alert: Alert): string {
  return JSON.stringify([mountainId, alert.type, alert.title, alert.message]);
}

async function getReadAlertKeys(userId: string): Promise<Set<string>> {
  const raw = await AsyncStorage.getItem(`${READ_ALERTS_KEY_PREFIX}${userId}`);
  if (!raw) return new Set();
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === 'string')) {
    throw new Error('Saved mountain alert read state is invalid.');
  }
  return new Set(parsed);
}

export async function getUnreadMountainAlertCounts(
  userId: string,
  mountains: MountainTips[],
): Promise<Record<string, number>> {
  const readAlerts = await getReadAlertKeys(userId);
  return Object.fromEntries(mountains.map((mountain) => [
    mountain.id,
    mountain.alerts.filter((alert) => !readAlerts.has(getAlertKey(mountain.id, alert))).length,
  ]));
}

export async function markMountainAlertsRead(
  userId: string,
  mountain: MountainTips,
): Promise<void> {
  const readAlerts = await getReadAlertKeys(userId);
  mountain.alerts.forEach((alert) => readAlerts.add(getAlertKey(mountain.id, alert)));
  await AsyncStorage.setItem(
    `${READ_ALERTS_KEY_PREFIX}${userId}`,
    JSON.stringify([...readAlerts]),
  );
}
