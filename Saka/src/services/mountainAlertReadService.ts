import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Alert, MountainTips } from '../data/mountainTips';

const READ_ALERTS_KEY_PREFIX = '@saka/read-mountain-alerts/v1:';

export function getMountainAlertKey(mountain: MountainTips, alert: Alert): string {
  return JSON.stringify([mountain.id, alert.type, alert.title, alert.message]);
}

const pendingWrites = new Map<string, Promise<void>>();

async function waitForPendingWrite(userId: string): Promise<void> {
  await pendingWrites.get(userId);
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

export async function getUnreadMountainAlertKeys(
  userId: string,
  mountain: MountainTips,
): Promise<Set<string>> {
  await waitForPendingWrite(userId);
  const readAlerts = await getReadAlertKeys(userId);
  return new Set(
    mountain.alerts
      .map((alert) => getMountainAlertKey(mountain, alert))
      .filter((key) => !readAlerts.has(key)),
  );
}

export async function getUnreadMountainAlertCounts(
  userId: string,
  mountains: MountainTips[],
): Promise<Record<string, number>> {
  await waitForPendingWrite(userId);
  const readAlerts = await getReadAlertKeys(userId);
  return Object.fromEntries(mountains.map((mountain) => [
    mountain.id,
    mountain.alerts.filter((alert) => !readAlerts.has(getMountainAlertKey(mountain, alert))).length,
  ]));
}

export async function markMountainAlertRead(
  userId: string,
  mountain: MountainTips,
  alert: Alert,
): Promise<void> {
  const previousWrite = pendingWrites.get(userId) ?? Promise.resolve();
  const write = previousWrite.catch(() => undefined).then(async () => {
    const readAlerts = await getReadAlertKeys(userId);
    readAlerts.add(getMountainAlertKey(mountain, alert));
    await AsyncStorage.setItem(
      `${READ_ALERTS_KEY_PREFIX}${userId}`,
      JSON.stringify([...readAlerts]),
    );
  });
  pendingWrites.set(userId, write);
  try {
    await write;
  } finally {
    if (pendingWrites.get(userId) === write) pendingWrites.delete(userId);
  }
}

export async function markMountainAlertsRead(
  userId: string,
  mountain: MountainTips,
): Promise<void> {
  await Promise.all(
    mountain.alerts.map((alert) => markMountainAlertRead(userId, mountain, alert)),
  );
}
