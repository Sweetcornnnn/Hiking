// UserLocationModal.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, FlatList } from 'react-native';
import { supabase } from '../lib/supabase';
import AdminModal from './AdminModal';

interface UserLocationModalProps {
  visible: boolean;
  user: { id: string; name: string | null; email: string } | null;
  onClose: () => void;
}

export default function UserLocationModal({ visible, user, onClose }: UserLocationModalProps) {
  const [location, setLocation] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !user) return;
    setLoading(true);
    setError(null);

    const fetchUserLocations = async () => {
      const { data, error } = await supabase
        .from('hiker_locations')
        .select('*')
        .eq('user_id', user.id)
        .order('timestamp', { ascending: false })
        .limit(10);

      if (error) {
        setError(error.message);
      } else if (data && data.length > 0) {
        setLocation(data[0]);
        setHistory(data);
      }
      setLoading(false);
    };

    fetchUserLocations();
  }, [visible, user]);

  return (
    <AdminModal visible={visible} onClose={onClose}>
      <View style={styles.card}>
        <Text style={styles.title}>User Location</Text>
        <Text style={styles.subtitle}>{user?.name || user?.email}</Text>
        
        {loading ? (
          <ActivityIndicator color="#C9A96E" style={{ margin: 20 }} />
        ) : error ? (
          <Text style={styles.noData}>{error}</Text>
        ) : location ? (
          <View style={styles.locationBlock}>
            <Text style={styles.label}>Last Location:</Text>
            <Text style={styles.value}>{location.latitude}, {location.longitude}</Text>
            <Text style={styles.label}>Accuracy:</Text>
            <Text style={styles.value}>{location.accuracy?.toFixed(0) ?? '?'} m</Text>
            <Text style={styles.label}>Timestamp:</Text>
            <Text style={styles.value}>{new Date(location.timestamp).toLocaleString()}</Text>
          </View>
        ) : (
          <Text style={styles.noData}>No location data found for this user.</Text>
        )}
        
        {history.length > 0 && (
          <>
            <Text style={styles.historyTitle}>Recent History:</Text>
            <FlatList
              data={history}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.historyRow}>
                  <Text style={styles.historyText}>{item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}</Text>
                  <Text style={styles.historyTime}>{new Date(item.timestamp).toLocaleTimeString()}</Text>
                </View>
              )}
            />
          </>
        )}
        
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeText}>Close</Text>
        </TouchableOpacity>
      </View>
    </AdminModal>
  );
}

const styles = StyleSheet.create({
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