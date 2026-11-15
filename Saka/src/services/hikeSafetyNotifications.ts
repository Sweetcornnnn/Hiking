import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type SafetyKind = 'hike' | 'event';
export type SafetyResponse = 'got_home' | 'not_home_yet';

const CATEGORY = 'saka-safety-check';
const ACTION_GOT_HOME = 'GOT_HOME';
const ACTION_NOT_HOME = 'NOT_HOME_YET';
const MAP_KEY = 'saka.safety.notifMap.v1';
const FOLLOW_UP_KEY = 'saka.safety.followups.v1';
const COMPLETED_KEY = 'saka.safety.completedChecks.v1';
export const FOLLOW_UP_INTERVAL_MS = 30 * 60 * 1000;

type NotifMap = Record<string, string>; // checkId -> local notification id
type NotificationsModule = typeof import('expo-notifications');

let notificationsModule: NotificationsModule | null | undefined;
let expoGoWarningShown = false;

export interface FollowUpCheck {
  checkId: string;
  kind: SafetyKind;
  title: string;
  mountain: string | null;
  activityDate: string | null;
  plannedFinishAt: string;
}

export interface StoredFollowUpCheck extends FollowUpCheck {
  nextReminderAt: string;
  notificationId: string | null;
}

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
  title?: string;
  mountain?: string | null;
  activityDate?: string | null;
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

export async function getNotificationPermissionStatus(): Promise<boolean | null> {
  const notifications = getNotifications();
  if (!notifications) return null;
  const permissions = await notifications.getPermissionsAsync();
  return permissions.status === 'granted';
}

/* ------------------------------------------------------------- schedule/cancel */

export async function scheduleCheck(c: ScheduledCheck): Promise<string | null> {
  await clearCompletedCheck(c.checkId);
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
      data: {
        checkId: c.checkId,
        kind: c.kind,
        title: c.title,
        mountain: c.mountain,
        activityDate: c.activityDate,
        plannedFinishAt: c.plannedFinishAt.toISOString(),
      },
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

export async function scheduleFollowUp(check: FollowUpCheck): Promise<boolean> {
  const current = await loadFollowUps();
  const previous = current.find((item) => item.checkId === check.checkId);
  const remaining = current.filter((item) => item.checkId !== check.checkId);
  const notifications = getNotifications();

  if (previous?.notificationId) {
    try {
      await notifications?.cancelScheduledNotificationAsync(previous.notificationId);
    } catch {
      // The repeating notification may already have fired.
    }
  }

  const followUp: StoredFollowUpCheck = {
    ...check,
    nextReminderAt: new Date(Date.now() + FOLLOW_UP_INTERVAL_MS).toISOString(),
    notificationId: null,
  };
  await saveFollowUps([...remaining, followUp]);
  if (!notifications) return false;

  try {
    if (!(await requestPermissions())) return false;
    await ensureCategory();
    const notificationId = await notifications.scheduleNotificationAsync({
      content: {
        title: 'Are you home?',
        body: 'You said you were still out. We’ll check again in 30 minutes.',
        categoryIdentifier: CATEGORY,
        data: {
          checkId: check.checkId,
          kind: check.kind,
          title: check.title,
          mountain: check.mountain,
          activityDate: check.activityDate,
          followUp: true,
          plannedFinishAt: check.plannedFinishAt,
        },
      },
      trigger: {
        type: notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: FOLLOW_UP_INTERVAL_MS / 1000,
        repeats: true,
        channelId: Platform.OS === 'android' ? 'safety' : undefined,
      },
    });

    try {
      await saveFollowUps([
        ...remaining,
        { ...followUp, notificationId },
      ]);
    } catch (error) {
      try {
        await notifications.cancelScheduledNotificationAsync(notificationId);
      } catch {
        // Keep the storage error as the useful failure.
      }
      throw error;
    }

    return true;
  } catch (error) {
    console.warn('[HikeSafety] Could not schedule 30-minute follow-up notification:', error);
    return false;
  }
}

export async function getFollowUpChecks(): Promise<StoredFollowUpCheck[]> {
  return loadFollowUps();
}

export async function cancelFollowUp(checkId: string): Promise<void> {
  await markCheckCompleted(checkId);
  const followUps = await loadFollowUps();
  const followUp = followUps.find((item) => item.checkId === checkId);
  if (!followUp) return;

  if (followUp.notificationId) {
    try {
      await getNotifications()?.cancelScheduledNotificationAsync(followUp.notificationId);
    } catch {
      // The repeating notification may already have fired.
    }
  }

  await saveFollowUps(followUps.filter((item) => item.checkId !== checkId));
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
  await Promise.all([
    AsyncStorage.removeItem(MAP_KEY),
    AsyncStorage.removeItem(FOLLOW_UP_KEY),
    AsyncStorage.removeItem(COMPLETED_KEY),
  ]);
}

export async function getCompletedCheckIds(): Promise<Set<string>> {
  return new Set(Object.keys(await loadCompletedChecks()));
}

export async function isCheckCompleted(checkId: string): Promise<boolean> {
  const completed = await loadCompletedChecks();
  return checkId in completed;
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
  action: SafetyResponse | 'opened';
  title?: string;
  mountain?: string | null;
  activityDate?: string | null;
  followUp?: boolean;
  plannedFinishAt?: string;
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
      title: string;
      mountain: string | null;
      activityDate: string | null;
      followUp: boolean;
      plannedFinishAt: string;
    }>;
    if (!data?.checkId || !data?.kind) return;

    const action = res.actionIdentifier;
    const event = {
      checkId: data.checkId,
      kind: data.kind,
      title: data.title,
      mountain: data.mountain,
      activityDate: data.activityDate,
      followUp: data.followUp === true,
      plannedFinishAt: data.plannedFinishAt,
    };
    if (action === ACTION_GOT_HOME) {
      await handler({ ...event, action: 'got_home' });
    } else if (action === ACTION_NOT_HOME) {
      await handler({ ...event, action: 'not_home_yet' });
    } else {
      await handler({ ...event, action: 'opened' });
    }
    await notifications.clearLastNotificationResponseAsync();
  });
  return () => sub.remove();
}

export function attachNotificationReceivedListener(handler: () => Promise<void>): () => void {
  const notifications = getNotifications();
  if (!notifications) return () => {};

  const sub = notifications.addNotificationReceivedListener(async (notification) => {
    const data = notification.request.content.data as Partial<{
      checkId: string;
      kind: SafetyKind;
    }>;
    if (data?.checkId && data.kind) await handler();
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
    title: string;
    mountain: string | null;
    activityDate: string | null;
    followUp: boolean;
    plannedFinishAt: string;
  }>;
  if (!data?.checkId || !data?.kind) return null;
  const event = {
    checkId: data.checkId,
    kind: data.kind,
    title: data.title,
    mountain: data.mountain,
    activityDate: data.activityDate,
    followUp: data.followUp === true,
    plannedFinishAt: data.plannedFinishAt,
  };
  if (res.actionIdentifier === ACTION_GOT_HOME) {
    return { ...event, action: 'got_home' };
  }
  if (res.actionIdentifier === ACTION_NOT_HOME) {
    return { ...event, action: 'not_home_yet' };
  }
  return { ...event, action: 'opened' };
}

export async function clearLastResponse(): Promise<void> {
  await getNotifications()?.clearLastNotificationResponseAsync();
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

async function loadFollowUps(): Promise<StoredFollowUpCheck[]> {
  try {
    const raw = await AsyncStorage.getItem(FOLLOW_UP_KEY);
    if (!raw) return [];
    const items: unknown = JSON.parse(raw);
    if (!Array.isArray(items)) {
      throw new Error('Stored follow-up reminders are not a list.');
    }
    return items.filter(
      (item): item is StoredFollowUpCheck =>
        !!item &&
        typeof item === 'object' &&
        typeof item.checkId === 'string' &&
        (item.kind === 'hike' || item.kind === 'event') &&
        typeof item.nextReminderAt === 'string',
    );
  } catch (error) {
    console.warn('[HikeSafety] Could not read follow-up reminders:', error);
    return [];
  }
}

async function saveFollowUps(followUps: StoredFollowUpCheck[]): Promise<void> {
  await AsyncStorage.setItem(FOLLOW_UP_KEY, JSON.stringify(followUps));
}

async function loadCompletedChecks(): Promise<Record<string, number>> {
  try {
    const raw = await AsyncStorage.getItem(COMPLETED_KEY);
    if (!raw) return {};
    const completed: unknown = JSON.parse(raw);
    if (!completed || typeof completed !== 'object' || Array.isArray(completed)) {
      throw new Error('Stored completed safety checks are invalid.');
    }
    return Object.fromEntries(
      Object.entries(completed).filter((entry): entry is [string, number] =>
        typeof entry[1] === 'number',
      ),
    );
  } catch (error) {
    console.warn('[HikeSafety] Could not read completed safety checks:', error);
    return {};
  }
}

async function markCheckCompleted(checkId: string): Promise<void> {
  const completed = await loadCompletedChecks();
  completed[checkId] = Date.now();
  const latest = Object.fromEntries(
    Object.entries(completed)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 100),
  );
  await AsyncStorage.setItem(COMPLETED_KEY, JSON.stringify(latest));
}

async function clearCompletedCheck(checkId: string): Promise<void> {
  const completed = await loadCompletedChecks();
  if (!(checkId in completed)) return;
  delete completed[checkId];
  await AsyncStorage.setItem(COMPLETED_KEY, JSON.stringify(completed));
}