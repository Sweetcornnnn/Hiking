import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Modal,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useHikesStore } from '../store/hikesStore';
import { Hike } from '../types';
import Toast, { ToastHandle } from './Toast';
import { isISODate } from '../utils/dateRange';
import type { SavedHikeLike } from './HikePermitModal';
import {
  DatePickerModal,
  TimePickerModal,
  formatDisplayDate,
  formatDisplayTime,
} from './PickerModals';

const GOLD = '#C9A96E';
const NAVY = '#0E1520';
const ICON_GOLD = 'rgba(201,169,110,0.55)';
const PLACEHOLDER = 'rgba(255,255,255,0.22)';

const formatLong = (dateString: string) =>
  new Date(dateString + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

interface HikeFormData {
  date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  tagalongs: string;
  contact_number: string;
  emergency_contact: string;
}

const buildInitialForm = (date: string): HikeFormData => ({
  date,
  end_date: '',
  start_time: '08:00',
  end_time: '16:00',
  tagalongs: '1',
  contact_number: '',
  emergency_contact: '',
});

type OverlayKind = 'none' | 'info' | 'endDate' | 'startTime' | 'endTime';

interface HikeFormModalProps {
  visible: boolean;
  onClose: () => void;
  editingHike: Hike | null;
  defaultDate: string;
  mountainId?: string | null;
  onSaved?: (mode: 'created' | 'updated', hike: SavedHikeLike) => void;
}

// Centered, landscape-oriented add/edit modal. No heavy backdrop, no X
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
  const { width, height } = useWindowDimensions();
  const cardWidth = Math.min(480, width - 40);
  const stacked = cardWidth < 400; // narrow screens: one column instead of two

  const [formData, setFormData] = useState<HikeFormData>(buildInitialForm(defaultDate));
  const [overlay, setOverlay] = useState<OverlayKind>('none');
  const toastRef = useRef<ToastHandle>(null);

  // Reset the form fresh every time the modal opens, whether that's a new
  // hike or an existing one being edited.
  useEffect(() => {
    if (!visible) {
      return;
    }
    setOverlay('none');
    if (editingHike) {
      setFormData({
        date: editingHike.date,
        end_date:
          editingHike.end_date && editingHike.end_date !== editingHike.date
            ? editingHike.end_date
            : '',
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

  const openOverlay = (kind: OverlayKind) => {
    Keyboard.dismiss();
    setOverlay(kind);
  };
  const closeOverlay = () => setOverlay('none');

  const handleSave = async () => {
    if (formData.end_date) {
      if (!isISODate(formData.end_date)) {
        toastRef.current?.show({
          type: 'error',
          title: 'Invalid end date',
          message: 'Pick an end date, or leave it blank for a single-day hike.',
        });
        return;
      }
      if (formData.end_date < formData.date) {
        toastRef.current?.show({
          type: 'error',
          title: 'Invalid date range',
          message: 'End date cannot be before the start date.',
        });
        return;
      }
    }

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
      end_date: formData.end_date || null,
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
        onSaved?.('updated', hikeData);
      }
    } else {
      const { error } = await createHike(hikeData);
      if (error) {
        toastRef.current?.show({ type: 'error', title: 'Could not schedule hike', message: error });
      } else {
        onClose();
        onSaved?.('created', hikeData);
      }
    }
  };

  const hasRange = !!formData.end_date && formData.end_date !== formData.date;
  const rowStyle = [styles.row, stacked && styles.rowStacked];

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.modalCard, { maxHeight: height - 24 }]}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.headerBadge}>
              <Ionicons name="calendar-outline" size={14} color={GOLD} />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.modalTitle}>{editingHike ? 'Edit Hike' : 'New Hike'}</Text>
              <Text style={styles.modalSubtitle} numberOfLines={1}>
                {hasRange
                  ? `${formatDisplayDate(formData.date)}  →  ${formatDisplayDate(formData.end_date)}`
                  : formatLong(formData.date)}
              </Text>
            </View>
          </View>

          {/* Body */}
          <ScrollView
            style={styles.bodyScroll}
            contentContainerStyle={styles.modalBody}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Row 1: Time | End date */}
            <View style={rowStyle}>
              <View style={styles.cell}>
                <View style={styles.labelRow}>
                  <Text style={styles.fieldGroupLabel}>Time</Text>
                  <TouchableOpacity
                    onPress={() => openOverlay('info')}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    accessibilityRole="button"
                    accessibilityLabel="Important: get home on time"
                    style={styles.infoBtn}
                  >
                    <Ionicons name="information-circle" size={14} color={GOLD} />
                  </TouchableOpacity>
                </View>
                <View style={styles.timeRow}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={[styles.inputWrap, styles.timeInput]}
                    onPress={() => openOverlay('startTime')}
                  >
                    <Text style={styles.inputPrefix}>From</Text>
                    <Text style={styles.timeValue} numberOfLines={1}>
                      {formatDisplayTime(formData.start_time) || 'Set'}
                    </Text>
                  </TouchableOpacity>
                  <Ionicons name="arrow-forward" size={12} color="rgba(255,255,255,0.25)" />
                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={[styles.inputWrap, styles.timeInput]}
                    onPress={() => openOverlay('endTime')}
                  >
                    <Text style={styles.inputPrefix}>To</Text>
                    <Text style={styles.timeValue} numberOfLines={1}>
                      {formatDisplayTime(formData.end_time) || 'Set'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.cell}>
                <Text style={styles.fieldGroupLabel}>End date (optional)</Text>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={styles.inputWrap}
                  onPress={() => openOverlay('endDate')}
                >
                  <Ionicons name="calendar-outline" size={14} color={ICON_GOLD} style={styles.inputIcon} />
                  <Text
                    style={[styles.input, styles.dateText, !formData.end_date && styles.dateTextEmpty]}
                    numberOfLines={1}
                  >
                    {formData.end_date ? formatDisplayDate(formData.end_date) : 'Same day · tap to pick'}
                  </Text>
                  {formData.end_date ? (
                    <TouchableOpacity
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      onPress={() => setFormData({ ...formData, end_date: '' })}
                    >
                      <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.35)" />
                    </TouchableOpacity>
                  ) : (
                    <Ionicons name="chevron-down" size={14} color="rgba(255,255,255,0.3)" />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Row 2: Group | Contact */}
            <View style={rowStyle}>
              <View style={styles.cell}>
                <Text style={styles.fieldGroupLabel}>Group</Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="people-outline" size={14} color={ICON_GOLD} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={formData.tagalongs}
                    onChangeText={(text) => setFormData({ ...formData, tagalongs: text })}
                    keyboardType="number-pad"
                    placeholder="Number of tagalongs"
                    placeholderTextColor={PLACEHOLDER}
                  />
                </View>
              </View>

              <View style={styles.cell}>
                <Text style={styles.fieldGroupLabel}>Contact *</Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="call-outline" size={14} color="rgba(110,175,138,0.7)" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={formData.contact_number}
                    onChangeText={(text) => setFormData({ ...formData, contact_number: text })}
                    keyboardType="phone-pad"
                    placeholder="Your contact number"
                    placeholderTextColor={PLACEHOLDER}
                  />
                </View>
              </View>
            </View>

            {/* Row 3: Emergency (full width) */}
            <View style={[styles.cell, styles.cellLast]}>
              <Text style={styles.fieldGroupLabel}>Emergency contact *</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="warning-outline" size={14} color="rgba(224,112,112,0.75)" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={formData.emergency_contact}
                  onChangeText={(text) => setFormData({ ...formData, emergency_contact: text })}
                  placeholder="Name & number"
                  placeholderTextColor={PLACEHOLDER}
                />
              </View>
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.modalCancelBtn} onPress={onClose}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSave}
              disabled={isLoading}
              style={[styles.saveBtn, isLoading && styles.saveBtnDisabled]}
            >
              <Ionicons
                name={editingHike ? 'save-outline' : 'add-circle-outline'}
                size={15}
                color={isLoading ? 'rgba(255,255,255,0.4)' : NAVY}
              />
              <Text style={[styles.saveBtnText, isLoading && styles.saveBtnTextDisabled]}>
                {isLoading ? 'Saving…' : editingHike ? 'Update Hike' : 'Schedule Hike'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Info warning popup (own Modal so it always sits in front) */}
        <Modal
          transparent
          animationType="fade"
          visible={overlay === 'info'}
          onRequestClose={closeOverlay}
          statusBarTranslucent
        >
          <View style={styles.popupLayer}>
            <Pressable style={StyleSheet.absoluteFill} onPress={closeOverlay} />
            <View style={styles.popupCard}>
              <View style={styles.warnBadge}>
                <Ionicons name="alert-circle" size={26} color={GOLD} />
              </View>
              <Text style={styles.popupTitle}>Get home on time</Text>
              <Text style={styles.popupBody}>
                Please make sure you get home by your end time
                {formData.end_time ? ` (${formatDisplayTime(formData.end_time)})` : ''}. If you
                don't, an emergency “Did you get home?” alert will appear.
              </Text>
              <TouchableOpacity style={styles.popupBtn} onPress={closeOverlay}>
                <Text style={styles.popupBtnText}>Got it</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Shared styled pickers */}
        <DatePickerModal
          visible={overlay === 'endDate'}
          title="Select end date"
          value={formData.end_date}
          minDate={formData.date}
          rangeStart={formData.date}
          clearLabel="Same day"
          onSelect={(iso) => setFormData((prev) => ({ ...prev, end_date: iso }))}
          onClear={() => setFormData((prev) => ({ ...prev, end_date: '' }))}
          onClose={closeOverlay}
        />
        <TimePickerModal
          visible={overlay === 'startTime'}
          title="Start time"
          value={formData.start_time}
          onSelect={(v) => setFormData((prev) => ({ ...prev, start_time: v }))}
          onClose={closeOverlay}
        />
        <TimePickerModal
          visible={overlay === 'endTime'}
          title="End time"
          value={formData.end_time}
          onSelect={(v) => setFormData((prev) => ({ ...prev, end_time: v }))}
          onClose={closeOverlay}
        />

        <Toast ref={toastRef} />
      </KeyboardAvoidingView>
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
    maxWidth: 480,
    backgroundColor: NAVY,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },

  /* Header */
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 10,
    marginBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(201,169,110,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(201,169,110,0.25)',
  },
  headerText: {
    flex: 1,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  modalSubtitle: {
    color: 'rgba(201,169,110,0.8)',
    fontSize: 10,
    marginTop: 1,
  },

  /* Body / grid */
  bodyScroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  modalBody: {
    paddingBottom: 2,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  rowStacked: {
    flexDirection: 'column',
    gap: 10,
  },
  cell: {
    flex: 1,
  },
  cellLast: {
    flex: 0,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  fieldGroupLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: 4,
  },
  infoBtn: {
    marginBottom: 4,
    marginTop: -1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeInput: {
    flex: 1,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 34,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    paddingHorizontal: 9,
  },
  inputIcon: {
    marginRight: 6,
  },
  inputPrefix: {
    color: 'rgba(201,169,110,0.7)',
    fontSize: 9,
    fontWeight: '600',
    marginRight: 5,
  },
  input: {
    flex: 1,
    paddingVertical: 6,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  timeValue: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  dateText: {
    paddingVertical: 0,
  },
  dateTextEmpty: {
    color: PLACEHOLDER,
    fontWeight: '400',
  },

  /* Footer */
  modalFooter: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 10,
    marginTop: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  modalCancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
  },
  modalCancelText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 9,
    backgroundColor: GOLD,
  },
  saveBtnDisabled: {
    backgroundColor: 'rgba(201,169,110,0.3)',
  },
  saveBtnText: {
    color: NAVY,
    fontWeight: '700',
    fontSize: 12,
  },
  saveBtnTextDisabled: {
    color: 'rgba(14,21,32,0.5)',
  },

  /* Info popup */
  popupLayer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: 'rgba(5,9,14,0.6)',
  },
  popupCard: {
    width: '100%',
    maxWidth: 300,
    backgroundColor: '#131C2A',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(201,169,110,0.3)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  warnBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(201,169,110,0.14)',
    marginBottom: 8,
  },
  popupTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  popupBody: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    marginBottom: 12,
  },
  popupBtn: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: GOLD,
  },
  popupBtnText: {
    color: NAVY,
    fontWeight: '700',
    fontSize: 12,
  },
});