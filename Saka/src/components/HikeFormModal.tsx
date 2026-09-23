import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Modal, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useHikesStore } from '../store/hikesStore';
import { Hike } from '../types';
import Toast, { ToastHandle } from './Toast';

interface HikeFormData {
  date: string;
  start_time: string;
  end_time: string;
  tagalongs: string;
  contact_number: string;
  emergency_contact: string;
}

const buildInitialForm = (date: string): HikeFormData => ({
  date,
  start_time: '08:00',
  end_time: '16:00',
  tagalongs: '1',
  contact_number: '',
  emergency_contact: '',
});

interface HikeFormModalProps {
  visible: boolean;
  onClose: () => void;
  editingHike: Hike | null;
  defaultDate: string;
  mountainId?: string | null;
  onSaved?: (mode: 'created' | 'updated') => void;
}

// Centered, landscape-oriented add/edit modal. No dimmed backdrop, no X
// button — Cancel already covers "close without saving". Shared by
// Calendar (adding a hike) and Hikes (editing one) so both stay in sync.
export default function HikeFormModal({
  visible,
  onClose,
  editingHike,
  defaultDate,
  mountainId,
  onSaved,
}: HikeFormModalProps) {
  const { createHike, updateHike, isLoading } = useHikesStore();
  const [formData, setFormData] = useState<HikeFormData>(buildInitialForm(defaultDate));
  const toastRef = useRef<ToastHandle>(null);

  // Reset the form fresh every time the modal opens, whether that's a new
  // hike or an existing one being edited.
  useEffect(() => {
    if (!visible) {
      return;
    }
    if (editingHike) {
      setFormData({
        date: editingHike.date,
        start_time: editingHike.start_time,
        end_time: editingHike.end_time,
        tagalongs: editingHike.tagalongs.toString(),
        contact_number: editingHike.contact_number,
        emergency_contact: editingHike.emergency_contact,
      });
    } else {
      setFormData(buildInitialForm(defaultDate));
    }
  }, [visible, editingHike, defaultDate]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handleSave = async () => {
    if (!formData.contact_number || !formData.emergency_contact) {
      toastRef.current?.show({
        type: 'error',
        title: 'Missing info',
        message: 'Contact and emergency contact are required.',
      });
      return;
    }

    const hikeData = {
      date: formData.date,
      start_time: formData.start_time,
      end_time: formData.end_time,
      tagalongs: parseInt(formData.tagalongs) || 1,
      contact_number: formData.contact_number,
      emergency_contact: formData.emergency_contact,
      mountain_id: editingHike?.mountain_id || mountainId,
    };

    if (editingHike) {
      const { error } = await updateHike(editingHike.id, hikeData);
      if (error) {
        toastRef.current?.show({ type: 'error', title: 'Could not update hike', message: error });
      } else {
        onClose();
        onSaved?.('updated');
      }
    } else {
      const { error } = await createHike(hikeData);
      if (error) {
        toastRef.current?.show({ type: 'error', title: 'Could not schedule hike', message: error });
      } else {
        onClose();
        onSaved?.('created');
      }
    }
  };

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editingHike ? 'Edit Hike' : 'New Hike'}</Text>
            <Text style={styles.modalSubtitle} numberOfLines={1}>{formatDate(formData.date)}</Text>
          </View>

          <View style={styles.modalBody}>
            {/* Left column — time + group size */}
            <View style={styles.column}>
              <Text style={styles.fieldGroupLabel}>Time</Text>
              <View style={styles.timeRow}>
                <View style={styles.timeField}>
                  <Text style={styles.fieldLabel}>Start</Text>
                  <View style={styles.inputWrap}>
                    <Ionicons name="time-outline" size={13} color="rgba(201,169,110,0.5)" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      value={formData.start_time}
                      onChangeText={(text) => setFormData({ ...formData, start_time: text })}
                      placeholder="08:00"
                      placeholderTextColor="rgba(255,255,255,0.18)"
                    />
                  </View>
                </View>
                <View style={styles.timeSep}>
                  <Text style={styles.timeSepText}>–</Text>
                </View>
                <View style={styles.timeField}>
                  <Text style={styles.fieldLabel}>End</Text>
                  <View style={styles.inputWrap}>
                    <Ionicons name="time-outline" size={13} color="rgba(201,169,110,0.5)" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      value={formData.end_time}
                      onChangeText={(text) => setFormData({ ...formData, end_time: text })}
                      placeholder="16:00"
                      placeholderTextColor="rgba(255,255,255,0.18)"
                    />
                  </View>
                </View>
              </View>

              <Text style={styles.fieldGroupLabel}>Group</Text>
              <View style={[styles.inputWrap, styles.inputWrapLast]}>
                <Ionicons name="people-outline" size={13} color="rgba(201,169,110,0.5)" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={formData.tagalongs}
                  onChangeText={(text) => setFormData({ ...formData, tagalongs: text })}
                  keyboardType="number-pad"
                  placeholder="Number of tagalongs"
                  placeholderTextColor="rgba(255,255,255,0.18)"
                />
              </View>
            </View>

            {/* Right column — contact info */}
            <View style={styles.column}>
              <Text style={styles.fieldGroupLabel}>Contact *</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="call-outline" size={13} color="rgba(110,175,138,0.6)" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={formData.contact_number}
                  onChangeText={(text) => setFormData({ ...formData, contact_number: text })}
                  keyboardType="phone-pad"
                  placeholder="Your contact number"
                  placeholderTextColor="rgba(255,255,255,0.18)"
                />
              </View>

              <Text style={styles.fieldGroupLabel}>Emergency *</Text>
              <View style={[styles.inputWrap, styles.inputWrapLast]}>
                <Ionicons name="warning-outline" size={13} color="rgba(224,112,112,0.6)" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={formData.emergency_contact}
                  onChangeText={(text) => setFormData({ ...formData, emergency_contact: text })}
                  placeholder="Name & number"
                  placeholderTextColor="rgba(255,255,255,0.18)"
                />
              </View>
            </View>
          </View>

          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.modalCancelBtn} onPress={onClose}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSave}
              disabled={isLoading}
              style={[styles.saveBtn, isLoading && styles.saveBtnDisabled]}
            >
              <Ionicons name={editingHike ? 'save-outline' : 'add-circle-outline'} size={14} color={isLoading ? 'rgba(255,255,255,0.4)' : '#0E1520'} />
              <Text style={[styles.saveBtnText, isLoading && styles.saveBtnTextDisabled]}>
                {isLoading ? 'Saving…' : editingHike ? 'Update Hike' : 'Schedule Hike'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        <Toast ref={toastRef} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    backgroundColor: 'rgba(10,17,26,0.15)',
  },
  modalCard: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: '#0E1520',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  modalHeader: {
    marginBottom: 10,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  modalSubtitle: {
    color: 'rgba(201,169,110,0.7)',
    fontSize: 10,
    marginTop: 1,
  },
  // Landscape body: two side-by-side columns instead of one long stack.
  modalBody: {
    flexDirection: 'row',
    gap: 16,
  },
  column: {
    flex: 1,
  },
  fieldGroupLabel: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 3,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  timeField: {
    flex: 1,
  },
  fieldLabel: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 9,
    marginBottom: 2,
  },
  timeSep: {
    paddingTop: 12,
  },
  timeSepText: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 12,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  inputWrapLast: {
    marginBottom: 0,
  },
  inputIcon: {
    marginRight: 6,
  },
  input: {
    flex: 1,
    paddingVertical: 7,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 12,
  },
  modalCancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  modalCancelText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    borderRadius: 9,
    backgroundColor: '#C9A96E',
  },
  saveBtnDisabled: {
    backgroundColor: 'rgba(201,169,110,0.3)',
  },
  saveBtnText: {
    color: '#0E1520',
    fontWeight: '700',
    fontSize: 12,
  },
  saveBtnTextDisabled: {
    color: 'rgba(14,21,32,0.5)',
  },
});