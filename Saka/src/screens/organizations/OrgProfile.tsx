import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useAuthStore } from '../../store/authStore';

export default function OrgProfile() {
  const { profile } = useAuthStore();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Text style={styles.title}>Organization profile</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Name</Text>
        <Text style={styles.value}>{profile?.full_name || 'Trail Partners Co.'}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{profile?.email || 'hello@trailpartners.com'}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Verification</Text>
        <Text style={styles.value}>{profile?.is_verified ? 'Verified organizer' : 'Pending verification'}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Managed mountains</Text>
        <Text style={styles.value}>Mt. Madja-as, Mt. Batulao, Mt. Pulag</Text>
      </View>
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
  },
  card: {
    backgroundColor: '#111C27',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  label: {
    color: '#C9A96E',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  value: {
    color: '#F3F6FA',
    fontSize: 16,
    fontWeight: '600',
  },
});
