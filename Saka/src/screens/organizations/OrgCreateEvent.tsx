import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
} from 'react-native';

export default function OrgCreateEvent() {
  const [title, setTitle] = useState('');
  const [mountain, setMountain] = useState('');
  const [date, setDate] = useState('');
  const [meetingPoint, setMeetingPoint] = useState('');

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Text style={styles.title}>Create hiking event</Text>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Event title</Text>
        <TextInput value={title} onChangeText={setTitle} style={styles.input} placeholder="Sunrise ridge hike" placeholderTextColor="#7A8A99" />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Mountain</Text>
        <TextInput value={mountain} onChangeText={setMountain} style={styles.input} placeholder="Mt. Madja-as" placeholderTextColor="#7A8A99" />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Date</Text>
        <TextInput value={date} onChangeText={setDate} style={styles.input} placeholder="Sat, 12 Oct 2026" placeholderTextColor="#7A8A99" />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Meeting point</Text>
        <TextInput value={meetingPoint} onChangeText={setMeetingPoint} style={styles.input} placeholder="Trailhead signage area" placeholderTextColor="#7A8A99" />
      </View>

      <TouchableOpacity style={styles.primaryButton}>
        <Text style={styles.primaryButtonText}>Publish event</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0A121A',
  },
  container: {
    padding: 20,
    paddingTop: 36,
    gap: 16,
  },
  title: {
    color: '#FFF',
    fontSize: 30,
    fontWeight: '800',
    marginBottom: 6,
  },
  fieldGroup: {
    gap: 8,
  },
  label: {
    color: '#D0DCE7',
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#111C27',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#FFF',
  },
  primaryButton: {
    backgroundColor: '#C9A96E',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  primaryButtonText: {
    color: '#0E1520',
    fontWeight: '800',
  },
});
