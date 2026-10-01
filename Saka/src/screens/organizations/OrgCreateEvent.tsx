import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  FlatList,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import {
  organizationService,
  type Organization,
  type EventStatus,
} from '../../services/organizationService';
import { mountainService, type Mountain } from '../../services/mountainService';
import { useRequireOrganization } from '../../hooks/useRoleGuard';

const DIFFICULTIES = ['Easy', 'Moderate', 'Hard', 'Expert'] as const;

const todayISO = () => new Date().toISOString().slice(0, 10);

const isDateLike = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
const isTimeLike = (v: string) => /^\d{2}:\d{2}$/.test(v);

export default function OrgCreateEvent() {
  const router = useRouter();
  useRequireOrganization();
  const { profile } = useAuthStore();

  const [org, setOrg] = useState<Organization | null>(null);
  const [orgLoading, setOrgLoading] = useState(true);
  const [mountains, setMountains] = useState<Mountain[]>([]);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [mountainId, setMountainId] = useState<string | null>(null);
  const [mountainPickerOpen, setMountainPickerOpen] = useState(false);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [meetingPoint, setMeetingPoint] = useState('');
  const [difficulty, setDifficulty] = useState<(typeof DIFFICULTIES)[number]>('Moderate');
  const [durationHours, setDurationHours] = useState('');
  const [capacity, setCapacity] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [allowWalkins, setAllowWalkins] = useState(false);
  const [safetyNotes, setSafetyNotes] = useState('');
  const [requiredGear, setRequiredGear] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedMountain = useMemo(
    () => mountains.find((m) => m.id === mountainId) ?? null,
    [mountains, mountainId]
  );

  // Load org + mountains
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const organization = await organizationService.getMyOrganization();
        if (!mounted) return;
        if (!organization) {
          router.replace('/organizations/BecomeOrganizer');
          return;
        }
        setOrg(organization);

        const cached = mountainService.getCachedMountains();
        const list = cached.length > 0 ? cached : await mountainService.fetchMountains();
        if (!mounted) return;
        setMountains(list);
      } catch (e: any) {
        if (mounted) setError(e?.message ?? 'Failed to load form');
      } finally {
        if (mounted) setOrgLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [router]);

  const isVerified = org?.is_verified === true;

  const validation = (): string | null => {
    if (!title.trim() || title.trim().length < 3) return 'Title must be at least 3 characters';
    if (!mountainId) return 'Please select a mountain';
    if (!isDateLike(date)) return 'Date must be in YYYY-MM-DD format';
    if (date < todayISO()) return 'Date must be today or later';
    if (!isTimeLike(time)) return 'Time must be in HH:MM format';
    if (!meetingPoint.trim()) return 'Meeting point is required';
    if (durationHours && (Number.isNaN(Number(durationHours)) || Number(durationHours) <= 0)) {
      return 'Duration must be a positive number';
    }
    if (capacity && (Number.isNaN(Number(capacity)) || Number(capacity) < 1)) {
      return 'Capacity must be at least 1';
    }
    return null;
  };

  const handleSave = async (status: EventStatus) => {
    if (!org) return;
    if (status === 'published' && !isVerified) {
      setError('Your organization must be verified before publishing. Save as draft instead.');
      return;
    }

    const v = validation();
    if (v) {
      setError(v);
      return;
    }

    setSubmitting(true);
    setError(null);

    const { eventId, error: createErr } = await organizationService.createEvent({
      organization_id: org.id,
      mountain_id: mountainId!,
      title: title.trim(),
      description: description.trim() || undefined,
      event_date: date,
      start_time: time,
      meeting_point: meetingPoint.trim(),
      difficulty,
      duration_hours: durationHours ? Number(durationHours) : null,
      capacity: capacity ? Number(capacity) : null,
      is_public: isPublic,
      allow_walkins: allowWalkins,
      status,
      safety_notes: safetyNotes.trim() || undefined,
      required_gear: requiredGear.trim() || undefined,
    });

    setSubmitting(false);

    if (createErr || !eventId) {
      setError(createErr ?? 'Failed to create event');
      return;
    }

    router.replace({
    pathname: '/organizations/EventDetail',
    params: { eventId },
    } as any);
  };

  if (orgLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#C9A96E" />
        <Text style={styles.centeredText}>Loading…</Text>
      </View>
    );
  }

  if (!org) return null;

  return (
    <>
      <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={18} color="#C9A96E" />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.eyebrow}>New event</Text>
          <Text style={styles.title}>Create a hiking event</Text>
          {!isVerified && (
            <View style={styles.warnBanner}>
              <Ionicons name="information-circle-outline" size={14} color="#C9A96E" />
              <Text style={styles.warnText}>
                Your organization isn't verified yet — you can save drafts, but publishing is
                locked until an admin approves you.
              </Text>
            </View>
          )}
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={16} color="#E07070" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Basic info */}
        <FieldGroup label="EVENT TITLE">
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Sunrise Ridge Hike"
            placeholderTextColor="rgba(255,255,255,0.2)"
            style={styles.input}
            editable={!submitting}
          />
        </FieldGroup>

        <FieldGroup label="DESCRIPTION">
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="A moderate 6-hour ridge hike with a sunrise summit."
            placeholderTextColor="rgba(255,255,255,0.2)"
            style={[styles.input, styles.textarea]}
            multiline
            editable={!submitting}
          />
        </FieldGroup>

        {/* Mountain picker */}
        <FieldGroup label="MOUNTAIN">
          <TouchableOpacity
            style={styles.pickerBtn}
            onPress={() => setMountainPickerOpen(true)}
            disabled={submitting}
            activeOpacity={0.75}
          >
            <Ionicons
              name={selectedMountain ? 'trail-sign-outline' : 'add-circle-outline'}
              size={16}
              color={selectedMountain ? '#C9A96E' : 'rgba(255,255,255,0.4)'}
            />
            <Text
              style={[styles.pickerText, selectedMountain && styles.pickerTextSelected]}
              numberOfLines={1}
            >
              {selectedMountain
                ? `${selectedMountain.name} · ${selectedMountain.difficulty}`
                : 'Select a mountain'}
            </Text>
            <Ionicons name="chevron-down" size={14} color="rgba(255,255,255,0.3)" />
          </TouchableOpacity>
        </FieldGroup>

        {/* Date / time */}
        <View style={styles.row}>
          <View style={styles.rowItem}>
            <FieldGroup label="DATE (YYYY-MM-DD)">
              <TextInput
                value={date}
                onChangeText={setDate}
                placeholder={todayISO()}
                placeholderTextColor="rgba(255,255,255,0.2)"
                autoCapitalize="none"
                keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
                style={styles.input}
                editable={!submitting}
              />
            </FieldGroup>
          </View>
          <View style={styles.rowItem}>
            <FieldGroup label="START TIME (HH:MM)">
              <TextInput
                value={time}
                onChangeText={setTime}
                placeholder="05:30"
                placeholderTextColor="rgba(255,255,255,0.2)"
                autoCapitalize="none"
                style={styles.input}
                editable={!submitting}
              />
            </FieldGroup>
          </View>
        </View>

        <FieldGroup label="MEETING POINT">
          <TextInput
            value={meetingPoint}
            onChangeText={setMeetingPoint}
            placeholder="Barangay Flores trailhead"
            placeholderTextColor="rgba(255,255,255,0.2)"
            style={styles.input}
            editable={!submitting}
          />
        </FieldGroup>

        {/* Difficulty */}
        <FieldGroup label="DIFFICULTY">
          <View style={styles.chipRow}>
            {DIFFICULTIES.map((d) => (
              <TouchableOpacity
                key={d}
                onPress={() => setDifficulty(d)}
                style={[styles.chip, difficulty === d && styles.chipActive]}
                disabled={submitting}
                activeOpacity={0.8}
              >
                <Text style={[styles.chipText, difficulty === d && styles.chipTextActive]}>{d}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </FieldGroup>

        <View style={styles.row}>
          <View style={styles.rowItem}>
            <FieldGroup label="DURATION (HRS)">
              <TextInput
                value={durationHours}
                onChangeText={setDurationHours}
                placeholder="6"
                placeholderTextColor="rgba(255,255,255,0.2)"
                keyboardType="numeric"
                style={styles.input}
                editable={!submitting}
              />
            </FieldGroup>
          </View>
          <View style={styles.rowItem}>
            <FieldGroup label="CAPACITY">
              <TextInput
                value={capacity}
                onChangeText={setCapacity}
                placeholder="20"
                placeholderTextColor="rgba(255,255,255,0.2)"
                keyboardType="numeric"
                style={styles.input}
                editable={!submitting}
              />
            </FieldGroup>
          </View>
        </View>

        {/* Toggles */}
        <ToggleRow
          label="Public event"
          hint="Visible to all hikers once published"
          value={isPublic}
          onChange={setIsPublic}
          disabled={submitting}
        />
        <ToggleRow
          label="Allow walk-ins"
          hint="Hikers can join without pre-RSVP"
          value={allowWalkins}
          onChange={setAllowWalkins}
          disabled={submitting}
        />

        {/* Safety */}
        <FieldGroup label="SAFETY NOTES">
          <TextInput
            value={safetyNotes}
            onChangeText={setSafetyNotes}
            placeholder="River crossing at KM 4, bring a change of socks."
            placeholderTextColor="rgba(255,255,255,0.2)"
            style={[styles.input, styles.textarea]}
            multiline
            editable={!submitting}
          />
        </FieldGroup>

        <FieldGroup label="REQUIRED GEAR">
          <TextInput
            value={requiredGear}
            onChangeText={setRequiredGear}
            placeholder="3L water, headlamp, rain jacket, trekking poles"
            placeholderTextColor="rgba(255,255,255,0.2)"
            style={[styles.input, styles.textarea]}
            multiline
            editable={!submitting}
          />
        </FieldGroup>

        {/* Actions */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.secondaryButton, submitting && styles.btnDisabled]}
            onPress={() => handleSave('draft')}
            disabled={submitting}
            activeOpacity={0.8}
          >
            <Ionicons name="save-outline" size={16} color="#F4E7C5" />
            <Text style={styles.secondaryButtonText}>Save draft</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.primaryButton,
              (submitting || !isVerified) && styles.btnDisabled,
            ]}
            onPress={() => handleSave('published')}
            disabled={submitting || !isVerified}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color="#0E1520" />
            ) : (
              <>
                <Ionicons
                  name={isVerified ? 'rocket-outline' : 'lock-closed-outline'}
                  size={16}
                  color="#0E1520"
                />
                <Text style={styles.primaryButtonText}>
                  {isVerified ? 'Publish event' : 'Publish locked'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Mountain picker modal */}
      <MountainPickerModal
        visible={mountainPickerOpen}
        mountains={mountains}
        onSelect={setMountainId}
        onClose={() => setMountainPickerOpen(false)}
      />
    </>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

function ToggleRow({
  label,
  hint,
  value,
  onChange,
  disabled,
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.toggleRow, disabled && styles.btnDisabled]}
      onPress={() => onChange(!value)}
      disabled={disabled}
      activeOpacity={0.8}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={styles.toggleHint}>{hint}</Text>
      </View>
      <View style={[styles.toggleTrack, value && styles.toggleTrackOn]}>
        <View style={[styles.toggleThumb, value && styles.toggleThumbOn]} />
      </View>
    </TouchableOpacity>
  );
}

function MountainPickerModal({
  visible,
  mountains,
  onSelect,
  onClose,
}: {
  visible: boolean;
  mountains: Mountain[];
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select mountain</Text>
            <TouchableOpacity onPress={onClose} style={styles.modalClose}>
              <Ionicons name="close" size={14} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>
          </View>
          <FlatList
            data={mountains}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ padding: 8 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.modalRow}
                onPress={() => {
                  onSelect(item.id);
                  onClose();
                }}
                activeOpacity={0.75}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalRowTitle}>{item.name}</Text>
                  <Text style={styles.modalRowSub}>
                    {item.difficulty} · {item.elevationDisplay}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.3)" />
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={styles.modalEmpty}>No mountains available.</Text>
            }
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0A121A' },
  container: { padding: 22, paddingTop: 28, paddingBottom: 80, gap: 14 },
  centered: { flex: 1, backgroundColor: '#0A121A', justifyContent: 'center', alignItems: 'center', gap: 12 },
  centeredText: { color: 'rgba(255,255,255,0.6)', fontSize: 13 },

  header: { gap: 4, marginBottom: 4 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingVertical: 4 },
  backText: { color: '#C9A96E', fontWeight: '600', fontSize: 12 },
  eyebrow: { color: '#C9A96E', fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 4 },
  title: { color: '#FFF', fontSize: 24, fontWeight: '800' },
  warnBanner: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    padding: 10,
    backgroundColor: 'rgba(201,169,110,0.06)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(201,169,110,0.2)',
  },
  warnText: { color: '#E8D7AE', fontSize: 11, flex: 1, lineHeight: 16 },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(224,112,112,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(224,112,112,0.25)',
    padding: 12,
    borderRadius: 10,
  },
  errorText: { color: '#E07070', fontSize: 12, flex: 1 },

  fieldGroup: { gap: 6 },
  label: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  input: {
    backgroundColor: '#111C27',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#FFF',
    fontSize: 13,
  },
  textarea: { minHeight: 72, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 12 },
  rowItem: { flex: 1 },

  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#111C27',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  pickerText: { flex: 1, color: 'rgba(255,255,255,0.4)', fontSize: 13 },
  pickerTextSelected: { color: '#FFF', fontWeight: '600' },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  chipActive: { backgroundColor: '#C9A96E', borderColor: '#C9A96E' },
  chipText: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: '#0E1520', fontWeight: '800' },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#111C27',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 14,
  },
  toggleLabel: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  toggleHint: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 },
  toggleTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 3,
    justifyContent: 'center',
  },
  toggleTrackOn: { backgroundColor: 'rgba(201,169,110,0.6)' },
  toggleThumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  toggleThumbOn: { backgroundColor: '#C9A96E', alignSelf: 'flex-end' },

  actionRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#C9A96E',
    borderRadius: 12,
    paddingVertical: 15,
  },
  primaryButtonText: { color: '#0E1520', fontWeight: '800', fontSize: 13 },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#111C27',
    borderRadius: 12,
    paddingVertical: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  secondaryButtonText: { color: '#F4E7C5', fontWeight: '700', fontSize: 13 },
  btnDisabled: { opacity: 0.4 },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    maxHeight: 500,
    backgroundColor: '#111927',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  modalTitle: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  modalClose: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 10,
  },
  modalRowTitle: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  modalRowSub: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 },
  modalEmpty: { color: 'rgba(255,255,255,0.4)', fontSize: 12, textAlign: 'center', padding: 24 },
});