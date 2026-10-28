import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FULLSCREEN_MODAL_PROPS, ModalScrim } from './ModalScrim';
import {
  getOfflineStatusSnapshot,
  checkInternetConnection,
  type OfflineStatusSnapshot,
} from '../services/offlineStatusService';
import { retryJournalWriteQueue } from '../services/journalService';
import { flushSakagramLikeQueue } from '../services/sakagramService';
import { flushTextMessageQueue } from '../services/offlineMessageQueue';
import { flushProfileUpdateQueue } from '../services/offlineProfileService';
import locationService from '../services/locationService';

const EMPTY_SNAPSHOT: OfflineStatusSnapshot = { queues: [], savedData: [] };

function formatSavedDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : date.toLocaleString();
}

export default function OfflineStatusIndicator() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [snapshot, setSnapshot] = useState(EMPTY_SNAPSHOT);
  const [visible, setVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    const [connectionResult, snapshotResult] = await Promise.allSettled([
      checkInternetConnection(),
      getOfflineStatusSnapshot(),
    ]);
    if (connectionResult.status === 'fulfilled') {
      setConnected(connectionResult.value);
    } else {
      setConnected(null);
      setErrorMessage('Unable to check the internet connection.');
    }
    if (snapshotResult.status === 'fulfilled') {
      setSnapshot(snapshotResult.value);
    } else {
      setErrorMessage('Unable to read offline sync status from this device.');
      console.warn('[OfflineStatus] Failed to read saved sync status:', snapshotResult.reason);
    }
    if (connectionResult.status === 'fulfilled' && snapshotResult.status === 'fulfilled') {
      setErrorMessage(null);
    }
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 15_000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [refresh]);

  const pendingCount = useMemo(
    () => snapshot.queues.reduce((total, queue) => total + queue.count, 0),
    [snapshot.queues],
  );
  const showIndicator = connected === false || pendingCount > 0;

  const retrySync = async () => {
    setRetrying(true);
    setErrorMessage(null);
    const results = await Promise.allSettled([
      retryJournalWriteQueue(),
      flushSakagramLikeQueue(),
      flushTextMessageQueue(),
      flushProfileUpdateQueue(),
      locationService.retryQueuedUploads(),
    ]);
    const failed = results.filter((result) => result.status === 'rejected');
    if (failed.length > 0) {
      console.warn('[OfflineStatus] Some sync queues could not be retried:', failed);
    }
    await refresh();
    if (failed.length > 0) {
      setErrorMessage('Some items could not be retried. Check your connection and try again.');
    }
    setRetrying(false);
  };

  if (!showIndicator && !visible) return null;

  return (
    <>
      {showIndicator && (
        <Pressable
          onPress={() => {
            setVisible(true);
            setErrorMessage(null);
            void refresh();
          }}
          style={styles.indicator}
          accessibilityRole="button"
          accessibilityLabel={`${connected === false ? 'Offline' : `${pendingCount} items pending sync`} status. Open details.`}
        >
          <Ionicons
            name={connected === false ? 'cloud-offline-outline' : 'sync-outline'}
            size={15}
            color={connected === false ? '#F2A5A5' : '#E6D5AE'}
          />
          <Text style={styles.indicatorText}>{connected === false ? 'Offline' : 'Sync'}</Text>
        </Pressable>
      )}

      <Modal
        {...FULLSCREEN_MODAL_PROPS}
        visible={visible}
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <View style={styles.backdrop}>
          <ModalScrim color="rgba(0,0,0,0.62)" />
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setVisible(false)} />
          <View style={styles.panel}>
            <View style={styles.panelHeader}>
              <View>
                <Text style={styles.title}>Offline status</Text>
                <Text style={styles.connection}>
                  {connected === null ? 'Connection: checking…' : `Connection: ${connected ? 'online' : 'offline'}`}
                </Text>
              </View>
              {refreshing ? (
                <ActivityIndicator color="#C9A96E" />
              ) : (
                <Pressable
                  onPress={() => void refresh()}
                  accessibilityRole="button"
                  accessibilityLabel="Refresh offline status"
                  hitSlop={10}
                >
                  <Ionicons name="refresh-outline" size={21} color="#C9A96E" />
                </Pressable>
              )}
            </View>

            <ScrollView style={styles.details} showsVerticalScrollIndicator={false}>
              {pendingCount === 0 ? (
                <View style={styles.syncedStatus}>
                  <Ionicons
                    name={connected ? 'checkmark-circle-outline' : 'cloud-offline-outline'}
                    size={24}
                    color={connected ? '#8FC9A5' : '#E6D5AE'}
                  />
                  <Text style={styles.syncedText}>
                    {connected
                      ? 'Everything is synced up.'
                      : 'No items are currently waiting to sync.'}
                  </Text>
                </View>
              ) : (
                <>
                  <Text style={styles.sectionTitle}>Waiting to sync</Text>
                  {snapshot.queues.map((queue) => (
                    <View key={queue.label} style={styles.row}>
                      <Text style={styles.rowLabel}>{queue.label}</Text>
                      <Text style={styles.rowValue}>
                        {queue.count}{queue.failed > 0 ? ` · ${queue.failed} failed` : ''}
                      </Text>
                    </View>
                  ))}
                </>
              )}

              <Text style={[styles.sectionTitle, styles.savedHeading]}>Saved trail data</Text>
              {snapshot.savedData.length === 0 ? (
                <Text style={styles.emptyText}>No saved-data dates are available yet.</Text>
              ) : snapshot.savedData.map((item, index) => (
                <View key={`${item.label}-${index}`} style={styles.savedRow}>
                  <Text style={styles.rowLabel}>{item.label}</Text>
                  <Text style={styles.savedDate}>{formatSavedDate(item.updatedAt!)}</Text>
                </View>
              ))}
            </ScrollView>

            {errorMessage && <Text style={styles.error}>{errorMessage}</Text>}
            {pendingCount > 0 && (
              <Pressable
                style={[styles.retryButton, retrying && styles.disabledButton]}
                onPress={() => void retrySync()}
                disabled={retrying}
                accessibilityRole="button"
              >
                {retrying ? (
                  <ActivityIndicator color="#111927" />
                ) : (
                  <>
                    <Ionicons name="sync-outline" size={16} color="#111927" />
                    <Text style={styles.retryText}>Retry sync</Text>
                  </>
                )}
              </Pressable>
            )}
            <Pressable
              style={styles.closeButton}
              onPress={() => setVisible(false)}
              accessibilityRole="button"
            >
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
            </View>
          </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  indicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: 'rgba(14, 21, 32, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 110, 0.45)',
  },
  indicatorText: { color: '#F1E6CE', fontSize: 10, fontWeight: '600' },
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 22,
  },
  panel: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '82%',
    padding: 19,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(201, 169, 110, 0.32)',
    backgroundColor: '#111927',
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  title: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  connection: { color: '#AAB5C3', fontSize: 12, marginTop: 4, textTransform: 'capitalize' },
  details: { marginTop: 15, flexShrink: 1 },
  syncedStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  syncedText: { color: '#E8EDF3', fontSize: 14, fontWeight: '600' },
  sectionTitle: { color: '#C9A96E', fontSize: 12, fontWeight: '700', marginBottom: 8 },
  savedHeading: { marginTop: 20 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  rowLabel: { flex: 1, color: '#E8EDF3', fontSize: 12, marginRight: 10 },
  rowValue: { color: '#E6D5AE', fontSize: 12, fontWeight: '600' },
  savedRow: { paddingVertical: 7 },
  savedDate: { color: '#AAB5C3', fontSize: 11, marginTop: 3 },
  emptyText: { color: '#AAB5C3', fontSize: 12, paddingVertical: 6 },
  error: { color: '#F2A5A5', fontSize: 12, marginTop: 10 },
  retryButton: {
    minHeight: 42,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 7,
    marginTop: 14,
    borderRadius: 10,
    backgroundColor: '#C9A96E',
  },
  disabledButton: { opacity: 0.65 },
  retryText: { color: '#111927', fontSize: 13, fontWeight: '700' },
  closeButton: { alignItems: 'center', paddingTop: 13, paddingBottom: 2 },
  closeText: { color: '#AAB5C3', fontSize: 12, fontWeight: '600' },
});
