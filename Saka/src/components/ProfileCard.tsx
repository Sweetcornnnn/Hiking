import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  useWindowDimensions,
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
import EmergencyContactFeature, {
  createEmptyPlan,
  EmergencyPlan,
} from './emergency/EmergencyContactFeature';
import { useJournalStore } from '../store/journalStore';
import JournalShowcase from './journal/JournalShowcase';

interface ProfileCardProps {
  visible: boolean;
  onClose: () => void;
  onRequestLogout: () => void;
  profileImage?: string | null;
  onAvatarPress?: () => void;
  onProfileImageSelect?: (uri: string) => void;
}

// Font-scale caps. Tight UI (buttons, labels, header) stops growing sooner than
// body copy so the card keeps its shape when the system font size is large.
const TIGHT_FONT_CAP = 1.2;
const BODY_FONT_CAP = 1.5;

const TITLES: Record<string, string> = {
  home: 'Quick Access',
  showcase: 'Showcase',
  journal: 'Journal',
  calendar: 'Schedule',
  wildtrack: 'WildTrack',
  weather: 'Weather',
  location: 'Location',
  emergency: 'Emergency Contact',
};

type ViewId =
  | 'home'
  | 'showcase'
  | 'journal'
  | 'calendar'
  | 'wildtrack'
  | 'weather'
  | 'location'
  | 'emergency';

export default function ProfileCard({
  visible,
  onClose,
  onRequestLogout,
  profileImage,
  onAvatarPress,
  onProfileImageSelect
}: ProfileCardProps) {
  const router = useRouter();
  const { height: windowHeight, fontScale } = useWindowDimensions();
  const { user, profile } = useAuthStore();
  const { selectedMountainId } = useWildTrackStore();

  const [selectedMountain, setSelectedMountain] = useState<Mountain | null>(null);
  const [mountains, setMountains] = useState<Mountain[]>([]);
  const [location, setLocation] = useState<string>('Loading...');
  const [view, setView] = useState<ViewId>('home');
  const [weather, setWeather] = useState<WeatherCondition | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [emergencyPlan, setEmergencyPlan] = useState<EmergencyPlan>(createEmptyPlan);
  const {
    entries: journalEntries,
    isLoading: journalLoading,
    error: journalError,
    fetchEntries,
  } = useJournalStore();

  const {
    lastLocation,
    trackingStatus,
    isLoading: locationLoading,
    startTracking,
    stopTracking,
    permissions: locationPerms,
    requestPermissions,
  } = useLocationTracking();

  // Responsive sizing driven by the device's font scale.
  const clampedScale = Math.min(Math.max(fontScale, 1), BODY_FONT_CAP);
  const cardHeight = Math.min(Math.round(280 * clampedScale), windowHeight - 24);
  const leftPanelWidth = Math.round(160 * Math.min(clampedScale, 1.25));

  // Only show the "Become an organizer" CTA to users who aren't already orgs.
  const canBecomeOrganizer =
    profile?.role !== 'organization' && !profile?.organization_id;

  async function loadWeather(mountain: Mountain) {
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
  }

  // Load mountains when visible and align the current mountain to the active selection
  useEffect(() => {
    if (visible) {
      setView('home');
      fetchEntries();
      const loadData = async () => {
        try {
          const data = await mountainService.fetchMountains();
          setMountains(data);

          const currentMountain =
            data.find((mountain) => mountain.id === selectedMountainId) || data[0] || null;

          setSelectedMountain(currentMountain);
          if (currentMountain) {
            setLocation(currentMountain.name);
            loadWeather(currentMountain);
          }
        } catch (error) {
          console.error('Failed to load mountains for ProfileCard', error);
        }
      };
      loadData();
    }
  }, [visible]);

  const handleLogoutPress = () => {
    onClose();
    onRequestLogout();
  };

  const handleSettings = () => {
    onClose();
    router.push('/Settings');
  };

  const handleEmergencyPlanSave = (plan: EmergencyPlan) => {
    setEmergencyPlan(plan);
    Alert.alert(
      'Emergency plan saved',
      'This is saved in app memory for now. Account storage and overdue alerts are not connected yet.'
    );
  };

  const openScreen = (screen: 'calendar' | 'wildtrack' | 'journal' | 'weather' | 'location') => {
    onClose();
    if (screen === 'calendar') {
      router.push({
        pathname: '/Calendar',
        params: { mountainId: selectedMountain?.id ?? selectedMountainId ?? undefined },
      });
    } else if (screen === 'wildtrack') {
      router.push('/wildtrack/WildTrack');
    } else if (screen === 'journal') {
      router.push('/journal');
    } else if (screen === 'weather') {
      router.push('/Weather');
    } else {
      router.push('/Location');
    }
  };

  const quickActions: {
    id: 'calendar' | 'wildtrack';
    icon: string;
    label: string;
    caption: string;
  }[] = [
    { id: 'calendar', icon: 'calendar-outline', label: 'Schedule', caption: 'Plan your climbs' },
    { id: 'wildtrack', icon: 'leaf-outline', label: 'WildTrack', caption: 'Trail field guide' },
  ];

  const simplePanes = {
    journal: {
      icon: 'book-outline',
      title: 'Your experiences',
      body: journalEntries.length
        ? `${journalEntries.length} saved ${journalEntries.length === 1 ? 'entry' : 'entries'}. Add another memory from the trail.`
        : 'Write about a hike, add photos, and make the memory part of your profile.',
      button: 'Open Journal',
    },
    calendar: {
      icon: 'calendar-outline',
      title: 'Your Schedule',
      body: 'Plan your next summit. View upcoming hikes and set reminders for your climbs.',
      button: 'Open Calendar',
    },
    wildtrack: {
      icon: 'leaf-outline',
      title: 'WildTrack',
      body: 'A field guide to the trails. Flora, fauna, safety tips, and local knowledge — everything you need before the climb.',
      button: 'Open WildTrack',
    },
  } as const;
  const simplePane =
    view === 'journal' || view === 'calendar' || view === 'wildtrack' ? simplePanes[view] : null;

  const journalCaption = journalEntries.length
    ? `${journalEntries.length} ${journalEntries.length === 1 ? 'entry' : 'entries'}`
    : 'Write a memory';
  const weatherStatus = weatherLoading
    ? 'Loading…'
    : weather
    ? `${weather.temperature.toFixed(0)}°C`
    : 'Unavailable';
  const locationStatus =
    locationLoading && !lastLocation
      ? 'Locating…'
      : trackingStatus.isForegroundActive
      ? 'Tracking'
      : 'Paused';

  const handleBecomeOrganizer = () => {
    onClose();
    router.push('/organizations/BecomeOrganizer');
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
        <View style={[styles.card, { height: cardHeight }]}>

          {/* Left panel */}
          <View style={[styles.leftPanel, { width: leftPanelWidth }]}>
            <TouchableOpacity style={styles.avatar} onPress={handleAvatarPress} activeOpacity={0.8}>
              {profileImage ? (
                <Image source={{ uri: profileImage }} style={styles.avatarImage} resizeMode="cover" />
              ) : (
                <Text style={styles.avatarInitials} maxFontSizeMultiplier={TIGHT_FONT_CAP}>{initials}</Text>
              )}
            </TouchableOpacity>

            <Text style={styles.name} maxFontSizeMultiplier={TIGHT_FONT_CAP} numberOfLines={1}>{user?.name || 'Hiker'}</Text>
            <Text style={styles.email} maxFontSizeMultiplier={TIGHT_FONT_CAP} numberOfLines={1}>{user?.email || 'email@example.com'}</Text>

            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={11} color="#8A9BB0" />
              <Text style={styles.locationText} maxFontSizeMultiplier={TIGHT_FONT_CAP} numberOfLines={1}>{location}</Text>
            </View>

            <View style={{ flex: 1 }} />

            {canBecomeOrganizer && (
              <TouchableOpacity
                style={styles.organizerBtn}
                onPress={handleBecomeOrganizer}
                activeOpacity={0.8}
              >
                <Ionicons name="business-outline" size={12} color="#C9A96E" />
                <Text style={styles.organizerBtnText} maxFontSizeMultiplier={TIGHT_FONT_CAP}>Become Organizer</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.settingsBtn} onPress={handleSettings}>
              <Ionicons name="settings-outline" size={13} color="rgba(255,255,255,0.7)" />
              <Text style={styles.settingsBtnText} maxFontSizeMultiplier={TIGHT_FONT_CAP}>Settings</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogoutPress}>
              <Ionicons name="log-out-outline" size={13} color="#E07070" />
              <Text style={styles.logoutBtnText} maxFontSizeMultiplier={TIGHT_FONT_CAP}>Logout</Text>
            </TouchableOpacity>
          </View>

          {/* Vertical divider */}
          <View style={styles.dividerV} />

          {/* Right panel */}
          <View style={styles.rightPanel}>

            {/* Header row */}
            <View style={styles.listHeader}>
              <View style={styles.listHeaderLeft}>
                {view !== 'home' && (
                  <TouchableOpacity
                    onPress={() => setView('home')}
                    style={styles.backBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Back to quick access"
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="chevron-back" size={14} color="#C9A96E" />
                  </TouchableOpacity>
                )}
                <Text style={styles.listTitle} maxFontSizeMultiplier={TIGHT_FONT_CAP} numberOfLines={1}>
                  {TITLES[view]}
                </Text>
              </View>
              <TouchableOpacity
                onPress={onClose}
                style={styles.closeBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={14} color="rgba(255,255,255,0.4)" />
              </TouchableOpacity>
            </View>

            {view === 'home' && (
              <ScrollView
                style={styles.paneScroll}
                contentContainerStyle={styles.homeContent}
                showsVerticalScrollIndicator={false}
              >
                {/* Primary: Schedule + WildTrack */}
                <View style={styles.primaryRow}>
                  {quickActions.map((action) => (
                    <TouchableOpacity
                      key={action.id}
                      style={styles.quickBtn}
                      onPress={() => setView(action.id)}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityLabel={`Show ${action.label}`}
                    >
                      <View style={styles.quickIconWrap}>
                        <Ionicons name={action.icon as any} size={18} color="#C9A96E" />
                      </View>
                      <View style={styles.quickTextWrap}>
                        <Text
                          style={styles.quickLabel}
                          maxFontSizeMultiplier={TIGHT_FONT_CAP}
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          minimumFontScale={0.8}
                        >
                          {action.label}
                        </Text>
                        <Text style={styles.quickCaption} maxFontSizeMultiplier={TIGHT_FONT_CAP} numberOfLines={2}>
                          {action.caption}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Journal + Showcase: two buttons in one container */}
                <View style={styles.journalCard}>
                  <TouchableOpacity
                    style={styles.journalBtn}
                    onPress={() => setView('journal')}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="Open Journal"
                  >
                    <Ionicons name="book-outline" size={18} color="#C9A96E" />
                    <View style={styles.quickTextWrap}>
                      <Text style={styles.quickLabel} maxFontSizeMultiplier={TIGHT_FONT_CAP} numberOfLines={1}>
                        Journal
                      </Text>
                      <Text style={styles.quickCaption} maxFontSizeMultiplier={TIGHT_FONT_CAP} numberOfLines={2}>
                        {journalCaption}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <View style={styles.journalDivider} />

                  <TouchableOpacity
                    style={styles.journalBtn}
                    onPress={() => setView('showcase')}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="Open Showcase"
                  >
                    <Ionicons name="images-outline" size={18} color="#C9A96E" />
                    <View style={styles.quickTextWrap}>
                      <Text style={styles.quickLabel} maxFontSizeMultiplier={TIGHT_FONT_CAP} numberOfLines={1}>
                        Showcase
                      </Text>
                      <Text style={styles.quickCaption} maxFontSizeMultiplier={TIGHT_FONT_CAP} numberOfLines={2}>
                        Your best memories
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>

                {/* Secondary: Weather, Location, Emergency (smaller) */}
                <View style={styles.secondaryRow}>
                  <TouchableOpacity
                    style={styles.miniBtn}
                    onPress={() => setView('weather')}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="Open Weather"
                  >
                    <Ionicons name="cloud-outline" size={14} color="rgba(201,169,110,0.8)" />
                    <View style={styles.quickTextWrap}>
                      <Text style={styles.miniLabel} maxFontSizeMultiplier={TIGHT_FONT_CAP} numberOfLines={1}>Weather</Text>
                      <Text style={styles.miniStatus} maxFontSizeMultiplier={TIGHT_FONT_CAP} numberOfLines={1}>{weatherStatus}</Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.miniBtn}
                    onPress={() => setView('location')}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="Open Location"
                  >
                    <Ionicons name="location-outline" size={14} color="rgba(201,169,110,0.8)" />
                    <View style={styles.quickTextWrap}>
                      <Text style={styles.miniLabel} maxFontSizeMultiplier={TIGHT_FONT_CAP} numberOfLines={1}>Location</Text>
                      <Text style={styles.miniStatus} maxFontSizeMultiplier={TIGHT_FONT_CAP} numberOfLines={1}>{locationStatus}</Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.miniBtn}
                    onPress={() => setView('emergency')}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="Open Emergency Contact"
                  >
                    <Ionicons name="alert-circle-outline" size={14} color="#E07070" />
                    <View style={styles.quickTextWrap}>
                      <Text style={styles.miniLabel} maxFontSizeMultiplier={TIGHT_FONT_CAP} numberOfLines={1}>Emergency</Text>
                      <Text style={styles.miniStatus} maxFontSizeMultiplier={TIGHT_FONT_CAP} numberOfLines={1}>Safety plan</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}

            {view === 'showcase' && (
              <View style={styles.showcasePane}>
                {journalError ? (
                  <Text style={styles.tabPaneBody} maxFontSizeMultiplier={BODY_FONT_CAP}>{journalError}</Text>
                ) : (
                  <JournalShowcase entries={journalEntries} mountains={mountains} isLoading={journalLoading} />
                )}
              </View>
            )}

            {simplePane && (
              <ScrollView
                style={styles.paneScroll}
                contentContainerStyle={styles.tabPaneContent}
                showsVerticalScrollIndicator={false}
              >
                <Ionicons name={simplePane.icon as any} size={28} color="rgba(201,169,110,0.5)" />
                <Text style={styles.tabPaneTitle} maxFontSizeMultiplier={BODY_FONT_CAP}>{simplePane.title}</Text>
                <Text style={styles.tabPaneBody} maxFontSizeMultiplier={BODY_FONT_CAP}>{simplePane.body}</Text>
                <TouchableOpacity
                  style={styles.tabPaneBtn}
                  onPress={() => openScreen(view as 'journal' | 'calendar' | 'wildtrack')}
                >
                  <Text style={styles.tabPaneBtnText} maxFontSizeMultiplier={TIGHT_FONT_CAP}>{simplePane.button}</Text>
                  <Ionicons name="arrow-forward" size={11} color="#C9A96E" />
                </TouchableOpacity>
              </ScrollView>
            )}

{view === 'weather' && (
              <ScrollView
                style={styles.paneScroll}
                contentContainerStyle={styles.tabPaneContent}
                showsVerticalScrollIndicator={false}
              >
                <Ionicons name="cloud-outline" size={28} color="rgba(201,169,110,0.5)" />
                <Text style={styles.tabPaneTitle} maxFontSizeMultiplier={BODY_FONT_CAP}>Weather</Text>
                {weatherLoading ? (
                  <View style={styles.weatherStatusRow}>
                    <ActivityIndicator size="small" color="#C9A96E" />
                    <Text style={styles.weatherStatusText} maxFontSizeMultiplier={BODY_FONT_CAP}>Loading weather...</Text>
                  </View>
                ) : weather ? (
                  <>
                    <Text style={styles.weatherTitle} maxFontSizeMultiplier={BODY_FONT_CAP}>{weather.description}</Text>
                    <Text style={styles.weatherValue} maxFontSizeMultiplier={BODY_FONT_CAP}>{weather.temperature.toFixed(1)}°C</Text>
                    <Text style={styles.weatherDetails} maxFontSizeMultiplier={BODY_FONT_CAP}>
                      Feels like {weather.feelsLike.toFixed(1)}°C · Humidity {weather.humidity}% · Wind {weather.windSpeed.toFixed(1)} m/s
                    </Text>
                    <Text style={styles.weatherAdvice} maxFontSizeMultiplier={BODY_FONT_CAP}>
                      {weatherService.getWeatherSafetyAdvice(weather)}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.weatherDetails} maxFontSizeMultiplier={BODY_FONT_CAP}>
                    {weatherError || 'Weather data not available.'}
                  </Text>
                )}
                <TouchableOpacity
                  style={styles.tabPaneBtn}
                  onPress={() => { onClose(); router.push('/Weather'); }}
                >
                  <Text style={styles.tabPaneBtnText} maxFontSizeMultiplier={TIGHT_FONT_CAP}>Open Full Weather</Text>
                  <Ionicons name="arrow-forward" size={11} color="#C9A96E" />
                </TouchableOpacity>
              </ScrollView>
            )}

{view === 'location' && (
              <ScrollView
                style={styles.paneScroll}
                contentContainerStyle={styles.tabPaneContent}
                showsVerticalScrollIndicator={false}
              >
                <Ionicons name="location-outline" size={28} color="rgba(201,169,110,0.5)" />
                <Text style={styles.tabPaneTitle} maxFontSizeMultiplier={BODY_FONT_CAP}>Location</Text>
                {locationLoading && !lastLocation ? (
                  <View style={styles.weatherStatusRow}>
                    <ActivityIndicator size="small" color="#C9A96E" />
                    <Text style={styles.weatherStatusText} maxFontSizeMultiplier={BODY_FONT_CAP}>Acquiring GPS…</Text>
                  </View>
                ) : lastLocation ? (
                  <>
                    <Text style={styles.weatherTitle} maxFontSizeMultiplier={BODY_FONT_CAP}>
                      {lastLocation.latitude.toFixed(4)}°, {lastLocation.longitude.toFixed(4)}°
                    </Text>
                    <Text style={styles.weatherDetails} maxFontSizeMultiplier={BODY_FONT_CAP}>
                      {lastLocation.accuracy != null ? `±${lastLocation.accuracy.toFixed(0)}m accuracy` : ''}
                      {lastLocation.altitude != null ? ` · ${lastLocation.altitude.toFixed(0)}m alt` : ''}
                      {lastLocation.speed != null && lastLocation.speed > 0 ? ` · ${lastLocation.speed.toFixed(1)} m/s` : ''}
                    </Text>
                    <View style={styles.weatherStatusRow}>
                      <View style={[styles.trackingDot, { backgroundColor: trackingStatus.isForegroundActive ? '#6FAF8A' : 'rgba(255,255,255,0.2)' }]} />
                      <Text style={styles.tabPaneBody} maxFontSizeMultiplier={BODY_FONT_CAP}>
                        {trackingStatus.isForegroundActive ? 'Tracking active' : 'Tracking paused'}
                      </Text>
                    </View>
                  </>
                ) : (
                  <Text style={styles.tabPaneBody} maxFontSizeMultiplier={BODY_FONT_CAP}>
                    {locationPerms.foreground
                      ? 'Start tracking to see your GPS coordinates.'
                      : 'Location permission required. Tap below to grant access.'}
                  </Text>
                )}
                <TouchableOpacity
                  style={styles.tabPaneBtn}
                  onPress={() => { onClose(); router.push('/Location'); }}
                >
                  <Text style={styles.tabPaneBtnText} maxFontSizeMultiplier={TIGHT_FONT_CAP}>Open Location</Text>
                  <Ionicons name="arrow-forward" size={11} color="#C9A96E" />
                </TouchableOpacity>
              </ScrollView>
            )}

            <View style={view === 'emergency' ? styles.emergencyTabContainer : styles.hiddenTab}>
              <EmergencyContactFeature
                embedded
                visible={view === 'emergency'}
                onClose={() => setView('home')}
                initialValue={emergencyPlan}
                onSave={handleEmergencyPlanSave}
              />
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
    height: 280, // overridden at runtime by font scale
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
    marginTop: 36,
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
    marginBottom: 8,
  },
  locationText: {
    color: '#8A9BB0',
    fontSize: 10,
  },
  organizerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'stretch',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(201,169,110,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(201,169,110,0.28)',
    marginBottom: 5,
    justifyContent: 'center',
  },
  organizerBtnText: {
    color: '#C9A96E',
    fontSize: 11,
    fontWeight: '700',
  },
  settingsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'stretch',
    paddingVertical: 6,
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
    paddingVertical: 6,
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
  emergencyTabContainer: {
    flex: 1,
    minHeight: 0,
  },
  hiddenTab: {
    display: 'none',
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
  listHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  backBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(201,169,110,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  paneScroll: {
    flex: 1,
  },
  homeContent: {
    flexGrow: 1,
    paddingHorizontal: 14,
    paddingBottom: 2,
    gap: 8,
  },
  primaryRow: {
    flexDirection: 'row',
    gap: 8,
  },
  quickBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(201,169,110,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(201,169,110,0.25)',
  },
  quickIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(201,169,110,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickTextWrap: {
    flex: 1,
  },
  quickLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  quickCaption: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 9,
  },
  journalCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 12,
    backgroundColor: 'rgba(201,169,110,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(201,169,110,0.25)',
    overflow: 'hidden',
  },
  journalBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 56,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  journalDivider: {
    width: 1,
    backgroundColor: 'rgba(201,169,110,0.25)',
  },
  showcasePane: {
    flex: 1,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  tabPaneContent: {
    flexGrow: 1,
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
  weatherDetails: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 10,
    lineHeight: 13,
    marginTop: 6,
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
  secondaryRow: {
    flexDirection: 'row',
    gap: 6,
  },
  miniBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  miniLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 10,
    fontWeight: '600',
  },
  miniStatus: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 9,
  },
  tabPaneBody: {
    color: 'rgba(255,255,255,0.38)',
    fontSize: 10,
    lineHeight: 14,
    flexShrink: 1,
  },
});