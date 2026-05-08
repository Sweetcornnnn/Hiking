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
} from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useHikesStore, Hike } from '../store/hikesStore';
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

  // Prepare marked dates for calendar
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

  // Filter hikes for selected date
  const selectedDateHikes = hikes.filter(hike => hike.date === selectedDate);

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
    // Validation
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
    const hour = parseInt(hours);
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
    <View className="flex-1 bg-saka-cream">
      {/* Enhanced Header with Gradient Background */}
      <View className="bg-saka-dark px-6 pt-12 pb-6 rounded-b-3xl shadow-lg">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <TouchableOpacity 
              onPress={() => router.back()} 
              className="mr-4 bg-white/10 p-2 rounded-full"
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <View>
              <Text className="text-white/70 text-sm font-medium">Adventure Planner</Text>
              <Text className="text-white text-2xl font-bold">My Hikes</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={openAddModal}
            className="bg-white px-4 py-2.5 rounded-full flex-row items-center shadow-md"
          >
            <Ionicons name="add" size={20} color="#2C3E50" />
            <Text className="text-saka-dark font-bold ml-1">New Hike</Text>
          </TouchableOpacity>
        </View>
        
        {/* Quick Stats */}
        <View className="flex-row mt-6 bg-white/10 rounded-2xl p-4">
          <View className="flex-1 items-center border-r border-white/20">
            <Ionicons name="calendar" size={24} color="#D4A574" />
            <Text className="text-white text-lg font-bold mt-1">{hikes.length}</Text>
            <Text className="text-white/70 text-xs">Total Hikes</Text>
          </View>
          <View className="flex-1 items-center border-r border-white/20">
            <Ionicons name="people" size={24} color="#D4A574" />
            <Text className="text-white text-lg font-bold mt-1">
              {hikes.reduce((sum, h) => sum + h.tagalongs, 0)}
            </Text>
            <Text className="text-white/70 text-xs">Tagalongs</Text>
          </View>
          <View className="flex-1 items-center">
            <Ionicons name="trending-up" size={24} color="#D4A574" />
            <Text className="text-white text-lg font-bold mt-1">
              {hikes.filter(h => new Date(h.date) >= new Date()).length}
            </Text>
            <Text className="text-white/70 text-xs">Upcoming</Text>
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Enhanced Calendar Card */}
        <View className="mx-4 -mt-4 bg-white rounded-3xl shadow-xl p-4 border border-saka-sand/10">
          {/* Calendar Header */}
          <View className="flex-row items-center justify-between mb-4 px-2">
            <View className="flex-row items-center">
              <View className="bg-saka-dark p-2 rounded-xl mr-3">
                <Ionicons name="calendar" size={20} color="#FFFFFF" />
              </View>
              <View>
                <Text className="text-saka-dark font-bold text-lg">Calendar</Text>
                <Text className="text-saka-gray text-xs">Tap a date to view hikes</Text>
              </View>
            </View>
          </View>
          <Calendar
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
            enableSwipeMonths={true}
            renderArrow={(direction: 'left' | 'right') => (
              <View className="bg-saka-cream p-2.5 rounded-full shadow-sm">
                <Ionicons 
                  name={direction === 'left' ? 'chevron-back' : 'chevron-forward'} 
                  size={18} 
                  color="#2C3E50" 
                />
              </View>
            )}
          />
        </View>

        {/* Enhanced Selected Date Header */}
        <View className="mx-4 mt-4">
          <View className="bg-saka-dark p-5 rounded-2xl shadow-lg overflow-hidden">
            {/* Decorative background element */}
            <View className="absolute -right-8 -top-8 w-32 h-32 bg-white/5 rounded-full" />
            <View className="absolute -left-4 -bottom-4 w-20 h-20 bg-white/5 rounded-full" />
            
            <View className="flex-row items-center justify-between relative z-10">
              <View className="flex-row items-center">
                <View className="bg-white/20 p-3 rounded-xl mr-4 backdrop-blur-sm">
                  <Ionicons name="calendar-clear" size={28} color="#FFFFFF" />
                </View>
                <View>
                  <Text className="text-white/80 text-sm font-medium mb-1">Selected Date</Text>
                  <Text className="text-white text-lg font-bold" numberOfLines={1}>
                    {formatDate(selectedDate)}
                  </Text>
                </View>
              </View>
              <View className="bg-white/20 px-4 py-2 rounded-full backdrop-blur-sm items-center">
                <Text className="text-white font-bold text-xl">
                  {selectedDateHikes.length}
                </Text>
                <Text className="text-white/80 text-xs">
                  hike{selectedDateHikes.length !== 1 ? 's' : ''}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Enhanced Hikes List */}
        <View className="px-4 py-4">
          {selectedDateHikes.length === 0 ? (
            <View className="items-center py-12 bg-white/50 rounded-3xl mx-4">
              <View className="bg-saka-cream p-6 rounded-full mb-4">
                <Ionicons name="trail-sign-outline" size={48} color="#D4A574" />
              </View>
              <Text className="text-saka-dark font-bold text-xl mb-2">No Hikes Planned</Text>
              <Text className="text-saka-gray text-center px-8 mb-6">
                Your adventure awaits! Select a date and schedule your next mountain climb.
              </Text>
              <TouchableOpacity
                onPress={openAddModal}
                className="bg-saka-dark px-8 py-4 rounded-full flex-row items-center shadow-lg"
              >
                <Ionicons name="add-circle" size={24} color="#FFFFFF" />
                <Text className="text-white font-bold ml-2 text-lg">Plan Your Hike</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View className="gap-4">
              {selectedDateHikes.map((hike, index) => (
                <View
                  key={hike.id}
                  className="bg-white rounded-2xl overflow-hidden shadow-lg border border-saka-sand/20"
                >
                  {/* Card Header with Time */}
                  <View className="bg-saka-dark px-5 py-4">
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center">
                        <Ionicons name="time" size={20} color="#D4A574" />
                        <Text className="text-white font-bold text-lg ml-3">
                          {formatTime(hike.start_time)} - {formatTime(hike.end_time)}
                        </Text>
                      </View>
                      <View className="bg-white/20 px-3 py-1 rounded-full">
                        <Text className="text-white text-xs font-bold">
                          Hike #{index + 1}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Card Body */}
                  <View className="p-5">
                    {/* Tagalongs Badge */}
                    <View className="flex-row items-center mb-4">
                      <View className="bg-saka-cream px-4 py-2 rounded-full flex-row items-center">
                        <Ionicons name="people" size={18} color="#8B7355" />
                        <Text className="text-saka-dark font-semibold ml-2">
                          {hike.tagalongs} tagalong{hike.tagalongs !== 1 ? 's' : ''}
                        </Text>
                      </View>
                    </View>

                    {/* Contact Info */}
                    <View className="bg-gray-50 rounded-xl p-4 mb-4">
                      <View className="flex-row items-center mb-3">
                        <View className="bg-green-100 p-2 rounded-lg mr-3">
                          <Ionicons name="call" size={18} color="#16A34A" />
                        </View>
                        <View className="flex-1">
                          <Text className="text-gray-500 text-xs font-medium">Contact</Text>
                          <Text className="text-saka-dark font-semibold">{hike.contact_number}</Text>
                        </View>
                      </View>
                      <View className="flex-row items-center">
                        <View className="bg-orange-100 p-2 rounded-lg mr-3">
                          <Ionicons name="warning" size={18} color="#EA580C" />
                        </View>
                        <View className="flex-1">
                          <Text className="text-gray-500 text-xs font-medium">Emergency</Text>
                          <Text className="text-saka-dark font-semibold">{hike.emergency_contact}</Text>
                        </View>
                      </View>
                    </View>

                    {/* Action Buttons */}
                    <View className="flex-row gap-3">
                      <TouchableOpacity
                        onPress={() => openEditModal(hike)}
                        className="flex-1 bg-saka-cream py-3 rounded-xl flex-row items-center justify-center"
                      >
                        <Ionicons name="create" size={20} color="#2C3E50" />
                        <Text className="text-saka-dark font-bold ml-2">Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDelete(hike)}
                        className="flex-1 bg-red-50 py-3 rounded-xl flex-row items-center justify-center"
                      >
                        <Ionicons name="trash" size={20} color="#DC2626" />
                        <Text className="text-red-600 font-bold ml-2">Delete</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Enhanced Add/Edit Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/60">
          <View className="bg-white rounded-t-3xl p-6 max-h-[90%]">
            {/* Modal Handle */}
            <View className="w-12 h-1 bg-gray-300 rounded-full self-center mb-4" />
            
            {/* Modal Header */}
            <View className="flex-row justify-between items-center mb-6">
              <View>
                <Text className="text-gray-500 text-sm font-medium">
                  {editingHike ? 'Update Your Adventure' : 'Plan New Adventure'}
                </Text>
                <Text className="text-saka-dark text-2xl font-bold">
                  {editingHike ? 'Edit Hike' : 'Schedule Hike'}
                </Text>
              </View>
              <TouchableOpacity 
                onPress={() => setModalVisible(false)}
                className="bg-gray-100 p-2 rounded-full"
              >
                <Ionicons name="close" size={24} color="#2C3E50" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Selected Date Display */}
              <View className="bg-saka-cream/50 rounded-2xl p-4 mb-5">
                <View className="flex-row items-center">
                  <View className="bg-saka-dark p-3 rounded-xl mr-4">
                    <Ionicons name="calendar" size={24} color="#FFFFFF" />
                  </View>
                  <View>
                    <Text className="text-gray-500 text-xs font-medium">Selected Date</Text>
                    <Text className="text-saka-dark font-bold text-lg">{formatDate(formData.date)}</Text>
                  </View>
                </View>
              </View>

              {/* Time Range */}
              <View className="flex-row mb-4">
                <View className="flex-1 mr-2">
                  <Text className="text-saka-dark font-semibold mb-2 text-sm">Start Time</Text>
                  <View className="bg-gray-50 rounded-xl flex-row items-center px-4">
                    <Ionicons name="time-outline" size={20} color="#6B7280" className="mr-2" />
                    <TextInput
                      className="flex-1 py-3.5 text-saka-dark font-semibold"
                      value={formData.start_time}
                      onChangeText={(text) => setFormData({ ...formData, start_time: text })}
                      placeholder="08:00"
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>
                </View>
                <View className="flex-1 ml-2">
                  <Text className="text-saka-dark font-semibold mb-2 text-sm">End Time</Text>
                  <View className="bg-gray-50 rounded-xl flex-row items-center px-4">
                    <Ionicons name="time-outline" size={20} color="#6B7280" className="mr-2" />
                    <TextInput
                      className="flex-1 py-3.5 text-saka-dark font-semibold"
                      value={formData.end_time}
                      onChangeText={(text) => setFormData({ ...formData, end_time: text })}
                      placeholder="16:00"
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>
                </View>
              </View>

              {/* Tagalongs */}
              <View className="mb-4">
                <Text className="text-saka-dark font-semibold mb-2 text-sm">Number of Tagalongs</Text>
                <View className="bg-gray-50 rounded-xl flex-row items-center px-4">
                  <Ionicons name="people-outline" size={20} color="#6B7280" className="mr-2" />
                  <TextInput
                    className="flex-1 py-3.5 text-saka-dark font-semibold"
                    value={formData.tagalongs}
                    onChangeText={(text) => setFormData({ ...formData, tagalongs: text })}
                    keyboardType="number-pad"
                    placeholder="How many people?"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>
              </View>

              {/* Contact Number */}
              <View className="mb-4">
                <Text className="text-saka-dark font-semibold mb-2 text-sm">Contact Number *</Text>
                <View className="bg-gray-50 rounded-xl flex-row items-center px-4">
                  <Ionicons name="call-outline" size={20} color="#16A34A" className="mr-2" />
                  <TextInput
                    className="flex-1 py-3.5 text-saka-dark font-semibold"
                    value={formData.contact_number}
                    onChangeText={(text) => setFormData({ ...formData, contact_number: text })}
                    keyboardType="phone-pad"
                    placeholder="Your contact number"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>
              </View>

              {/* Emergency Contact */}
              <View className="mb-6">
                <Text className="text-saka-dark font-semibold mb-2 text-sm">Emergency Reference *</Text>
                <View className="bg-gray-50 rounded-xl flex-row items-center px-4">
                  <Ionicons name="warning-outline" size={20} color="#EA580C" className="mr-2" />
                  <TextInput
                    className="flex-1 py-3.5 text-saka-dark font-semibold"
                    value={formData.emergency_contact}
                    onChangeText={(text) => setFormData({ ...formData, emergency_contact: text })}
                    placeholder="Emergency contact name & number"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>
              </View>

              {/* Save Button */}
              <TouchableOpacity
                onPress={handleSave}
                disabled={isLoading}
                className={`py-4 rounded-2xl flex-row items-center justify-center shadow-lg ${isLoading ? 'bg-gray-400' : 'bg-saka-dark'}`}
              >
                <Ionicons 
                  name={editingHike ? "save" : "add-circle"} 
                  size={24} 
                  color="#FFFFFF" 
                />
                <Text className="text-white text-center font-bold text-lg ml-2">
                  {isLoading ? 'Saving...' : (editingHike ? 'Update Hike' : 'Schedule Hike')}
                </Text>
              </TouchableOpacity>
              
              {/* Cancel Button */}
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                className="py-4 rounded-2xl mt-3"
              >
                <Text className="text-gray-500 text-center font-semibold">Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
