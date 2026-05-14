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
} from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useHikesStore } from '../store/hikesStore';
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
  const { hikes, fetchHikes, createHike, updateHike, deleteHike, isLoading } = useHikesStore();
  const { user } = useAuthStore();

  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingHike, setEditingHike] = useState<Hike | null>(null);
  const [formData, setFormData] = useState<HikeFormData>(INITIAL_FORM);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchHikes();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchHikes();
    setRefreshing(false);
  }, [fetchHikes]);

  const markedDates = hikes.reduce((acc, hike) => {
    const isSelected = hike.date === selectedDate;
    acc[hike.date] = {
      marked: true,
      dotColor: '#2C3E50',
      selected: isSelected,
      selectedColor: '#D4A574',
    };
    return acc;
  }, {} as { [key: string]: any });

  const handleDayPress = (day: DateData) => {
    setSelectedDate(day.dateString);
  };

  const openAddModal = () => {
    setEditingHike(null);
    setFormData({
      ...INITIAL_FORM,
      date: selectedDate,
    });
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
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <View style={styles.calendarCard}>
          <View style={styles.calendarHeaderTop}>
            <View style={styles.calendarHeaderItem}>
              <View style={styles.calendarIconWrapper}>
                <Ionicons name="calendar" size={20} color="#FFFFFF" />
              </View>
              <View>
                <Text style={styles.calendarTitle}>Calendar</Text>
                <Text style={styles.calendarSubTitle}>Tap a date to view hikes</Text>
              </View>
            </View>
            <TouchableOpacity onPress={openAddModal} style={styles.newHikeButtonCompact}>
              <Ionicons name="add" size={18} color="#2C3E50" />
              <Text style={styles.newHikeButtonTextCompact}>New Hike</Text>
            </TouchableOpacity>
          </View>
          <Calendar
            style={styles.calendar}
            onDayPress={handleDayPress}
            markedDates={markedDates}
            theme={{
              backgroundColor: '#FFFFFF',
              calendarBackground: '#FFFFFF',
              selectedDayBackgroundColor: '#2C3E50',
              selectedDayTextColor: '#FFFFFF',
              todayTextColor: '#D4A574',
              todayBackgroundColor: '#F5E6D3',
              dayTextColor: '#2C3E50',
              textDisabledColor: '#CBD5E1',
              dotColor: '#2C3E50',
              arrowColor: '#2C3E50',
              monthTextColor: '#2C3E50',
              textMonthFontWeight: 'bold',
              textDayFontSize: 14,
              textMonthFontSize: 16,
              textDayHeaderFontSize: 12,
              textDayHeaderFontWeight: '600',
            }}
            enableSwipeMonths
            renderArrow={(direction: 'left' | 'right') => (
              <View style={styles.arrowWrapper}>
                <Ionicons name={direction === 'left' ? 'chevron-back' : 'chevron-forward'} size={18} color="#2C3E50" />
              </View>
            )}
          />
        </View>
      </ScrollView>

      <Modal animationType="fade" transparent visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalHeaderSmall}>{editingHike ? 'Update Your Adventure' : 'Plan New Adventure'}</Text>
                <Text style={styles.modalHeaderTitle}>{editingHike ? 'Edit Hike' : 'Schedule Hike'}</Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalCloseButton}>
                <Ionicons name="close" size={24} color="#2C3E50" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScrollContent}>
              <View style={styles.modalDateCard}>
                <View style={styles.modalDateRow}>
                  <View style={styles.modalDateIconWrapper}>
                    <Ionicons name="calendar" size={24} color="#FFFFFF" />
                  </View>
                  <View>
                    <Text style={styles.modalLabelText}>Selected Date</Text>
                    <Text style={styles.modalDateText}>{formatDate(formData.date)}</Text>
                  </View>
                </View>
              </View>
              <View style={styles.modalRow}>
                <View style={[styles.modalField, styles.modalFieldMarginRight]}>
                  <Text style={styles.modalLabel}>Start Time</Text>
                  <View style={styles.modalInputRow}>
                    <Ionicons name="time-outline" size={20} color="#6B7280" style={styles.iconMarginRight} />
                    <TextInput
                      style={styles.modalInput}
                      value={formData.start_time}
                      onChangeText={(text) => setFormData({ ...formData, start_time: text })}
                      placeholder="08:00"
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>
                </View>
                <View style={styles.modalField}>
                  <Text style={styles.modalLabel}>End Time</Text>
                  <View style={styles.modalInputRow}>
                    <Ionicons name="time-outline" size={20} color="#6B7280" style={styles.iconMarginRight} />
                    <TextInput
                      style={styles.modalInput}
                      value={formData.end_time}
                      onChangeText={(text) => setFormData({ ...formData, end_time: text })}
                      placeholder="16:00"
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>
                </View>
              </View>
              <View style={styles.modalFieldGroup}>
                <Text style={styles.modalLabel}>Number of Tagalongs</Text>
                <View style={styles.modalInputRow}>
                  <Ionicons name="people-outline" size={20} color="#6B7280" style={styles.iconMarginRight} />
                  <TextInput
                    style={styles.modalInput}
                    value={formData.tagalongs}
                    onChangeText={(text) => setFormData({ ...formData, tagalongs: text })}
                    keyboardType="number-pad"
                    placeholder="How many people?"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>
              </View>
              <View style={styles.modalFieldGroup}>
                <Text style={styles.modalLabel}>Contact Number *</Text>
                <View style={styles.modalInputRow}>
                  <Ionicons name="call-outline" size={20} color="#16A34A" style={styles.iconMarginRight} />
                  <TextInput
                    style={styles.modalInput}
                    value={formData.contact_number}
                    onChangeText={(text) => setFormData({ ...formData, contact_number: text })}
                    keyboardType="phone-pad"
                    placeholder="Your contact number"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>
              </View>
              <View style={styles.modalFieldGroupLarge}>
                <Text style={styles.modalLabel}>Emergency Reference *</Text>
                <View style={styles.modalInputRow}>
                  <Ionicons name="warning-outline" size={20} color="#EA580C" style={styles.iconMarginRight} />
                  <TextInput
                    style={styles.modalInput}
                    value={formData.emergency_contact}
                    onChangeText={(text) => setFormData({ ...formData, emergency_contact: text })}
                    placeholder="Emergency contact name & number"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>
              </View>
              <TouchableOpacity
                onPress={handleSave}
                disabled={isLoading}
                style={[styles.modalButton, isLoading ? styles.modalButtonDisabled : styles.modalButtonPrimary]}
              >
                <Ionicons name={editingHike ? 'save' : 'add-circle'} size={24} color="#FFFFFF" />
                <Text style={styles.modalButtonText}>{isLoading ? 'Saving...' : (editingHike ? 'Update Hike' : 'Schedule Hike')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.cancelButton}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5E6D3',
  },
  newHikeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  newHikeButtonText: {
    color: '#2C3E50',
    fontWeight: 'bold',
    marginLeft: 6,
  },
  newHikeButtonCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  newHikeButtonTextCompact: {
    color: '#2C3E50',
    fontWeight: 'bold',
    marginLeft: 6,
    fontSize: 12,
  },
  calendarHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  calendarCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(212,165,116,0.1)',
    width: '100%',
    marginBottom: 20,
  },
  calendar: {
    width: '100%',
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  calendarHeaderItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  calendarIconWrapper: {
    backgroundColor: '#2C3E50',
    padding: 8,
    borderRadius: 18,
    marginRight: 12,
  },
  calendarTitle: {
    color: '#2C3E50',
    fontSize: 18,
    fontWeight: 'bold',
  },
  calendarSubTitle: {
    color: '#6B7280',
    fontSize: 12,
  },
  arrowWrapper: {
    backgroundColor: '#F5E6D3',
    padding: 10,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  hikesWrapper: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  emptyStateCard: {
    alignItems: 'center',
    paddingVertical: 36,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 20,
    marginHorizontal: 12,
  },
  emptyStateIcon: {
    backgroundColor: '#F5E6D3',
    padding: 18,
    borderRadius: 999,
    marginBottom: 14,
  },
  emptyStateTitle: {
    color: '#2C3E50',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  emptyStateText: {
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  emptyStateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2C3E50',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyStateButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    marginLeft: 8,
    fontSize: 14,
  },
  hikeList: {
    gap: 16,
  },
  hikeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(212,165,116,0.2)',
    marginBottom: 16,
  },
  hikeCardHeader: {
    backgroundColor: '#2C3E50',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  hikeCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hikeCardHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  hikeCardHeaderBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  hikeCardHeaderBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  hikeCardBody: {
    padding: 14,
  },
  tagBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  tagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5E6D3',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  tagBadgeText: {
    color: '#2C3E50',
    fontWeight: '600',
    marginLeft: 8,
  },
  contactCard: {
    backgroundColor: '#F3F4F6',
    borderRadius: 18,
    padding: 12,
    marginBottom: 12,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  contactIconWrapperGreen: {
    backgroundColor: '#DCFCE7',
    padding: 10,
    borderRadius: 14,
    marginRight: 10,
  },
  contactIconWrapperOrange: {
    backgroundColor: '#FFEDD5',
    padding: 10,
    borderRadius: 14,
    marginRight: 10,
  },
  contactBlock: {
    flex: 1,
  },
  contactLabel: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
  },
  contactText: {
    color: '#2C3E50',
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 18,
    marginRight: 8,
  },
  actionButtonPrimary: {
    backgroundColor: '#F5E6D3',
  },
  actionButtonDanger: {
    backgroundColor: '#FEF2F2',
  },
  actionButtonText: {
    color: '#2C3E50',
    fontWeight: 'bold',
    marginLeft: 6,
    fontSize: 12,
  },
  actionDangerText: {
    color: '#DC2626',
    fontWeight: 'bold',
    marginLeft: 6,
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 520,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalHeaderSmall: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '500',
  },
  modalHeaderTitle: {
    color: '#2C3E50',
    fontSize: 28,
    fontWeight: 'bold',
  },
  modalCloseButton: {
    backgroundColor: '#F3F4F6',
    padding: 8,
    borderRadius: 999,
  },
  modalScrollContent: {
    paddingBottom: 24,
  },
  modalDateCard: {
    backgroundColor: 'rgba(245,230,211,0.5)',
    borderRadius: 24,
    padding: 16,
    marginBottom: 20,
  },
  modalDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalDateIconWrapper: {
    backgroundColor: '#2C3E50',
    padding: 12,
    borderRadius: 18,
    marginRight: 16,
  },
  modalLabelText: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '500',
  },
  modalDateText: {
    color: '#2C3E50',
    fontWeight: 'bold',
    fontSize: 18,
  },
  modalRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  modalField: {
    flex: 1,
  },
  modalFieldMarginRight: {
    marginRight: 8,
  },
  modalFieldGroup: {
    marginBottom: 16,
  },
  modalFieldGroupLarge: {
    marginBottom: 24,
  },
  modalLabel: {
    color: '#2C3E50',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  modalInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 16,
  },
  modalInput: {
    flex: 1,
    paddingVertical: 14,
    color: '#2C3E50',
    fontWeight: '600',
  },
  iconMarginRight: {
    marginRight: 8,
  },
  modalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 24,
    marginTop: 8,
  },
  modalButtonPrimary: {
    backgroundColor: '#2C3E50',
  },
  modalButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    marginLeft: 8,
    fontSize: 16,
  },
  cancelButton: {
    paddingVertical: 16,
    borderRadius: 24,
    marginTop: 12,
  },
  cancelButtonText: {
    color: '#6B7280',
    fontWeight: '600',
    textAlign: 'center',
    fontSize: 16,
  },
});
