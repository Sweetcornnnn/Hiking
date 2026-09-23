import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useHikesStore } from '../store/hikesStore';
import { useWildTrackStore } from '../store/wildtrackStore';
import { mountainService } from '../services/mountainService'; // ⚠️ adjust path if different in your project
import { getWeatherForecast } from '../services/weatherService';
import { useAuthStore } from '../store/authStore';
import HikeFormModal from '../components/HikeFormModal';
import Toast, { ToastHandle } from '../components/Toast';

// ⚠️ Replace with your actual Mountain type import (e.g. from '../types')
// if one already exists — this is a minimal shape to satisfy the fields
// this screen actually uses.
interface Mountain {
  id: string;
  latitude: number;
  longitude: number;
  [key: string]: any;
}

export default function CalendarScreen() {
  const router = useRouter();
  const { mountainId } = useLocalSearchParams<{ mountainId?: string }>();
  const { mountainHikes, fetchMountainHikes } = useHikesStore();
  const { user } = useAuthStore();
  const { selectedMountainId } = useWildTrackStore();

  const activeMountainId = mountainId ?? selectedMountainId ?? null;


  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [modalVisible, setModalVisible] = useState(false);
  const [infoVisible, setInfoVisible] = useState(false);
  const toastRef = useRef<ToastHandle>(null);
  const [forecastByDate, setForecastByDate] = useState<Record<string, { icon: string; description: string; tempMin: number; tempMax: number }>>({});
  const [forecastLoading, setForecastLoading] = useState(false);
  const [resolvedMountain, setResolvedMountain] = useState<Mountain | null>(null);

  useEffect(() => {
    if (!activeMountainId) {
      return;
    }

    fetchMountainHikes(activeMountainId);
  }, [activeMountainId, fetchMountainHikes]);

  // Resolve the active mountain by its Supabase UUID — cache first (same
  // cache MountainTop reads from), then a network fetch as a fallback.
  // No fake '1' fallback: if nothing resolves, resolvedMountain stays null
  // and the weather effect below clears the forecast instead of guessing.
  useEffect(() => {
    let cancelled = false;

    const resolveMountain = async () => {
      if (!activeMountainId) {
        setResolvedMountain(null);
        return;
      }

      const cached = mountainService.getCachedMountainById(activeMountainId);
      if (cached) {
        setResolvedMountain(cached);
        return;
      }

      try {
        const fetched = await mountainService.fetchMountainById(activeMountainId);
        if (!cancelled) {
          setResolvedMountain(fetched ?? null);
        }
      } catch (error) {
        console.warn('[Calendar] Failed to resolve mountain', error);
        if (!cancelled) {
          setResolvedMountain(null);
        }
      }
    };

    resolveMountain();

    return () => {
      cancelled = true;
    };
  }, [activeMountainId]);

  useEffect(() => {
    const loadForecast = async () => {
      if (!resolvedMountain) {
        // Nothing resolved — clear instead of silently showing stale/default weather
        setForecastByDate({});
        return;
      }

      setForecastLoading(true);
      try {
        const forecast = await getWeatherForecast(resolvedMountain.latitude, resolvedMountain.longitude);
        const mappedForecast = forecast.reduce((acc, day) => {
          acc[day.date] = {
            icon: day.icon,
            description: day.description,
            tempMin: day.tempMin,
            tempMax: day.tempMax,
          };
          return acc;
        }, {} as Record<string, { icon: string; description: string; tempMin: number; tempMax: number }>);
        setForecastByDate(mappedForecast);
      } catch (error) {
        console.warn('[Calendar] Failed to load weather forecast', error);
        setForecastByDate({});
      } finally {
        setForecastLoading(false);
      }
    };

    loadForecast();
  }, [resolvedMountain?.id, resolvedMountain?.latitude, resolvedMountain?.longitude]);


  const markedDates = mountainHikes.reduce((acc, hike) => {
    const isSelected = hike.date === selectedDate;
    acc[hike.date] = {
      marked: true,
      dotColor: '#C9A96E',
      selected: isSelected,
      selectedColor: '#C9A96E',
    };
    return acc;
  }, {} as { [key: string]: any });

  // If selected date has no hike, still mark it selected
  if (selectedDate && !markedDates[selectedDate]) {
    markedDates[selectedDate] = { selected: true, selectedColor: '#1E2D3D' };
  }

  // Pressing a date opens the add modal directly
  const lastLongPressAtRef = useRef<number>(0);

  const handleDayPress = (day: DateData) => {
    // React Native's Touchable fires onPress right after onLongPress on
    // release — without this guard, long-pressing a date would toggle the
    // hikes panel AND immediately pop the add-hike modal over it.
    if (Date.now() - lastLongPressAtRef.current < 500) {
      return;
    }
    setSelectedDate(day.dateString);
    setModalVisible(true);
  };

  // Long-pressing a date navigates to the Hikes grid screen for that day
  const handleDayLongPress = (day: DateData) => {
    lastLongPressAtRef.current = Date.now();
    setSelectedDate(day.dateString);
    router.push({
      pathname: '/Hikes',
      params: { date: day.dateString, mountainId: activeMountainId ?? undefined },
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getWeatherIconName = (iconCode: string) => {
    if (!iconCode) {
      return 'cloud-outline';
    }

    if (iconCode.startsWith('01')) return iconCode.endsWith('n') ? 'moon-outline' : 'sunny-outline';
    if (iconCode.startsWith('02')) return iconCode.endsWith('n') ? 'cloudy-night-outline' : 'partly-sunny-outline';
    if (iconCode.startsWith('03')) return 'cloud-outline';
    if (iconCode.startsWith('04')) return 'cloudy-outline';
    if (iconCode.startsWith('09') || iconCode.startsWith('10')) return 'rainy-outline';
    if (iconCode.startsWith('11')) return 'thunderstorm-outline';
    if (iconCode.startsWith('13')) return 'snow-outline';
    if (iconCode.startsWith('50')) return 'cloud-outline';
    return 'cloud-outline';
  };

  const getWeatherIconColor = (iconCode?: string) => {
    if (!iconCode) {
      return 'rgba(201,169,110,0.35)';
    }

    if (iconCode.startsWith('01')) return '#F2C94C';
    if (iconCode.startsWith('02')) return '#F4D48F';
    if (iconCode.startsWith('03') || iconCode.startsWith('04')) return '#A1B0C4';
    if (iconCode.startsWith('09') || iconCode.startsWith('10')) return '#70B7FF';
    if (iconCode.startsWith('11')) return '#A86DFF';
    if (iconCode.startsWith('13')) return '#D8F0FF';
    if (iconCode.startsWith('50')) return '#B0B8C2';
    return '#C9A96E';
  };

  const hikeDates = new Set(mountainHikes.map((hike) => hike.date));
  const todayDateString = new Date().toISOString().split('T')[0];

  const renderDayComponent = ({
    date,
    state,
    onPress,
    onLongPress,
  }: {
    date?: DateData;
    state?: string;
    onPress?: (date: DateData) => void;
    onLongPress?: (date: DateData) => void;
  }) => {
    if (!date) {
      return null;
    }

    const weather = forecastByDate[date.dateString];
    const hasHike = hikeDates.has(date.dateString);
    const isSelected = date.dateString === selectedDate;
    const isToday = date.dateString === todayDateString;
    const isDisabled = state === 'disabled';
    const weatherIconName = getWeatherIconName(weather?.icon);
    const weatherIconColor = getWeatherIconColor(weather?.icon);

    return (
      <TouchableOpacity
        onPress={() => !isDisabled && onPress?.(date)}
        onLongPress={() => !isDisabled && onLongPress?.(date)}
        delayLongPress={350}
        style={[
          styles.dayContainer,
          isSelected && styles.daySelected,
          isDisabled && styles.dayDisabled,
        ]}
        activeOpacity={0.7}
      >
        <Text style={[
          styles.dayNumber,
          isDisabled && styles.dayNumberDisabled,
          isToday && styles.dayNumberToday,
        ]}>
          {date.day}
        </Text>

        <View style={styles.dayIconRow}>
          <Ionicons
            name={weatherIconName}
            size={9}
            color={weatherIconColor}
            style={!weather && styles.weatherMarkerPlaceholder}
          />
          {hasHike ? (
            <View style={styles.hikeMarker}>
              <Ionicons name="people-outline" size={7} color="#C9A96E" />
            </View>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  const handleHomePress = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/Home');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.centerWrap}>
        {/* Calendar card */}
        <View style={styles.calendarCard}>
          {forecastLoading ? (
            <Text style={styles.forecastLoadingText}>Updating forecast…</Text>
          ) : null}

          <Calendar
            style={styles.calendar}
            onDayPress={handleDayPress}
            onDayLongPress={handleDayLongPress}
            markedDates={markedDates}
            dayComponent={renderDayComponent}
            monthFormat="MMMM yyyy"
            renderHeader={(date: any) => (
              <View style={styles.monthHeaderRow}>
                <TouchableOpacity
                  style={styles.headerIconBtn}
                  onPress={handleHomePress}
                  accessibilityLabel="Go home"
                  accessibilityRole="button"
                >
                  <Ionicons name="home-outline" size={13} color="#C9A96E" />
                </TouchableOpacity>
                <Text style={styles.monthHeaderText}>{date ? date.toString('MMMM yyyy') : ''}</Text>
                <TouchableOpacity
                  style={styles.infoBtn}
                  onPress={() => setInfoVisible(true)}
                  accessibilityLabel="How to use the calendar"
                  accessibilityRole="button"
                >
                  <Text style={styles.infoBtnText}>i</Text>
                </TouchableOpacity>
              </View>
            )}
            theme={{
              backgroundColor: 'transparent',
              calendarBackground: 'transparent',
              selectedDayBackgroundColor: '#C9A96E',
              selectedDayTextColor: '#0E1520',
              todayTextColor: '#C9A96E',
              todayBackgroundColor: 'rgba(201,169,110,0.12)',
              dayTextColor: 'rgba(255,255,255,0.75)',
              textDisabledColor: 'rgba(255,255,255,0.2)',
              dotColor: '#C9A96E',
              arrowColor: '#C9A96E',
              monthTextColor: '#FFFFFF',
              textMonthFontWeight: '700',
              textDayFontSize: 11,
              textMonthFontSize: 12,
              textDayHeaderFontSize: 9,
              textDayHeaderFontWeight: '600',
              textSectionTitleColor: 'rgba(255,255,255,0.35)',
            }}
            enableSwipeMonths
            renderArrow={(direction: 'left' | 'right') => (
              <View style={styles.arrowWrapper}>
                <Ionicons
                  name={direction === 'left' ? 'chevron-back' : 'chevron-forward'}
                  size={14}
                  color="#C9A96E"
                />
              </View>
            )}
          />

          <View style={styles.legendRow}>
            <Ionicons name="partly-sunny-outline" size={10} color="rgba(201,169,110,0.7)" />
            <Text style={styles.legendText}>Weather</Text>
            <Text style={styles.legendDot}>·</Text>
            <Ionicons name="people-outline" size={10} color="rgba(201,169,110,0.7)" />
            <Text style={styles.legendText}>Hike scheduled</Text>
          </View>
        </View>
      </View>

      <HikeFormModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        editingHike={null}
        defaultDate={selectedDate}
        mountainId={activeMountainId}
        onSaved={() => {
          toastRef.current?.show({
            type: 'success',
            title: 'Hike scheduled',
            message: 'Added to your calendar.',
          });
        }}
      />
      <Toast ref={toastRef} />

      {/* How-to-use popover, opened from the small "i" circle in the month header */}
      <Modal animationType="fade" transparent visible={infoVisible} onRequestClose={() => setInfoVisible(false)}>
        <View style={styles.infoOverlay}>
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>How to use the calendar</Text>
            <View style={styles.infoRow}>
              <Ionicons name="finger-print-outline" size={14} color="#C9A96E" />
              <Text style={styles.infoText}>Tap a date to schedule a new hike.</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="time-outline" size={14} color="#C9A96E" />
              <Text style={styles.infoText}>Hold a date to see the hikes already planned that day.</Text>
            </View>
            <TouchableOpacity style={styles.infoCloseBtn} onPress={() => setInfoVisible(false)}>
              <Text style={styles.infoCloseBtnText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A111A',
  },
  centerWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },

  // ── Calendar card ────────────────────────────
  calendarCard: {
    backgroundColor: '#0E1520',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    padding: 8,
    marginBottom: 8,
  },
  calendar: {
    width: '100%',
  },
  dayContainer: {
    position: 'relative',
    width: 30,
    minHeight: 30,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 1,
    borderRadius: 8,
    marginVertical: 0.5,
  },
  // Selected = border outline only, not a filled block
  daySelected: {
    borderWidth: 1.5,
    borderColor: '#C9A96E',
    backgroundColor: 'rgba(201,169,110,0.08)',
  },
  dayDisabled: {
    opacity: 0.4,
  },
  dayNumber: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  // Today = accent-colored, bold numeral — kept visually distinct from the
  // border used for "selected" so the two never look the same
  dayNumberToday: {
    color: '#C9A96E',
    fontWeight: '700',
  },
  dayNumberDisabled: {
    color: 'rgba(255,255,255,0.28)',
  },
  // Weather + hike marker now sit side-by-side in one row under the day
  // number, instead of stacked on separate lines.
  dayIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 1,
  },
  weatherMarkerPlaceholder: {
    opacity: 0.28,
  },
  hikeMarker: {
    backgroundColor: 'rgba(201,169,110,0.12)',
    padding: 1,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 3,
  },
  legendText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 9,
  },
  legendDot: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 9,
    marginHorizontal: 2,
  },
  forecastLoadingText: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 9,
    marginBottom: 4,
  },
  arrowWrapper: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 5,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },

  // ── Custom month header (home + month/year + info) ──
  monthHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  headerIconBtn: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthHeaderText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  infoBtn: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(201,169,110,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBtnText: {
    color: '#C9A96E',
    fontSize: 11,
    fontWeight: '700',
    fontStyle: 'italic',
  },

  // ── How-to-use popover ───────────────────────
  infoOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    backgroundColor: 'rgba(10,17,26,0.4)',
  },
  infoCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#0E1520',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 16,
    gap: 10,
  },
  infoTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  infoText: {
    flex: 1,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    lineHeight: 17,
  },
  infoCloseBtn: {
    marginTop: 6,
    alignSelf: 'flex-end',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#C9A96E',
  },
  infoCloseBtnText: {
    color: '#0E1520',
    fontSize: 12,
    fontWeight: '700',
  },
});