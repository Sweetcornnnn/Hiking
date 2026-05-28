import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  Alert,
  RefreshControl,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';
import { useRouter } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useHikesStore } from '../store/hikesStore';
import { useWildTrackStore } from '../store/wildtrackStore';
import { getMountainById } from '../data/mountains';
import { getWeatherForecast } from '../services/weatherService';
import { Hike } from '../types';
import { useAuthStore } from '../store/authStore';

interface HikeFormData {
  date: string;
  start_time: string;
  end_time: string;
  tagalongs: string;
  contact_number: string;
  emergency_contact: string;
}

const INITIAL_FORM: HikeFormData = {
  date: new Date().toISOString().split('T')[0],
  start_time: '08:00',
  end_time: '16:00',
  tagalongs: '1',
  contact_number: '',
  emergency_contact: '',
};

export default function CalendarScreen() {
  const router = useRouter();
  const navigation = useNavigation<any>();
  const { hikes, fetchHikes, createHike, updateHike, deleteHike, isLoading } = useHikesStore();
  const { user } = useAuthStore();
  const { selectedMountainId } = useWildTrackStore();

  const selectedMountain = getMountainById(selectedMountainId) || getMountainById('1');

  const handleBackPress = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      router.replace('/drawer/home');
    }
  };

  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingHike, setEditingHike] = useState<Hike | null>(null);
  const [formData, setFormData] = useState<HikeFormData>(INITIAL_FORM);
  const [refreshing, setRefreshing] = useState(false);
  const [forecastByDate, setForecastByDate] = useState<Record<string, { icon: string; description: string; tempMin: number; tempMax: number }>>({});
  const [forecastLoading, setForecastLoading] = useState(false);

  useEffect(() => {
    fetchHikes();
  }, []);

  useEffect(() => {
    const loadForecast = async () => {
      if (!selectedMountain) {
        return;
      }

      setForecastLoading(true);
      try {
        const forecast = await getWeatherForecast(selectedMountain.latitude, selectedMountain.longitude);
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
  }, [selectedMountain?.latitude, selectedMountain?.longitude]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchHikes();
    setRefreshing(false);
  }, [fetchHikes]);

  const markedDates = hikes.reduce((acc, hike) => {
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
  const handleDayPress = (day: DateData) => {
    setSelectedDate(day.dateString);
    setEditingHike(null);
    setFormData({ ...INITIAL_FORM, date: day.dateString });
    setModalVisible(true);
  };

  const openEditModal = (hike: Hike) => {
    setEditingHike(hike);
    setFormData({
      date: hike.date,
      start_time: hike.start_time,
      end_time: hike.end_time,
      tagalongs: hike.tagalongs.toString(),
      contact_number: hike.contact_number,
      emergency_contact: hike.emergency_contact,
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!formData.contact_number || !formData.emergency_contact) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    const hikeData = {
      date: formData.date,
      start_time: formData.start_time,
      end_time: formData.end_time,
      tagalongs: parseInt(formData.tagalongs) || 1,
      contact_number: formData.contact_number,
      emergency_contact: formData.emergency_contact,
    };

    if (editingHike) {
      const { error } = await updateHike(editingHike.id, hikeData);
      if (error) {
        Alert.alert('Error', error);
      } else {
        Alert.alert('Success', 'Hike updated successfully');
        setModalVisible(false);
      }
    } else {
      const { error } = await createHike(hikeData);
      if (error) {
        Alert.alert('Error', error);
      } else {
        Alert.alert('Success', 'Hike scheduled successfully');
        setModalVisible(false);
      }
    }
  };

  const handleDelete = (hike: Hike) => {
    Alert.alert(
      'Delete Hike',
      'Are you sure you want to delete this hike?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } = await deleteHike(hike.id);
            if (error) {
              Alert.alert('Error', error);
            } else {
              Alert.alert('Success', 'Hike deleted');
            }
          },
        },
      ]
    );
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
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

  const getWeatherIconColor = (iconCode?: string, isSelected?: boolean) => {
    if (!iconCode) {
      return isSelected ? '#0E1520' : 'rgba(201,169,110,0.35)';
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

  const hikeDates = new Set(hikes.map((hike) => hike.date));
  const hikesOnSelectedDate = hikes.filter((h) => h.date === selectedDate);
  const todayDateString = new Date().toISOString().split('T')[0];

  const renderDayComponent = ({ date, state, onPress }: { date?: DateData; state?: string; onPress?: (date: DateData) => void }) => {
    if (!date) {
      return null;
    }

    const weather = forecastByDate[date.dateString];
    const hasHike = hikeDates.has(date.dateString);
    const isSelected = date.dateString === selectedDate;
    const isToday = date.dateString === todayDateString;
    const isDisabled = state === 'disabled';
    const weatherIconName = getWeatherIconName(weather?.icon);
    const weatherIconColor = getWeatherIconColor(weather?.icon, isSelected);

    return (
      <TouchableOpacity
        onPress={() => !isDisabled && onPress?.(date)}
        style={[
          styles.dayContainer,
          isSelected && styles.daySelected,
          !isSelected && isToday && styles.dayToday,
          isDisabled && styles.dayDisabled,
        ]}
        activeOpacity={0.7}
      >
        <Text style={[
          styles.dayNumber,
          isDisabled && styles.dayNumberDisabled,
          isSelected && styles.dayNumberSelected,
          !isSelected && isToday && styles.dayNumberToday,
        ]}>
          {date.day}
        </Text>

        <Ionicons
          name={weatherIconName}
          size={14}
          color={weatherIconColor}
          style={[styles.weatherMarker, !weather && styles.weatherMarkerPlaceholder]}
        />

        {hasHike ? (
          <View style={styles.hikeMarker}>
            <Ionicons name="people-outline" size={10} color="#C9A96E" />
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#C9A96E" />}
      >
        {/* Calendar card */}
        <View style={styles.calendarCard}>
          <View style={styles.calendarHeaderTop}>
            <View style={styles.calendarHeaderItem}>
              <View style={styles.calendarIconWrapper}>
                <Ionicons name="calendar" size={16} color="#C9A96E" />
              </View>
              <View>
                <Text style={styles.calendarTitle}>Calendar</Text>
                <Text style={styles.calendarSubTitle}>Tap a date to schedule a hike</Text>
                {forecastLoading ? (
                  <Text style={styles.forecastLoadingText}>Updating forecast for selected mountain...</Text>
                ) : null}
              </View>
            </View>
            <TouchableOpacity
              style={styles.homeBtn}
              onPress={handleBackPress}
              accessibilityLabel="Go back"
              accessibilityRole="button"
            >
              <Ionicons name="arrow-back-outline" size={18} color="#C9A96E" />
            </TouchableOpacity>
          </View>

          <Calendar
            style={styles.calendar}
            onDayPress={handleDayPress}
            markedDates={markedDates}
            dayComponent={renderDayComponent}
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
              textDayFontSize: 13,
              textMonthFontSize: 14,
              textDayHeaderFontSize: 11,
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
            <View style={styles.legendItem}>
              <Ionicons name="partly-sunny-outline" size={12} color="#C9A96E" />
              <Text style={styles.legendText}>Weather</Text>
            </View>
            <View style={styles.legendItem}>
              <Ionicons name="people-outline" size={12} color="#C9A96E" />
              <Text style={styles.legendText}>Hike scheduled</Text>
            </View>
          </View>
        </View>

        {/* Hike list for selected date */}
        <View style={styles.hikesSection}>
          <Text style={styles.hikesSectionLabel}>
            {hikesOnSelectedDate.length > 0
              ? `${hikesOnSelectedDate.length} hike${hikesOnSelectedDate.length > 1 ? 's' : ''} on this day`
              : 'No hikes on this date'}
          </Text>

          {hikesOnSelectedDate.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="map-outline" size={22} color="rgba(201,169,110,0.5)" />
              </View>
              <Text style={styles.emptyTitle}>Nothing planned yet</Text>
              <Text style={styles.emptyBody}>Tap any date on the calendar to schedule a hike.</Text>
            </View>
          ) : (
            <View style={styles.hikeList}>
              {hikesOnSelectedDate.map((hike) => (
                <View key={hike.id} style={styles.hikeCard}>
                  {/* Card header */}
                  <View style={styles.hikeCardHeader}>
                    <View style={styles.hikeCardHeaderLeft}>
                      <View style={styles.hikeIconWrap}>
                        <Ionicons name="trail-sign" size={14} color="#C9A96E" />
                      </View>
                      <Text style={styles.hikeCardTitle}>Hike</Text>
                    </View>
                    <View style={styles.hikeBadge}>
                      <Ionicons name="time-outline" size={11} color="rgba(201,169,110,0.7)" />
                      <Text style={styles.hikeBadgeText}>
                        {formatTime(hike.start_time)} – {formatTime(hike.end_time)}
                      </Text>
                    </View>
                  </View>

                  {/* Card body */}
                  <View style={styles.hikeCardBody}>
                    <View style={styles.hikeInfoRow}>
                      <View style={styles.hikeInfoItem}>
                        <Ionicons name="people-outline" size={13} color="rgba(255,255,255,0.4)" />
                        <Text style={styles.hikeInfoLabel}>Tagalongs</Text>
                        <Text style={styles.hikeInfoValue}>{hike.tagalongs}</Text>
                      </View>
                      <View style={styles.hikeInfoDivider} />
                      <View style={styles.hikeInfoItem}>
                        <Ionicons name="call-outline" size={13} color="rgba(255,255,255,0.4)" />
                        <Text style={styles.hikeInfoLabel}>Contact</Text>
                        <Text style={styles.hikeInfoValue} numberOfLines={1}>{hike.contact_number}</Text>
                      </View>
                    </View>

                    <View style={styles.emergencyRow}>
                      <Ionicons name="warning-outline" size={12} color="rgba(201,169,110,0.6)" />
                      <Text style={styles.emergencyLabel}>Emergency</Text>
                      <Text style={styles.emergencyValue} numberOfLines={1}>{hike.emergency_contact}</Text>
                    </View>

                    <View style={styles.hikeActions}>
                      <TouchableOpacity style={styles.editBtn} onPress={() => openEditModal(hike)}>
                        <Ionicons name="pencil-outline" size={13} color="#C9A96E" />
                        <Text style={styles.editBtnText}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(hike)}>
                        <Ionicons name="trash-outline" size={13} color="#E07070" />
                        <Text style={styles.deleteBtnText}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Modal — ProfileCard dark theme */}
      <Modal animationType="fade" transparent visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>

            {/* Left accent panel */}
            <View style={styles.modalLeftPanel}>
              <View style={styles.modalAvatarWrap}>
                <Ionicons name="trail-sign" size={18} color="#C9A96E" />
              </View>
              <Text style={styles.modalPanelTitle}>
                {editingHike ? 'Edit\nHike' : 'New\nHike'}
              </Text>

              <View style={styles.modalDividerH} />

              <View style={styles.modalDateBlock}>
                <Ionicons name="calendar-outline" size={12} color="rgba(201,169,110,0.6)" />
                <Text style={styles.modalDateSmall}>{formData.date}</Text>
              </View>

              <Text style={styles.modalDateFull} numberOfLines={3}>
                {formatDate(formData.date)}
              </Text>

              <View style={{ flex: 1 }} />

              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={12} color="rgba(255,255,255,0.5)" />
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>

            {/* Vertical divider */}
            <View style={styles.modalDividerV} />

            {/* Right form panel */}
            <View style={styles.modalRightPanel}>
              <View style={styles.modalRightHeader}>
                <Text style={styles.modalRightTitle}>
                  {editingHike ? 'Update Adventure' : 'Plan Adventure'}
                </Text>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalFormScroll}>

                {/* Time row */}
                <Text style={styles.fieldGroupLabel}>Time</Text>
                <View style={styles.timeRow}>
                  <View style={styles.timeField}>
                    <Text style={styles.fieldLabel}>Start</Text>
                    <View style={styles.inputWrap}>
                      <Ionicons name="time-outline" size={12} color="rgba(201,169,110,0.5)" style={styles.inputIcon} />
                      <TextInput
                        style={styles.input}
                        value={formData.start_time}
                        onChangeText={(text) => setFormData({ ...formData, start_time: text })}
                        placeholder="08:00"
                        placeholderTextColor="rgba(255,255,255,0.18)"
                      />
                    </View>
                  </View>
                  <View style={styles.timeSep}>
                    <Text style={styles.timeSepText}>–</Text>
                  </View>
                  <View style={styles.timeField}>
                    <Text style={styles.fieldLabel}>End</Text>
                    <View style={styles.inputWrap}>
                      <Ionicons name="time-outline" size={12} color="rgba(201,169,110,0.5)" style={styles.inputIcon} />
                      <TextInput
                        style={styles.input}
                        value={formData.end_time}
                        onChangeText={(text) => setFormData({ ...formData, end_time: text })}
                        placeholder="16:00"
                        placeholderTextColor="rgba(255,255,255,0.18)"
                      />
                    </View>
                  </View>
                </View>

                {/* Tagalongs */}
                <Text style={styles.fieldGroupLabel}>Group</Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="people-outline" size={12} color="rgba(201,169,110,0.5)" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={formData.tagalongs}
                    onChangeText={(text) => setFormData({ ...formData, tagalongs: text })}
                    keyboardType="number-pad"
                    placeholder="Number of tagalongs"
                    placeholderTextColor="rgba(255,255,255,0.18)"
                  />
                </View>

                {/* Contact */}
                <Text style={styles.fieldGroupLabel}>Contact *</Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="call-outline" size={12} color="rgba(110,175,138,0.6)" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={formData.contact_number}
                    onChangeText={(text) => setFormData({ ...formData, contact_number: text })}
                    keyboardType="phone-pad"
                    placeholder="Your contact number"
                    placeholderTextColor="rgba(255,255,255,0.18)"
                  />
                </View>

                {/* Emergency */}
                <Text style={styles.fieldGroupLabel}>Emergency *</Text>
                <View style={[styles.inputWrap, styles.inputWrapLast]}>
                  <Ionicons name="warning-outline" size={12} color="rgba(224,112,112,0.6)" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={formData.emergency_contact}
                    onChangeText={(text) => setFormData({ ...formData, emergency_contact: text })}
                    placeholder="Name & number"
                    placeholderTextColor="rgba(255,255,255,0.18)"
                  />
                </View>

                {/* Save button */}
                <TouchableOpacity
                  onPress={handleSave}
                  disabled={isLoading}
                  style={[styles.saveBtn, isLoading && styles.saveBtnDisabled]}
                >
                  <Ionicons name={editingHike ? 'save-outline' : 'add-circle-outline'} size={14} color={isLoading ? 'rgba(255,255,255,0.4)' : '#0E1520'} />
                  <Text style={[styles.saveBtnText, isLoading && styles.saveBtnTextDisabled]}>
                    {isLoading ? 'Saving…' : editingHike ? 'Update Hike' : 'Schedule Hike'}
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
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
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 28,
  },

  // ── Calendar card ────────────────────────────
  calendarCard: {
    backgroundColor: '#0E1520',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    padding: 12,
    marginBottom: 16,
  },
  calendarHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  calendarHeaderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  homeBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarIconWrapper: {
    backgroundColor: 'rgba(201,169,110,0.1)',
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(201,169,110,0.2)',
  },
  calendarTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  calendarSubTitle: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 10,
  },
  calendar: {
    width: '100%',
  },
  dayContainer: {
    width: 42,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    borderRadius: 14,
    marginVertical: 2,
  },
  daySelected: {
    backgroundColor: '#C9A96E',
  },
  dayToday: {
    borderWidth: 1,
    borderColor: 'rgba(201,169,110,0.6)',
  },
  dayDisabled: {
    opacity: 0.4,
  },
  dayNumber: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  dayNumberToday: {
    color: '#C9A96E',
  },
  dayNumberDisabled: {
    color: 'rgba(255,255,255,0.28)',
  },
  dayNumberSelected: {
    color: '#0E1520',
  },
  weatherMarker: {
    marginTop: 4,
  },
  weatherMarkerPlaceholder: {
    opacity: 0.28,
  },
  hikeMarker: {
    marginTop: 4,
    backgroundColor: 'rgba(201,169,110,0.12)',
    padding: 2,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 12,
    marginTop: 10,
    paddingHorizontal: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  legendText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
  },
  forecastLoadingText: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 10,
    marginTop: 2,
  },
  arrowWrapper: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },

  // ── Hikes section ────────────────────────────
  hikesSection: {
    gap: 10,
  },
  hikesSectionLabel: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
    paddingHorizontal: 2,
  },
  emptyCard: {
    backgroundColor: '#0E1520',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 24,
    alignItems: 'center',
    gap: 6,
  },
  emptyIconWrap: {
    backgroundColor: 'rgba(201,169,110,0.08)',
    padding: 14,
    borderRadius: 40,
    marginBottom: 4,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  emptyBody: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
  },
  hikeList: {
    gap: 10,
  },
  hikeCard: {
    backgroundColor: '#0E1520',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
  },
  hikeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#111927',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  hikeCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hikeIconWrap: {
    backgroundColor: 'rgba(201,169,110,0.1)',
    padding: 6,
    borderRadius: 8,
  },
  hikeCardTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  hikeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(201,169,110,0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(201,169,110,0.18)',
  },
  hikeBadgeText: {
    color: '#C9A96E',
    fontSize: 10,
    fontWeight: '600',
  },
  hikeCardBody: {
    padding: 14,
    gap: 10,
  },
  hikeInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hikeInfoItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hikeInfoDivider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginHorizontal: 8,
  },
  hikeInfoLabel: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 10,
  },
  hikeInfoValue: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  emergencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(201,169,110,0.05)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  emergencyLabel: {
    color: 'rgba(201,169,110,0.6)',
    fontSize: 10,
    fontWeight: '600',
  },
  emergencyValue: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    flex: 1,
  },
  hikeActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(201,169,110,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(201,169,110,0.25)',
  },
  editBtnText: {
    color: '#C9A96E',
    fontSize: 11,
    fontWeight: '600',
  },
  deleteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(224,112,112,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(224,112,112,0.2)',
  },
  deleteBtnText: {
    color: '#E07070',
    fontSize: 11,
    fontWeight: '600',
  },

  // ── Modal ────────────────────────────────────
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    padding: 20,
  },
  modalCard: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: 420,
    height: 260,
    backgroundColor: '#0E1520',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },

  // Left accent panel (mirrors ProfileCard leftPanel)
  modalLeftPanel: {
    width: 110,
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 12,
    alignItems: 'flex-start',
    backgroundColor: '#111927',
  },
  modalAvatarWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(201,169,110,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(201,169,110,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  modalPanelTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
    marginBottom: 10,
  },
  modalDividerH: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignSelf: 'stretch',
    marginBottom: 10,
  },
  modalDateBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  modalDateSmall: {
    color: 'rgba(201,169,110,0.6)',
    fontSize: 9,
    fontWeight: '600',
  },
  modalDateFull: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    lineHeight: 15,
  },
  modalCancelBtn: {
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
    justifyContent: 'center',
  },
  modalCancelText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '600',
  },

  // Vertical divider
  modalDividerV: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },

  // Right form panel
  modalRightPanel: {
    flex: 1,
    paddingTop: 14,
    paddingBottom: 0,
    backgroundColor: '#0E1520',
    overflow: 'hidden',
  },
  modalRightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  modalRightTitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  modalCloseBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalFormScroll: {
    paddingHorizontal: 14,
    paddingBottom: 1,
    gap: 6,
  },
  fieldGroupLabel: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 4,
    marginBottom: 4,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  timeField: {
    flex: 1,
  },
  fieldLabel: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 9,
    marginBottom: 3,
  },
  timeSep: {
    paddingTop: 14,
  },
  timeSepText: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 12,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 10,
    marginBottom: 4,
  },
  inputWrapLast: {
    marginBottom: 10,
  },
  inputIcon: {
    marginRight: 6,
  },
  input: {
    flex: 1,
    paddingVertical: 9,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#C9A96E',
    marginBottom: 12,
  },
  saveBtnDisabled: {
    backgroundColor: 'rgba(201,169,110,0.3)',
  },
  saveBtnText: {
    color: '#0E1520',
    fontWeight: '700',
    fontSize: 12,
  },
  saveBtnTextDisabled: {
    color: 'rgba(14,21,32,0.5)',
  },
});