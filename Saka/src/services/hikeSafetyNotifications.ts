import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type SafetyKind = 'hike' | 'event';
export type SafetyResponse = 'got_home' | 'not_home_yet';

const CATEGORY = 'saka-safety-check';
const ACTION_GOT_HOME = 'GOT_HOME';
const ACTION_NOT_HOME = 'NOT_HOME_YET';
const MAP_KEY = 'saka.safety.notifMap.v1';

type NotifMap = Record<string, string>; // checkId -> local notification id
type NotificationsModule = typeof import('expo-notifications');

let notificationsModule: NotificationsModule | null | undefined;
let expoGoWarningShown = false;

function getNotifications(): NotificationsModule | null {
  if (Platform.OS === 'android' && Constants.executionEnvironment === 'storeClient') {
    if (!expoGoWarningShown) {
      console.warn('Hike safety notifications require an Android development build; they are disabled in Expo Go.');
      expoGoWarningShown = true;
    }
    return null;
  }

  if (notificationsModule === undefined) {
    notificationsModule = require('expo-notifications') as NotificationsModule;
  }

  return notificationsModule;
}

export interface ScheduledCheck {
  checkId: string;
  kind: SafetyKind;
  plannedFinishAt: Date;
}

/* ------------------------------------------------------------------ setup */

export function installNotificationHandler() {
  const notifications = getNotifications();
  if (!notifications) return;

  notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function ensureCategory() {
  const notifications = getNotifications();
  if (!notifications) return;

  await notifications.setNotificationCategoryAsync(CATEGORY, [
    { identifier: ACTION_GOT_HOME, buttonTitle: 'Got home',
      options: { opensAppToForeground: false } },
    { identifier: ACTION_NOT_HOME, buttonTitle: 'Not home yet',
      options: { opensAppToForeground: true } },
  ]);
}

export async function requestPermissions(): Promise<boolean> {
  const notifications = getNotifications();
  if (!notifications) return false;

  if (Platform.OS === 'android') {
    await notifications.setNotificationChannelAsync('safety', {
      name: 'Safety checks',
      importance: notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lockscreenVisibility: notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }
  const cur = await notifications.getPermissionsAsync();
  if (cur.status === 'granted') return true;
  const ask = await notifications.requestPermissionsAsync();
  return ask.status === 'granted';
}

/* ------------------------------------------------------------- schedule/cancel */

export async function scheduleCheck(c: ScheduledCheck): Promise<string | null> {
  if (!(await requestPermissions())) return null;
  const notifications = getNotifications();
  if (!notifications) return null;
  await ensureCategory();

  const id = await notifications.scheduleNotificationAsync({
    content: {
      title: 'Are you home?',
      body:
        c.kind === 'hike'
          ? 'Did you make it back from your hike?'
          : 'Did you make it back from the event?',
      categoryIdentifier: CATEGORY,
      data: { checkId: c.checkId, kind: c.kind },
    },
    trigger: {
      type: notifications.SchedulableTriggerInputTypes.DATE,
      date: c.plannedFinishAt,
      channelId: Platform.OS === 'android' ? 'safety' : undefined,
    },
  });

  const map = await loadMap();
  map[c.checkId] = id;
  await saveMap(map);
  return id;
}

export async function cancelCheck(checkId: string): Promise<void> {
  const map = await loadMap();
  const notifId = map[checkId];
  if (!notifId) return;
  const notifications = getNotifications();
  try {
    await notifications?.cancelScheduledNotificationAsync(notifId);
  } catch {
    /* notification may already have fired */
  }
  delete map[checkId];
  await saveMap(map);
}

export async function cancelAll(): Promise<void> {
  await getNotifications()?.cancelAllScheduledNotificationsAsync();
  await AsyncStorage.removeItem(MAP_KEY);
}

/* -------------------------------------------------------------- reconcile */

export async function reconcileSchedules(pending: ScheduledCheck[]): Promise<void> {
  if (!getNotifications()) return;

  const map = await loadMap();
  const wanted = new Set(pending.map((p) => p.checkId));

  // Cancel locals that are no longer pending
  for (const [checkId, notifId] of Object.entries(map)) {
    if (!wanted.has(checkId)) {
      try { await getNotifications()?.cancelScheduledNotificationAsync(notifId); } catch {}
      delete map[checkId];
    }
  }

  // Schedule anything pending that we're missing
  for (const c of pending) {
    if (!map[c.checkId]) {
      await scheduleCheck(c);
      const fresh = await loadMap();
      map[c.checkId] = fresh[c.checkId];
    }
  }

  await saveMap(map);
}

/* ------------------------------------------------------------- listeners */

export interface ResponseEvent {
  checkId: string;
  kind: SafetyKind;
  action: SafetyResponse;
}

export function attachResponseListener(
  handler: (e: ResponseEvent) => Promise<void>,
): () => void {
  const notifications = getNotifications();
  if (!notifications) return () => {};

  const sub = notifications.addNotificationResponseReceivedListener(async (res) => {
    const data = res.notification.request.content.data as Partial<{
      checkId: string;
      kind: SafetyKind;
    }>;
    if (!data?.checkId || !data?.kind) return;

    const action = res.actionIdentifier;
    if (action === ACTION_GOT_HOME) {
      await handler({ checkId: data.checkId, kind: data.kind, action: 'got_home' });
    } else if (action === ACTION_NOT_HOME) {
      await handler({ checkId: data.checkId, kind: data.kind, action: 'not_home_yet' });
    }
    // DEFAULT_ACTION_IDENTIFIER (body tap) is intentionally ignored here so the
    // in-app prompt handles it.
  });
  return () => sub.remove();
}

/** If the app was launched *by* a notification action, get it too. */
export async function getLastResponse(): Promise<ResponseEvent | null> {
  const notifications = getNotifications();
  if (!notifications) return null;

  const res = await notifications.getLastNotificationResponseAsync();
  if (!res) return null;
  const data = res.notification.request.content.data as Partial<{
    checkId: string;
    kind: SafetyKind;
  }>;
  if (!data?.checkId || !data?.kind) return null;
  if (res.actionIdentifier === ACTION_GOT_HOME) {
    return { checkId: data.checkId, kind: data.kind, action: 'got_home' };
  }
  if (res.actionIdentifier === ACTION_NOT_HOME) {
    return { checkId: data.checkId, kind: data.kind, action: 'not_home_yet' };
  }
  return null;
}

/* ---------------------------------------------------------------- helpers */

async function loadMap(): Promise<NotifMap> {
  try {
    const raw = await AsyncStorage.getItem(MAP_KEY);
    return raw ? (JSON.parse(raw) as NotifMap) : {};
  } catch {
    return {};
  }
}

async function saveMap(map: NotifMap): Promise<void> {
  try { await AsyncStorage.setItem(MAP_KEY, JSON.stringify(map)); } catch {}
}