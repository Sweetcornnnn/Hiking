import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type EmergencyContactRole = 'ngo' | 'admin' | 'tourGuide' | 'family';

export interface EmergencyContact {
  name: string;
  phone: string;
}

export interface EmergencyPlan {
  travelDate: string;
  departureTime: string;
  expectedArrivalTime: string;
  contacts: Record<EmergencyContactRole, EmergencyContact>;
}

interface EmergencyContactFeatureProps {
  visible: boolean;
  onClose: () => void;
  onSave: (plan: EmergencyPlan) => void | Promise<void>;
  initialValue?: Partial<EmergencyPlan>;
  embedded?: boolean;
}

const contactRoles: { key: EmergencyContactRole; label: string }[] = [
  { key: 'ngo', label: 'NGO' },
  { key: 'admin', label: 'Admin' },
  { key: 'tourGuide', label: 'Tour guide' },
  { key: 'family', label: 'Family (last)' },
];

export const createEmptyPlan = (): EmergencyPlan => ({
  travelDate: '',
  departureTime: '',
  expectedArrivalTime: '',
  contacts: {
    ngo: { name: '', phone: '' },
    admin: { name: '', phone: '' },
    tourGuide: { name: '', phone: '' },
    family: { name: '', phone: '' },
  },
});

const mergePlan = (initialValue?: Partial<EmergencyPlan>): EmergencyPlan => {
  const emptyPlan = createEmptyPlan();

  return {
    ...emptyPlan,
    ...initialValue,
    contacts: {
      ...emptyPlan.contacts,
      ...initialValue?.contacts,
    },
  };
};

export default function EmergencyContactFeature({
  visible,
  onClose,
  onSave,
  initialValue,
  embedded = false,
}: EmergencyContactFeatureProps) {
  const [plan, setPlan] = useState<EmergencyPlan>(() => mergePlan(initialValue));
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (visible && !embedded) {
      setPlan(mergePlan(initialValue));
    }
  }, [visible, initialValue, embedded]);

  const updatePlanField = (
    field: 'travelDate' | 'departureTime' | 'expectedArrivalTime',
    value: string
  ) => {
    setPlan((current) => ({ ...current, [field]: value }));
  };

  const updateContact = (
    role: EmergencyContactRole,
    field: keyof EmergencyContact,
    value: string
  ) => {
    setPlan((current) => ({
      ...current,
      contacts: {
        ...current.contacts,
        [role]: { ...current.contacts[role], [field]: value },
      },
    }));
  };

  const handleSave = async () => {
    if (!plan.travelDate.trim() || !plan.departureTime.trim() || !plan.expectedArrivalTime.trim()) {
      Alert.alert('Trip details required', 'Enter the travel date, departure time, and expected arrival time.');
      return;
    }

    setIsSaving(true);
    try {
      await onSave(plan);
      if (!embedded) onClose();
    } catch (error) {
      Alert.alert(
        'Could not save emergency plan',
        error instanceof Error ? error.message : 'Please try again.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const formFields = (
    <ScrollView
      style={embedded ? styles.embeddedScroll : styles.scroll}
      contentContainerStyle={embedded ? styles.embeddedScrollContent : styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.sectionTitle}>Trip schedule</Text>
      <View style={styles.tripFields}>
        <View style={styles.tripField}>
          <Text style={styles.label}>Travel date</Text>
          <TextInput
            value={plan.travelDate}
            onChangeText={(value) => updatePlanField('travelDate', value)}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={styles.placeholder.color}
            style={styles.input}
            accessibilityLabel="Travel date, year-month-day"
          />
        </View>
        <View style={styles.tripField}>
          <Text style={styles.label}>Departure</Text>
          <TextInput
            value={plan.departureTime}
            onChangeText={(value) => updatePlanField('departureTime', value)}
            placeholder="HH:MM"
            placeholderTextColor={styles.placeholder.color}
            style={styles.input}
            keyboardType="numbers-and-punctuation"
            accessibilityLabel="Departure time, 24-hour format"
          />
        </View>
        <View style={styles.tripField}>
          <Text style={styles.label}>Expected arrival</Text>
          <TextInput
            value={plan.expectedArrivalTime}
            onChangeText={(value) => updatePlanField('expectedArrivalTime', value)}
            placeholder="HH:MM"
            placeholderTextColor={styles.placeholder.color}
            style={styles.input}
            keyboardType="numbers-and-punctuation"
            accessibilityLabel="Expected arrival time, 24-hour format"
          />
        </View>
      </View>

      <View style={styles.contactHeading}>
        <Text style={styles.sectionTitle}>Emergency contacts</Text>
        <Text style={styles.orderHint}>Call in this order</Text>
      </View>

      {contactRoles.map(({ key, label }, index) => (
        <View key={key} style={styles.contactRow}>
          <View style={styles.orderNumber}>
            <Text style={styles.orderNumberText}>{index + 1}</Text>
          </View>
          <View style={styles.contactFields}>
            <Text style={styles.contactLabel}>{label}</Text>
            <View style={styles.contactInputs}>
              <TextInput
                value={plan.contacts[key].name}
                onChangeText={(value) => updateContact(key, 'name', value)}
                placeholder="Name or organization"
                placeholderTextColor={styles.placeholder.color}
                style={[styles.input, styles.contactNameInput]}
                accessibilityLabel={`${label} contact name`}
              />
              <TextInput
                value={plan.contacts[key].phone}
                onChangeText={(value) => updateContact(key, 'phone', value)}
                placeholder="Phone number"
                placeholderTextColor={styles.placeholder.color}
                style={[styles.input, styles.contactPhoneInput]}
                keyboardType="phone-pad"
                accessibilityLabel={`${label} phone number`}
              />
            </View>
          </View>
        </View>
      ))}
    </ScrollView>
  );

  const saveButton = (
    <TouchableOpacity
      onPress={handleSave}
      disabled={isSaving}
      style={[styles.button, styles.saveButton, isSaving && styles.disabledButton]}
    >
      {isSaving ? <ActivityIndicator size="small" color="#101923" /> : null}
      <Text style={styles.saveText}>{isSaving ? 'Saving' : 'Save plan'}</Text>
    </TouchableOpacity>
  );

  if (embedded) {
    if (!visible) return null;

    return (
      <View style={styles.embeddedContainer}>
        {formFields}
        <View style={styles.embeddedFooter}>{saveButton}</View>
      </View>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Ionicons name="warning-outline" size={18} color="#E07070" />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.title}>Hike safety plan</Text>
              <Text style={styles.subtitle}>Trip details and emergency call order</Text>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Close emergency plan"
              onPress={onClose}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={19} color="rgba(255,255,255,0.65)" />
            </TouchableOpacity>
          </View>

          {formFields}

          <View style={styles.footer}>
            <TouchableOpacity
              onPress={onClose}
              disabled={isSaving}
              style={[styles.button, styles.cancelButton]}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            {saveButton}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  embeddedContainer: {
    flex: 1,
    minHeight: 0,
  },
  embeddedScroll: {
    flex: 1,
  },
  embeddedScrollContent: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 7,
  },
  embeddedFooter: {
    alignItems: 'flex-end',
    paddingHorizontal: 10,
    paddingTop: 5,
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
    backgroundColor: 'rgba(5,10,16,0.78)',
  },
  modal: {
    width: '100%',
    maxWidth: 620,
    maxHeight: '92%',
    backgroundColor: '#0E1520',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(224,112,112,0.12)',
    marginRight: 10,
  },
  headerText: {
    flex: 1,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.48)',
    fontSize: 11,
    marginTop: 2,
  },
  closeButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flexShrink: 1,
  },
  scrollContent: {
    padding: 18,
    gap: 12,
  },
  sectionTitle: {
    color: '#C9A96E',
    fontSize: 12,
    fontWeight: '700',
  },
  tripFields: {
    flexDirection: 'row',
    gap: 9,
  },
  tripField: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 10,
    marginBottom: 5,
  },
  input: {
    minWidth: 0,
    height: 38,
    paddingHorizontal: 10,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    color: '#FFFFFF',
    fontSize: 12,
  },
  placeholder: {
    color: 'rgba(255,255,255,0.3)',
  },
  contactHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 5,
  },
  orderHint: {
    color: 'rgba(255,255,255,0.38)',
    fontSize: 10,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  orderNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(201,169,110,0.12)',
  },
  orderNumberText: {
    color: '#C9A96E',
    fontSize: 11,
    fontWeight: '700',
  },
  contactFields: {
    flex: 1,
    minWidth: 0,
  },
  contactLabel: {
    color: 'rgba(255,255,255,0.64)',
    fontSize: 10,
    marginBottom: 4,
  },
  contactInputs: {
    flexDirection: 'row',
    gap: 8,
  },
  contactNameInput: {
    flex: 1.2,
  },
  contactPhoneInput: {
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 9,
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  button: {
    minWidth: 100,
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  cancelText: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#C9A96E',
  },
  disabledButton: {
    opacity: 0.65,
  },
  saveText: {
    color: '#101923',
    fontSize: 12,
    fontWeight: '700',
  },
});