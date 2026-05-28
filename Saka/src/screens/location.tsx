import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useLocationTracking, LocationData } from '../hooks/useLocationTracking';

export default function LocationScreen() {
  const router = useRouter();
  const {
    lastLocation,
    trackingStatus,
    isLoading,
    permissions,
    startTracking,
    stopTracking,
    requestPermissions,
    getSOS,
    getLocationHistory,
    retryUploads,
  } = useLocationTracking();

  const [history, setHistory] = useState<LocationData[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [sosResult, setSosResult] = useState<LocationData | null>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setHistoryLoading(true);
    const data = await getLocationHistory();
    setHistory(data.slice(-8).reverse()); // Show latest 8
    setHistoryLoading(false);
  };

  const handleToggleTracking = async () => {
    if (trackingStatus.isForegroundActive) {
      await stopTracking();
    } else {
      if (!permissions.foreground) {
        await requestPermissions();
      }
      await startTracking();
    }
  };

  const handleSOS = async () => {
    const loc = await getSOS();
    if (loc) setSosResult(loc);
  };

  const formatCoord = (val: number, decimals = 5) => val.toFixed(decimals);

  const formatTime = (timestamp: string) => {
    const d = new Date(timestamp);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatAccuracy = (acc?: number) =>
    acc != null ? `±${acc.toFixed(0)}m` : '—';

  const trackingIcon = trackingStatus.isForegroundActive
    ? 'radio-button-on'
    : 'radio-button-off';

  const trackingColor = trackingStatus.isForegroundActive ? '#6FAF8A' : '#C9A96E';

  return (
    <View style={styles.page}>
      <View style={styles.card}>
        {/* ── Left panel ── */}
        <View style={styles.leftPanel}>
          <Text style={styles.pageTitle}>Location Tracker</Text>
          <Text style={styles.pageSubtitle}>
            Real-time GPS tracking for hiking safety
          </Text>
          <View style={styles.dividerH} />

          {/* Current coordinates */}
          {isLoading && !lastLocation ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color="#C9A96E" />
              <Text style={styles.loadingText}>Acquiring location…</Text>
            </View>
          ) : lastLocation ? (
            <>
              <Text style={styles.coordLabel}>Latitude</Text>
              <Text style={styles.coordValue}>{formatCoord(lastLocation.latitude)}°</Text>

              <Text style={styles.coordLabel}>Longitude</Text>
              <Text style={styles.coordValue}>{formatCoord(lastLocation.longitude)}°</Text>

              <View style={styles.metaRow}>
                <View style={styles.metaChip}>
                  <Ionicons name="navigate-outline" size={9} color="rgba(255,255,255,0.4)" />
                  <Text style={styles.metaChipText}>{formatAccuracy(lastLocation.accuracy)}</Text>
                </View>
                {lastLocation.altitude != null && (
                  <View style={styles.metaChip}>
                    <Ionicons name="trending-up-outline" size={9} color="rgba(255,255,255,0.4)" />
                    <Text style={styles.metaChipText}>{lastLocation.altitude.toFixed(0)}m alt</Text>
                  </View>
                )}
                {lastLocation.speed != null && lastLocation.speed > 0 && (
                  <View style={styles.metaChip}>
                    <Ionicons name="speedometer-outline" size={9} color="rgba(255,255,255,0.4)" />
                    <Text style={styles.metaChipText}>{lastLocation.speed.toFixed(1)} m/s</Text>
                  </View>
                )}
              </View>

              <Text style={styles.timestampText}>
                Updated {formatTime(lastLocation.timestamp)}
              </Text>
            </>
          ) : (
            <Text style={styles.noDataText}>
              No location data yet. Start tracking to see your coordinates.
            </Text>
          )}

          {/* Upload queue notice */}
          {trackingStatus.queuedUploads > 0 && (
            <TouchableOpacity style={styles.queueBadge} onPress={retryUploads}>
              <Ionicons name="cloud-upload-outline" size={10} color="#F38B5C" />
              <Text style={styles.queueBadgeText}>
                {trackingStatus.queuedUploads} pending upload{trackingStatus.queuedUploads > 1 ? 's' : ''} — tap to retry
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Vertical divider ── */}
        <View style={styles.dividerV} />

        {/* ── Right panel ── */}
        <View style={styles.rightPanel}>
          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>Tracking Controls</Text>
            <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
              <Ionicons name="close" size={14} color="rgba(255,255,255,0.4)" />
            </TouchableOpacity>
          </View>

          {/* Status pane */}
          <View style={styles.tabPane}>
            {/* Tracking toggle */}
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: trackingColor }]} />
              <Text style={styles.statusLabel}>
                {trackingStatus.isForegroundActive
                  ? 'Tracking active'
                  : trackingStatus.isBackgroundActive
                  ? 'Background only'
                  : 'Not tracking'}
              </Text>
              {!trackingStatus.isOnline && (
                <View style={styles.offlineBadge}>
                  <Text style={styles.offlineBadgeText}>Offline</Text>
                </View>
              )}
            </View>

            {/* Toggle button */}
            <TouchableOpacity
              style={[
                styles.tabPaneBtn,
                trackingStatus.isForegroundActive && styles.tabPaneBtnActive,
              ]}
              onPress={handleToggleTracking}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#C9A96E" />
              ) : (
                <>
                  <Ionicons
                    name={trackingIcon}
                    size={11}
                    color={trackingStatus.isForegroundActive ? '#6FAF8A' : '#C9A96E'}
                  />
                  <Text
                    style={[
                      styles.tabPaneBtnText,
                      trackingStatus.isForegroundActive && styles.tabPaneBtnTextActive,
                    ]}
                  >
                    {trackingStatus.isForegroundActive ? 'Stop Tracking' : 'Start Tracking'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* SOS button */}
            <TouchableOpacity
              style={styles.sosBtn}
              onPress={handleSOS}
              disabled={isLoading}
            >
              <Ionicons name="alert-circle-outline" size={11} color="#E07070" />
              <Text style={styles.sosBtnText}>Get SOS Location</Text>
            </TouchableOpacity>

            {sosResult && (
              <View style={styles.sosResult}>
                <Text style={styles.sosResultTitle}>SOS Coordinates</Text>
                <Text style={styles.sosResultCoord}>
                  {formatCoord(sosResult.latitude)}, {formatCoord(sosResult.longitude)}
                </Text>
                <Text style={styles.sosResultTime}>{formatTime(sosResult.timestamp)}</Text>
              </View>
            )}

            {/* ── Location history ── */}
            <View style={styles.historyHeader}>
              <Text style={styles.historyTitle}>Recent Waypoints</Text>
              <TouchableOpacity onPress={loadHistory}>
                <Ionicons name="refresh" size={11} color="rgba(201,169,110,0.6)" />
              </TouchableOpacity>
            </View>

            {historyLoading ? (
              <ActivityIndicator size="small" color="#C9A96E" style={{ marginTop: 6 }} />
            ) : history.length === 0 ? (
              <Text style={styles.noHistoryText}>No waypoints recorded yet.</Text>
            ) : (
              <ScrollView
                style={styles.historyList}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
              >
                {history.map((item, i) => (
                  <View
                    key={item.timestamp + i}
                    style={[styles.historyRow, i === history.length - 1 && styles.historyRowLast]}
                  >
                    <View style={styles.historyDot} />
                    <View style={styles.historyInfo}>
                      <Text style={styles.historyCoord} numberOfLines={1}>
                        {formatCoord(item.latitude, 4)}, {formatCoord(item.longitude, 4)}
                      </Text>
                      <Text style={styles.historyMeta}>
                        {formatTime(item.timestamp)} · {formatAccuracy(item.accuracy)}
                      </Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#0E1520',
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: '92%',
    maxWidth: 960,
    minHeight: 320,
    flexDirection: 'row',
    backgroundColor: '#111927',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },

  // ── Left panel ──
  leftPanel: {
    flex: 1,
    padding: 24,
    backgroundColor: '#121B2A',
  },
  pageTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
  },
  pageSubtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    marginBottom: 18,
    lineHeight: 18,
  },
  dividerH: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginBottom: 18,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 12,
  },
  coordLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
  },
  coordValue: {
    color: '#C9A96E',
    fontSize: 26,
    fontWeight: '900',
    marginBottom: 10,
    letterSpacing: -0.5,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  metaChipText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 10,
  },
  timestampText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 10,
    marginTop: 4,
  },
  noDataText: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
  queueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: 'rgba(243,139,92,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(243,139,92,0.2)',
  },
  queueBadgeText: {
    color: '#F38B5C',
    fontSize: 10,
  },

  // ── Vertical divider ──
  dividerV: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },

  // ── Right panel ──
  rightPanel: {
    flex: 1,
    padding: 24,
    backgroundColor: '#0E1520',
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  listTitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabPane: {
    flex: 1,
    gap: 10,
  },

  // Status
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    flex: 1,
  },
  offlineBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(243,139,92,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(243,139,92,0.3)',
  },
  offlineBadgeText: {
    color: '#F38B5C',
    fontSize: 9,
    fontWeight: '700',
  },

  // Buttons
  tabPaneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(201,169,110,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(201,169,110,0.25)',
  },
  tabPaneBtnActive: {
    backgroundColor: 'rgba(111,175,138,0.1)',
    borderColor: 'rgba(111,175,138,0.3)',
  },
  tabPaneBtnText: {
    color: '#C9A96E',
    fontSize: 12,
    fontWeight: '700',
  },
  tabPaneBtnTextActive: {
    color: '#6FAF8A',
  },
  sosBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(224,112,112,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(224,112,112,0.25)',
  },
  sosBtnText: {
    color: '#E07070',
    fontSize: 12,
    fontWeight: '700',
  },
  sosResult: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(224,112,112,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(224,112,112,0.15)',
  },
  sosResultTitle: {
    color: '#E07070',
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 3,
  },
  sosResultCoord: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  sosResultTime: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 10,
    marginTop: 2,
  },

  // History
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 6,
  },
  historyTitle: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  historyList: {
    maxHeight: 160,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  historyRowLast: {
    borderBottomWidth: 0,
  },
  historyDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(201,169,110,0.4)',
  },
  historyInfo: {
    flex: 1,
  },
  historyCoord: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    fontWeight: '500',
  },
  historyMeta: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 9,
    marginTop: 1,
  },
  noHistoryText: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 11,
  },
});