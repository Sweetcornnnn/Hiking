// UserLocationModal.tsx
import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, FlatList } from 'react-native';
import locationService from '../services/locationService';

interface UserLocationModalProps {
  visible: boolean;
  user: { id: number; name: string | null; email: string } | null;
  onClose: () => void;
}

export default function UserLocationModal({ visible, user, onClose }: UserLocationModalProps) {
  const [location, setLocation] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible || !user) return;
    setLoading(true);
    // Simulate fetching location for the selected user
    // In a real app, fetch from server by user id
    locationService.getLastLocation().then(loc => {
      setLocation(loc);
      setLoading(false);
    });
    locationService.getLocationHistory().then(hist => setHistory(hist));
  }, [visible, user]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>User Location</Text>
          <Text style={styles.subtitle}>{user?.name || user?.email}</Text>
          {loading ? (
            <ActivityIndicator color="#C9A96E" />
          ) : location ? (
            <View style={styles.locationBlock}>
              <Text style={styles.label}>Last Location:</Text>
              <Text style={styles.value}>{location.latitude}, {location.longitude}</Text>
              <Text style={styles.label}>Accuracy:</Text>
              <Text style={styles.value}>{location.accuracy} m</Text>
              <Text style={styles.label}>Timestamp:</Text>
              <Text style={styles.value}>{location.timestamp}</Text>
            </View>
          ) : (
            <Text style={styles.noData}>No location data found.</Text>
          )}
          <Text style={styles.historyTitle}>Location History (last 5):</Text>
          <FlatList
            data={history.slice(-5).reverse()}
            keyExtractor={(_, i) => i.toString()}
            renderItem={({ item }) => (
              <View style={styles.historyRow}>
                <Text style={styles.historyText}>{item.latitude}, {item.longitude} ({item.accuracy}m)</Text>
                <Text style={styles.historyTime}>{item.timestamp}</Text>
              </View>
            )}
            ListEmptyComponent={<Text style={styles.noData}>No history.</Text>}
          />
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#111927',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 12,
  },
  locationBlock: {
    marginBottom: 10,
    alignItems: 'center',
  },
  label: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
  },
  value: {
    color: '#C9A96E',
    fontSize: 13,
    marginBottom: 2,
  },
  noData: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 12,
    marginBottom: 8,
  },
  historyTitle: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 10,
    marginBottom: 4,
    alignSelf: 'flex-start',
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 2,
  },
  historyText: {
    color: '#C9A96E',
    fontSize: 11,
  },
  historyTime: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 10,
  },
  closeBtn: {
    marginTop: 16,
    backgroundColor: '#C9A96E',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 24,
  },
  closeText: {
    color: '#111927',
    fontWeight: '700',
    fontSize: 13,
  },
});