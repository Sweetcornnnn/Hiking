import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../store/authStore';
import { useRouter } from 'expo-router';
import { useWildTrackStore } from '../store/wildtrackStore';
import { mountainService, Mountain } from '../services/mountainService';
import weatherService, { WeatherCondition } from '../services/weatherService';
import { useLocationTracking } from '../hooks/useLocationTracking';

interface ProfileCardProps {
  visible: boolean;
  onClose: () => void;
  onRequestLogout: () => void;
  profileImage?: string | null;
  onAvatarPress?: () => void;
  onProfileImageSelect?: (uri: string) => void;
}

const screenDimensions = Dimensions.get('screen');

type TabId = 'stats' | 'calendar' | 'wildtrack' | 'weather' | 'location';

export default function ProfileCard({
  visible,
  onClose,
  onRequestLogout,
  profileImage,
  onAvatarPress,
  onProfileImageSelect
}: ProfileCardProps) {
  const router = useRouter();
  const { user } = useAuthStore();
  // We won't use selectedMountainId from wildtrackStore anymore
  // const { selectedMountainId } = useWildTrackStore();

  const [selectedMountain, setSelectedMountain] = useState<Mountain | null>(null);
  const [mountains, setMountains] = useState<Mountain[]>([]);
  const [location, setLocation] = useState<string>('Loading...');
  const [activeTab, setActiveTab] = useState<TabId>('stats');
  const [weather, setWeather] = useState<WeatherCondition | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  const {
    lastLocation,
    trackingStatus,
    isLoading: locationLoading,
    startTracking,
    stopTracking,
    permissions: locationPerms,
    requestPermissions,
  } = useLocationTracking();

  // Load mountains when visible – use the first one for weather
  useEffect(() => {
    if (visible) {
      const loadData = async () => {
        try {
          const data = await mountainService.fetchMountains();
          setMountains(data);
          if (data.length > 0) {
            const first = data[0];
            setSelectedMountain(first);
            setLocation(first.name);
            loadWeather(first);
          }
        } catch (error) {
          console.error('Failed to load mountains for ProfileCard', error);
        }
      };
      loadData();
    }
  }, [visible]);

  const loadWeather = async (mountain: Mountain) => {
    try {
      setWeatherLoading(true);
      setWeatherError(null);
      const currentWeather = await weatherService.getCurrentWeather(
        mountain.latitude,
        mountain.longitude
      );
      setWeather(currentWeather);
    } catch (error: any) {
      console.error('Weather load failed:', error);
      setWeather(null);
      setWeatherError(error?.message || 'Unable to load weather.');
    } finally {
      setWeatherLoading(false);
    }
  };

  const handleLogoutPress = () => {
    onClose();
    onRequestLogout();
  };

  const handleSettings = () => {
    onClose();
    router.push('/Settings');
  };

  const pickProfileImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.status !== 'granted') {
      Alert.alert('Permission required', 'Allow photo access to choose a profile image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      onProfileImageSelect?.(result.assets[0].uri);
    }
  };

  const handleAvatarPress = onAvatarPress ?? pickProfileImage;

  const initials =
    user?.name
      ?.split(' ')
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'H';

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent={true}
      presentationStyle="overFullScreen"
    >
      <View style={styles.centerContainer}>
        <View style={styles.card}>

          {/* Left panel */}
          <View style={styles.leftPanel}>
            <TouchableOpacity style={styles.avatar} onPress={handleAvatarPress} activeOpacity={0.8}>
              {profileImage ? (
                <Image source={{ uri: profileImage }} style={styles.avatarImage} resizeMode="cover" />
              ) : (
                <Text style={styles.avatarInitials}>{initials}</Text>
              )}
            </TouchableOpacity>

            <Text style={styles.name} numberOfLines={1}>{user?.name || 'Hiker'}</Text>
            <Text style={styles.email} numberOfLines={1}>{user?.email || 'email@example.com'}</Text>

            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={11} color="#8A9BB0" />
              <Text style={styles.locationText} numberOfLines={1}>{location}</Text>
            </View>

            <View style={styles.dividerH} />

            {/* Stats – show total mountains */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statNum}>{mountains.length}</Text>
                <Text style={styles.statLbl}>peaks</Text>
              </View>
              <View style={styles.statSep} />
              <View style={styles.statItem}>
                <Text style={styles.statNum}>0</Text>
                <Text style={styles.statLbl}>done</Text>
              </View>
            </View>

            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: '0%' }]} />
            </View>
            <Text style={styles.progressLabel}>All mountains available</Text>

            <View style={{ flex: 1 }} />

            <TouchableOpacity style={styles.settingsBtn} onPress={handleSettings}>
              <Ionicons name="settings-outline" size={13} color="rgba(255,255,255,0.7)" />
              <Text style={styles.settingsBtnText}>Settings</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogoutPress}>
              <Ionicons name="log-out-outline" size={13} color="#E07070" />
              <Text style={styles.logoutBtnText}>Logout</Text>
            </TouchableOpacity>
          </View>

          {/* Vertical divider */}
          <View style={styles.dividerV} />

          {/* Right panel */}
          <View style={styles.rightPanel}>

            {/* Header row */}
            <View style={styles.listHeader}>
              <Text style={styles.listTitle}>
                {activeTab === 'stats'
                  ? 'Mountains'
                  : activeTab === 'calendar'
                  ? 'Schedule'
                  : activeTab === 'wildtrack'
                  ? 'WildTrack'
                  : activeTab === 'weather'
                  ? 'Weather'
                  : 'Location'}
              </Text>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={14} color="rgba(255,255,255,0.4)" />
              </TouchableOpacity>
            </View>

            {/* Stats tab – list all mountains with green dot */}
            {activeTab === 'stats' && (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}>
                {mountains.map((mountain, index) => (
                  <View
                    key={mountain.id}
                    style={[styles.mountainRow, index === mountains.length - 1 && styles.mountainRowLast]}
                  >
                    <View style={[styles.dot, styles.dotUnlocked]} />
                    <Text style={styles.mountainName} numberOfLines={1}>
                      {mountain.name}
                    </Text>
                    <Text style={styles.summitedTag}>open</Text>
                  </View>
                ))}
              </ScrollView>
            )}

            {activeTab === 'calendar' && (
              <View style={styles.tabPane}>
                <Ionicons name="calendar-outline" size={28} color="rgba(201,169,110,0.5)" />
                <Text style={styles.tabPaneTitle}>Your Schedule</Text>
                <Text style={styles.tabPaneBody}>
                  Plan your next summit. View upcoming hikes and set reminders for your climbs.
                </Text>
                <TouchableOpacity
                  style={styles.tabPaneBtn}
                  onPress={() => { onClose(); router.push('/Calendar'); }}
                >
                  <Text style={styles.tabPaneBtnText}>Open Calendar</Text>
                  <Ionicons name="arrow-forward" size={11} color="#C9A96E" />
                </TouchableOpacity>
              </View>
            )}

            {activeTab === 'wildtrack' && (
              <View style={styles.tabPane}>
                <Ionicons name="book-outline" size={28} color="rgba(201,169,110,0.5)" />
                <Text style={styles.tabPaneTitle}>WildTrack</Text>
                <Text style={styles.tabPaneBody}>
                  A field guide to the trails. Flora, fauna, safety tips, and local knowledge — everything you need before the climb.
                </Text>
                <TouchableOpacity
                  style={styles.tabPaneBtn}
                  onPress={() => { onClose(); router.push('/wildtrack/WildTrack'); }}
                >
                  <Text style={styles.tabPaneBtnText}>Open WildTrack</Text>
                  <Ionicons name="arrow-forward" size={11} color="#C9A96E" />
                </TouchableOpacity>
              </View>
            )}

            {activeTab === 'weather' && (
              <View style={styles.tabPane}>
                <Ionicons name="cloud-outline" size={28} color="rgba(201,169,110,0.5)" />
                <Text style={styles.tabPaneTitle}>Weather</Text>
                {weatherLoading ? (
                  <View style={styles.weatherStatusRow}>
                    <ActivityIndicator size="small" color="#C9A96E" />
                    <Text style={styles.weatherStatusText}>Loading weather...</Text>
                  </View>
                ) : weather ? (
                  <>
                    <Text style={styles.weatherTitle}>{weather.description}</Text>
                    <Text style={styles.weatherValue}>{weather.temperature.toFixed(1)}°C</Text>
                    <Text style={styles.weatherDetails} numberOfLines={2}>
                      Feels like {weather.feelsLike.toFixed(1)}°C · Humidity {weather.humidity}% · Wind {weather.windSpeed.toFixed(1)} m/s
                    </Text>
                    <Text style={styles.weatherAdvice} numberOfLines={2}>
                      {weatherService.getWeatherSafetyAdvice(weather)}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.weatherDetails} numberOfLines={3}>
                    {weatherError || 'Weather data not available.'}
                  </Text>
                )}
                <TouchableOpacity
                  style={styles.tabPaneBtn}
                  onPress={() => { onClose(); router.push('/Weather'); }}
                >
                  <Text style={styles.tabPaneBtnText}>Open Full Weather</Text>
                  <Ionicons name="arrow-forward" size={11} color="#C9A96E" />
                </TouchableOpacity>
              </View>
            )}

            {activeTab === 'location' && (
              <View style={styles.tabPane}>
                <Ionicons name="location-outline" size={28} color="rgba(201,169,110,0.5)" />
                <Text style={styles.tabPaneTitle}>Location</Text>
                {locationLoading && !lastLocation ? (
                  <View style={styles.weatherStatusRow}>
                    <ActivityIndicator size="small" color="#C9A96E" />
                    <Text style={styles.weatherStatusText}>Acquiring GPS…</Text>
                  </View>
                ) : lastLocation ? (
                  <>
                    <Text style={styles.weatherTitle}>
                      {lastLocation.latitude.toFixed(4)}°, {lastLocation.longitude.toFixed(4)}°
                    </Text>
                    <Text style={styles.weatherDetails} numberOfLines={2}>
                      {lastLocation.accuracy != null ? `±${lastLocation.accuracy.toFixed(0)}m accuracy` : ''}
                      {lastLocation.altitude != null ? ` · ${lastLocation.altitude.toFixed(0)}m alt` : ''}
                      {lastLocation.speed != null && lastLocation.speed > 0 ? ` · ${lastLocation.speed.toFixed(1)} m/s` : ''}
                    </Text>
                    <View style={styles.weatherStatusRow}>
                      <View style={[styles.trackingDot, { backgroundColor: trackingStatus.isForegroundActive ? '#6FAF8A' : 'rgba(255,255,255,0.2)' }]} />
                      <Text style={styles.tabPaneBody}>
                        {trackingStatus.isForegroundActive ? 'Tracking active' : 'Tracking paused'}
                      </Text>
                    </View>
                  </>
                ) : (
                  <Text style={styles.tabPaneBody}>
                    {locationPerms.foreground
                      ? 'Start tracking to see your GPS coordinates.'
                      : 'Location permission required. Tap below to grant access.'}
                  </Text>
                )}
                <TouchableOpacity
                  style={styles.tabPaneBtn}
                  onPress={() => { onClose(); router.push('/Location'); }}
                >
                  <Text style={styles.tabPaneBtnText}>Open Location</Text>
                  <Ionicons name="arrow-forward" size={11} color="#C9A96E" />
                </TouchableOpacity>
              </View>
            )}

            {/* Tab strip */}
            <View style={styles.tabStrip}>
              <View style={styles.tabStripInner}>
                {([
                  { id: 'stats', icon: 'stats-chart' },
                  { id: 'calendar', icon: 'calendar-outline' },
                  { id: 'wildtrack', icon: 'book-outline' },
                  { id: 'weather', icon: 'cloud-outline' },
                  { id: 'location', icon: 'location-outline' },
                ] as { id: TabId; icon: string }[]).map((tab, i, arr) => (
                  <TouchableOpacity
                    key={tab.id}
                    style={[
                      styles.tabIconBtn,
                      i < arr.length - 1 && styles.tabIconBtnBorder,
                    ]}
                    onPress={() => setActiveTab(tab.id)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={tab.icon as any}
                      size={13}
                      color={activeTab === tab.id ? '#C9A96E' : 'rgba(255,255,255,0.28)'}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </View>

          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  card: {
    flexDirection: 'row',
    width: '78%',
    maxWidth: 500,
    height: 280,
    backgroundColor: '#0E1520',
    borderRadius: 16,
    overflow: 'visible',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    position: 'relative',
  },
  leftPanel: {
    width: 160,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    alignItems: 'flex-start',
    backgroundColor: '#111927',
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  avatar: {
    position: 'absolute',
    top: 11,
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1E2D42',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: 0,
    borderWidth: 1,
    borderColor: 'rgba(201,169,110,0.4)',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarInitials: {
    color: '#C9A96E',
    fontSize: 16,
    fontWeight: '700',
  },
  name: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
    marginTop: 40,
  },
  email: {
    color: 'rgba(255,255,255,0.38)',
    fontSize: 10,
    marginBottom: 6,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginBottom: 10,
  },
  locationText: {
    color: '#8A9BB0',
    fontSize: 10,
  },
  dividerH: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignSelf: 'stretch',
    marginBottom: 10,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 0,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statSep: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  statNum: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 18,
  },
  statLbl: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  progressTrack: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 2,
    alignSelf: 'stretch',
    marginBottom: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#C9A96E',
    borderRadius: 2,
  },
  progressLabel: {
    color: 'rgba(255,255,255,0.28)',
    fontSize: 9,
    marginBottom: 0,
  },
  settingsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'stretch',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 5,
    justifyContent: 'center',
  },
  settingsBtnText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '600',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'stretch',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(224,112,112,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(224,112,112,0.2)',
    justifyContent: 'center',
  },
  logoutBtnText: {
    color: '#E07070',
    fontSize: 11,
    fontWeight: '600',
  },
  dividerV: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  rightPanel: {
    flex: 1,
    paddingTop: 14,
    paddingBottom: 14,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
    overflow: 'visible',
    backgroundColor: '#0E1520',
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  listTitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  closeBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 14,
  },
  mountainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  mountainRowLast: {
    borderBottomWidth: 0,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  dotUnlocked: {
    backgroundColor: '#C9A96E',
  },
  mountainName: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  summitedTag: {
    color: '#6FAF8A',
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tabStrip: {
    position: 'absolute',
    right: -24,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabStripInner: {
    backgroundColor: '#0E1520',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    borderLeftWidth: 0,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    overflow: 'hidden',
  },
  tabIconBtn: {
    width: 24,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconBtnBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  tabPane: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 12,
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 1,
  },
  tabPaneTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  tabPaneBody: {
    color: 'rgba(255,255,255,0.38)',
    fontSize: 10,
    lineHeight: 14,
    flexShrink: 1,
  },
  weatherDetails: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 10,
    lineHeight: 13,
    marginTop: 6,
    maxHeight: 38,
    flexShrink: 1,
  },
  tabPaneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(201,169,110,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(201,169,110,0.25)',
    alignSelf: 'stretch',
    justifyContent: 'center',
    marginTop: 4,
  },
  tabPaneBtnText: {
    color: '#C9A96E',
    fontSize: 10,
    fontWeight: '600',
  },
  weatherStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  trackingDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  weatherStatusText: {
    color: '#FFFFFF',
    fontSize: 11,
  },
  weatherTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 6,
  },
  weatherValue: {
    fontSize: 24,
    color: '#C9A96E',
    fontWeight: '800',
    marginTop: 2,
  },
  weatherAdvice: {
    color: '#D4C28A',
    fontSize: 10,
    lineHeight: 14,
    marginTop: 6,
    flexShrink: 1,
  },
});