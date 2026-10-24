import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  emergencyContactsService,
  type EmergencyContact,
} from '../../services/emergencyContactsService';

interface EmergencyContactFeatureProps {
  visible: boolean;
}

function createContact(): EmergencyContact {
  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
    name: '',
    relationship: '',
    phone: '',
  };
}

export default function EmergencyContactFeature({
  visible,
}: EmergencyContactFeatureProps) {
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  const loadContacts = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const savedContacts = await emergencyContactsService.load();
      setContacts(savedContacts);
      setHasLoaded(true);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load emergency contacts.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible && !hasLoaded) {
      void loadContacts();
    }
  }, [visible, hasLoaded, loadContacts]);

  const updateContact = (
    id: string,
    field: 'name' | 'relationship' | 'phone',
    value: string,
  ) => {
    setContacts((current) =>
      current.map((contact) =>
        contact.id === id ? { ...contact, [field]: value } : contact,
      ),
    );
  };

  const moveContact = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= contacts.length) return;
    setContacts((current) => {
      const reordered = [...current];
      [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
      return reordered;
    });
  };

  const saveContacts = async () => {
    const normalizedContacts = contacts.map((contact) => ({
      ...contact,
      name: contact.name.trim(),
      relationship: contact.relationship.trim(),
      phone: contact.phone.trim(),
    }));
    const incompleteContact = normalizedContacts.find(
      (contact) => !contact.name || !contact.phone,
    );
    if (incompleteContact) {
      Alert.alert('Contact details required', 'Enter a name and phone number for each contact.');
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    try {
      await emergencyContactsService.save(normalizedContacts);
      setContacts(normalizedContacts);
      Alert.alert('Contacts saved', 'Your emergency contacts are saved to your account.');
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not save emergency contacts.');
    } finally {
      setIsSaving(false);
    }
  };

  const callContact = async (phone: string) => {
    try {
      await Linking.openURL(`tel:${phone.trim()}`);
    } catch {
      Alert.alert('Unable to call', 'This device could not open the phone dialer.');
    }
  };

  if (!visible) return null;

  return (
    <View style={styles.container}>
      <View style={styles.heading}>
        <View style={styles.headingCopy}>
          <Text style={styles.title}>Emergency contacts</Text>
          <Text style={styles.subtitle}>
            Admins can view these details to assist in emergencies. Contacts are not alerted automatically.
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setContacts((current) => [...current, createContact()])}
          disabled={isLoading || isSaving}
          accessibilityRole="button"
          accessibilityLabel="Add emergency contact"
        >
          <Ionicons name="add" size={16} color="#101923" />
          <Text style={styles.addButtonText}>Add</Text>
        </TouchableOpacity>
      </View>

      {loadError ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{loadError}</Text>
          <TouchableOpacity onPress={loadContacts} disabled={isLoading}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {saveError ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{saveError}</Text>
        </View>
      ) : null}

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color="#C9A96E" />
          <Text style={styles.helperText}>Loading your contacts…</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {contacts.length === 0 ? (
            <Text style={styles.emptyText}>
              No emergency contacts yet. Add someone you trust to reach in an emergency.
            </Text>
          ) : (
            contacts.map((contact, index) => (
              <View key={contact.id} style={styles.contactCard}>
                <View style={styles.contactTopRow}>
                  <View style={styles.orderBadge}>
                    <Text style={styles.orderText}>{index + 1}</Text>
                  </View>
                  <Text style={styles.orderHint}>Contact order</Text>
                  <View style={styles.orderControls}>
                    <TouchableOpacity
                      onPress={() => moveContact(index, -1)}
                      disabled={index === 0 || isSaving}
                      style={styles.iconButton}
                      accessibilityRole="button"
                      accessibilityLabel={`Move contact ${index + 1} up`}
                    >
                      <Ionicons
                        name="chevron-up"
                        size={15}
                        color={index === 0 ? '#59616B' : '#D9E0E7'}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => moveContact(index, 1)}
                      disabled={index === contacts.length - 1 || isSaving}
                      style={styles.iconButton}
                      accessibilityRole="button"
                      accessibilityLabel={`Move contact ${index + 1} down`}
                    >
                      <Ionicons
                        name="chevron-down"
                        size={15}
                        color={index === contacts.length - 1 ? '#59616B' : '#D9E0E7'}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() =>
                        setContacts((current) => current.filter((item) => item.id !== contact.id))
                      }
                      disabled={isSaving}
                      style={styles.iconButton}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove contact ${index + 1}`}
                    >
                      <Ionicons name="trash-outline" size={14} color="#E07070" />
                    </TouchableOpacity>
                  </View>
                </View>

                <TextInput
                  value={contact.name}
                  onChangeText={(value) => updateContact(contact.id, 'name', value)}
                  placeholder="Name"
                  placeholderTextColor="#7E8995"
                  style={styles.input}
                  editable={!isSaving}
                  accessibilityLabel={`Contact ${index + 1} name`}
                />
                <TextInput
                  value={contact.relationship}
                  onChangeText={(value) => updateContact(contact.id, 'relationship', value)}
                  placeholder="Relationship or role (optional)"
                  placeholderTextColor="#7E8995"
                  style={styles.input}
                  editable={!isSaving}
                  accessibilityLabel={`Contact ${index + 1} relationship or role`}
                />
                <View style={styles.phoneRow}>
                  <TextInput
                    value={contact.phone}
                    onChangeText={(value) => updateContact(contact.id, 'phone', value)}
                    placeholder="Phone number"
                    placeholderTextColor="#7E8995"
                    style={[styles.input, styles.phoneInput]}
                    keyboardType="phone-pad"
                    editable={!isSaving}
                    accessibilityLabel={`Contact ${index + 1} phone number`}
                  />
                  <TouchableOpacity
                    onPress={() => void callContact(contact.phone)}
                    disabled={!contact.phone.trim()}
                    style={[styles.callButton, !contact.phone.trim() && styles.disabledButton]}
                    accessibilityRole="button"
                    accessibilityLabel={`Call ${contact.name || `contact ${index + 1}`}`}
                  >
                    <Ionicons name="call-outline" size={13} color="#101923" />
                    <Text style={styles.callButtonText}>Call</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      <View style={styles.footer}>
        <Text style={styles.footerHint}>Contact order is used as your personal call priority.</Text>
        <TouchableOpacity
          onPress={saveContacts}
          disabled={isLoading || isSaving || !hasLoaded}
          style={[styles.saveButton, (isLoading || isSaving || !hasLoaded) && styles.disabledButton]}
        >
          {isSaving ? <ActivityIndicator size="small" color="#101923" /> : null}
          <Text style={styles.saveButtonText}>{isSaving ? 'Saving…' : 'Save contacts'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 0 },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 5,
  },
  headingCopy: { flex: 1 },
  title: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  subtitle: { color: 'rgba(255,255,255,0.55)', fontSize: 10, lineHeight: 14, marginTop: 3 },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#C9A96E',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  addButtonText: { color: '#101923', fontSize: 11, fontWeight: '700' },
  errorBox: {
    marginHorizontal: 10,
    marginBottom: 5,
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(224,112,112,0.12)',
    gap: 5,
  },
  errorText: { color: '#F0A0A0', fontSize: 10 },
  retryText: { color: '#E9C782', fontSize: 10, fontWeight: '700' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  helperText: { color: 'rgba(255,255,255,0.55)', fontSize: 11 },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 10, paddingVertical: 5, gap: 8 },
  emptyText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    lineHeight: 16,
    paddingVertical: 16,
    textAlign: 'center',
  },
  contactCard: {
    gap: 6,
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.035)',
  },
  contactTopRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  orderBadge: {
    width: 22,
    height: 22,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(201,169,110,0.15)',
  },
  orderText: { color: '#E9C782', fontSize: 11, fontWeight: '700' },
  orderHint: { flex: 1, color: 'rgba(255,255,255,0.55)', fontSize: 10 },
  orderControls: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  iconButton: { padding: 4 },
  input: {
    minHeight: 34,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(0,0,0,0.12)',
    color: '#FFFFFF',
    fontSize: 11,
  },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  phoneInput: { flex: 1 },
  callButton: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 10,
    borderRadius: 7,
    backgroundColor: '#C9A96E',
  },
  callButtonText: { color: '#101923', fontSize: 10, fontWeight: '700' },
  footer: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    gap: 6,
  },
  footerHint: { color: 'rgba(255,255,255,0.45)', fontSize: 9 },
  saveButton: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#C9A96E',
  },
  saveButtonText: { color: '#101923', fontSize: 11, fontWeight: '700' },
  disabledButton: { opacity: 0.45 },
});
