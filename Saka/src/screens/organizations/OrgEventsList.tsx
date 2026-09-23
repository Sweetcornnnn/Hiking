import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';

const sampleEvents = [
  { title: 'Sunrise Ridge Hike', status: 'Open', mountain: 'Mt. Madja-as', date: '12 Oct 2026', attendees: 12 },
  { title: 'Community Trail Walk', status: 'Full', mountain: 'Mt. Batulao', date: '20 Oct 2026', attendees: 15 },
  { title: 'Alpine Escape', status: 'Draft', mountain: 'Mt. Pulag', date: '25 Oct 2026', attendees: 8 },
];

export default function OrgEventsList() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Text style={styles.title}>Your events</Text>

      {sampleEvents.map((event, index) => (
        <TouchableOpacity key={`${event.title}-${index}`} style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.eventTitle}>{event.title}</Text>
            <Text style={[styles.badge, event.status === 'Draft' && styles.badgeDraft]}>{event.status}</Text>
          </View>
          <Text style={styles.meta}>{event.mountain}</Text>
          <Text style={styles.meta}>{event.date}</Text>
          <Text style={styles.meta}>{event.attendees} confirmed hikers</Text>
        </TouchableOpacity>
      ))}
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
    gap: 14,
  },
  title: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '800',
    marginTop: 24,
    marginBottom: 6,
  },
  card: {
    backgroundColor: '#111C27',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  eventTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    paddingRight: 10,
  },
  badge: {
    backgroundColor: '#1D8F6A',
    color: '#FFF',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 10,
    fontWeight: '700',
    overflow: 'hidden',
  },
  badgeDraft: {
    backgroundColor: '#7A6B43',
  },
  meta: {
    color: '#B7C7D6',
    fontSize: 13,
    marginTop: 4,
  },
});
