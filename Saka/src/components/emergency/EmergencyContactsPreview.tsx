import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  emergencyContactsService,
  type EmergencyContact,
} from '../../services/emergencyContactsService';

interface EmergencyContactsPreviewProps {
  visible: boolean;
  onManage: () => void;
}

export default function EmergencyContactsPreview({
  visible,
  onManage,
}: EmergencyContactsPreviewProps) {
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadContacts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setContacts(await emergencyContactsService.load());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load contacts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) void loadContacts();
  }, [visible, loadContacts]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>Your emergency contacts</Text>
          <Text style={styles.subtitle}>Your saved list in call priority order.</Text>
        </View>
        <TouchableOpacity
          onPress={onManage}
          style={styles.manageButton}
          accessibilityRole="button"
          accessibilityLabel="Add or edit emergency contacts"
        >
          <Ionicons name="create-outline" size={13} color="#101923" />
          <Text style={styles.manageButtonText}>Manage</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#C9A96E" />
          <Text style={styles.emptyText}>Loading contacts…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => void loadContacts()}>
            <Text style={styles.retry}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : contacts.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>You haven’t added emergency contacts yet.</Text>
          <TouchableOpacity onPress={onManage} style={styles.addButton}>
            <Text style={styles.addButtonText}>Add a contact</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {contacts.map((contact, index) => (
            <View key={contact.id} style={styles.contactRow}>
              <View style={styles.order}>
                <Text style={styles.orderText}>{index + 1}</Text>
              </View>
              <View style={styles.contactCopy}>
                <Text style={styles.name} numberOfLines={1}>{contact.name}</Text>
                <Text style={styles.detail} numberOfLines={1}>
                  {[contact.relationship, contact.phone].filter(Boolean).join(' · ')}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 0 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 6,
  },
  titleWrap: { flex: 1 },
  title: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  subtitle: { color: 'rgba(255,255,255,0.5)', fontSize: 9, marginTop: 3 },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 7,
    backgroundColor: '#C9A96E',
  },
  manageButtonText: { color: '#101923', fontSize: 10, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 7, padding: 12 },
  emptyText: { color: 'rgba(255,255,255,0.55)', fontSize: 10, textAlign: 'center' },
  errorText: { color: '#F0A0A0', fontSize: 10, textAlign: 'center' },
  retry: { color: '#E9C782', fontSize: 10, fontWeight: '700' },
  addButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(201,169,110,0.15)',
    borderRadius: 7,
  },
  addButtonText: { color: '#E9C782', fontSize: 10, fontWeight: '700' },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 10, paddingBottom: 8, gap: 6 },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    padding: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  order: {
    width: 21,
    height: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 7,
    backgroundColor: 'rgba(201,169,110,0.15)',
  },
  orderText: { color: '#E9C782', fontSize: 10, fontWeight: '700' },
  contactCopy: { flex: 1, minWidth: 0 },
  name: { color: '#FFFFFF', fontSize: 10, fontWeight: '600' },
  detail: { color: 'rgba(255,255,255,0.5)', fontSize: 9, marginTop: 2 },
});
