import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Modal } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import {
  organizationService,
  type Organization,
  type EventStatus,
} from '../../services/organizationService';
import { mountainService, type Mountain } from '../../services/mountainService';
import { fetchMeetingPoints } from '../../services/viewpointService';
import { useRequireOrganization } from '../../hooks/useRoleGuard';
import {
  OrgLandscapeShell,
  RailButton,
  CenteredState,
  Banner,
  Field,
  FormInput,
  FormRow,
  SelectField,
  Chip,
  PickerModal,
  PC,
  SP,
  FS,
} from '../../components/organizations/OrgLandscapeShell';

const DIFFICULTIES = ['Easy', 'Moderate', 'Hard', 'Expert'] as const;

// Local date (toISOString is UTC and is off by a day for early-morning UTC+8 users).
const todayISO = () => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
};

const dateFromISO = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const dateToISO = (value: Date) => {
  const mm = String(value.getMonth() + 1).padStart(2, '0');
  const dd = String(value.getDate()).padStart(2, '0');
  return `${value.getFullYear()}-${mm}-${dd}`;
};

const timeFromValue = (value: string) => {
  const [hours, minutes] = value.split(':').map(Number);
  const result = new Date();
  result.setHours(hours, minutes, 0, 0);
  return result;
};

const timeToValue = (value: Date) =>
  `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;

const OTHER_MEETING_POINT = '__other__';

const isDateLike = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
const isTimeLike = (v: string) => /^\d{2}:\d{2}$/.test(v);

export default function OrgCreateEvent() {
  const router = useRouter();
  useRequireOrganization();

  const [org, setOrg] = useState<Organization | null>(null);
  const [orgLoading, setOrgLoading] = useState(true);
  const [mountains, setMountains] = useState<Mountain[]>([]);
  const [meetingPointOptions, setMeetingPointOptions] = useState<string[]>([]);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [mountainId, setMountainId] = useState<string | null>(null);
  const [mountainPickerOpen, setMountainPickerOpen] = useState(false);
  const [meetingPointPickerOpen, setMeetingPointPickerOpen] = useState(false);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [meetingPoint, setMeetingPoint] = useState('');
  const [customMeetingPoint, setCustomMeetingPoint] = useState(false);
  const [activePicker, setActivePicker] = useState<'date' | 'start' | 'end' | null>(null);
  const [difficulty, setDifficulty] = useState<(typeof DIFFICULTIES)[number]>('Moderate');
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

  useEffect(() => {
    let mounted = true;
    if (!mountainId) {
      setMeetingPointOptions([]);
      setMeetingPoint('');
      setCustomMeetingPoint(false);
      return;
    }

    fetchMeetingPoints(mountainId, selectedMountain?.name, selectedMountain?.viewpoints).then((points) => {
      if (mounted) setMeetingPointOptions(points);
    });
    setMeetingPoint('');
    setCustomMeetingPoint(false);
    return () => {
      mounted = false;
    };
  }, [mountainId, selectedMountain]);

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
    if (!isTimeLike(time)) return 'Choose a start time';
    if (!isTimeLike(endTime)) return 'Choose an end time';
    if (time === endTime) return 'End time must be different from start time';
    if (!meetingPoint.trim()) return 'Meeting point is required';
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
      end_time: endTime,
      meeting_point: meetingPoint.trim(),
      difficulty,
      duration_hours: durationFromTimes(time, endTime),
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

  if (orgLoading) return <CenteredState loading message="Loading…" />;
  if (!org) return null;

  return (
    <>
      <OrgLandscapeShell
        onBack={() => router.back()}
        backLabel="Back"
        eyebrow="New event"
        title="Create a hiking event"
        titleLines={2}
        rail={
          <>
            {!isVerified && (
              <Banner>
                Not verified yet — you can save drafts, but publishing is locked until an admin
                approves you.
              </Banner>
            )}
            {error && <Banner tone="error">{error}</Banner>}
          </>
        }
        railFooter={
          <>
            <RailButton
              icon="save-outline"
              label="Save draft"
              variant="secondary"
              disabled={submitting}
              onPress={() => handleSave('draft')}
            />
            <RailButton
              icon={isVerified ? 'rocket-outline' : 'lock-closed-outline'}
              label={isVerified ? 'Publish event' : 'Publish locked'}
              variant="primary"
              loading={submitting}
              disabled={submitting || !isVerified}
              onPress={() => handleSave('published')}
            />
          </>
        }
      >
        {/* Title + mountain */}
        <FormRow>
          <Field label="EVENT TITLE">
            <FormInput
              value={title}
              onChangeText={setTitle}
              placeholder="Sunrise Ridge Hike"
              editable={!submitting}
            />
          </Field>
          <Field label="MOUNTAIN">
            <SelectField
              icon={selectedMountain ? 'trail-sign-outline' : 'add-circle-outline'}
              text={
                selectedMountain
                  ? `${selectedMountain.name} · ${selectedMountain.difficulty}`
                  : 'Select a mountain'
              }
              selected={!!selectedMountain}
              disabled={submitting}
              onPress={() => setMountainPickerOpen(true)}
            />
          </Field>
        </FormRow>

        <Field label="DESCRIPTION">
          <FormInput
            value={description}
            onChangeText={setDescription}
            placeholder="A moderate 6-hour ridge hike with a sunrise summit."
            multiline
            editable={!submitting}
          />
        </Field>

        {/* Date and times use native pickers instead of manual text entry. */}
        <FormRow>
          <Field label="DATE">
            <SelectField
              icon="calendar-outline"
              text={date ? dateFromISO(date).toLocaleDateString() : 'Event Date'}
              selected={!!date}
              disabled={submitting}
              onPress={() => setActivePicker('date')}
            />
          </Field>
          <Field label="START TIME">
            <SelectField
              icon="time-outline"
              text={time ? timeFromValue(time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Starting time'}
              selected={!!time}
              disabled={submitting}
              onPress={() => setActivePicker('start')}
            />
          </Field>
          <Field label="END TIME">
            <SelectField
              icon="time-outline"
              text={endTime ? timeFromValue(endTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Ending time'}
              selected={!!endTime}
              disabled={submitting}
              onPress={() => setActivePicker('end')}
            />
          </Field>
        </FormRow>

        {/* Meeting point + capacity */}
        <FormRow weights={[2, 1]}>
          <Field label="MEETING POINT">
            <SelectField
              icon="location-outline"
              text={customMeetingPoint
                ? 'Other location'
                : meetingPoint || (mountainId ? 'Choose a meeting point' : 'Select a mountain first')}
              selected={!!meetingPoint}
              disabled={submitting}
              onPress={() => {
                if (!mountainId) {
                  setMountainPickerOpen(true);
                  return;
                }
                setMeetingPointPickerOpen(true);
              }}
            />
            {customMeetingPoint && (
              <FormInput
                value={meetingPoint}
                onChangeText={setMeetingPoint}
                placeholder="Enter the meeting location"
                editable={!submitting}
              />
            )}
          </Field>
          <Field label="CAPACITY">
            <FormInput
              value={capacity}
              onChangeText={setCapacity}
              placeholder="20"
              keyboardType="numeric"
              editable={!submitting}
            />
          </Field>
        </FormRow>

        {/* Difficulty */}
        <Field label="DIFFICULTY">
          <View style={styles.chipRow}>
            {DIFFICULTIES.map((d) => (
              <Chip
                key={d}
                label={d}
                active={difficulty === d}
                disabled={submitting}
                onPress={() => setDifficulty(d)}
              />
            ))}
          </View>
        </Field>

        {/* Toggles, side by side */}
        <FormRow>
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
        </FormRow>

        {/* Safety + gear, side by side */}
        <FormRow>
          <Field label="SAFETY NOTES">
            <FormInput
              value={safetyNotes}
              onChangeText={setSafetyNotes}
              placeholder="River crossing at KM 4, bring a change of socks."
              multiline
              editable={!submitting}
            />
          </Field>
          <Field label="REQUIRED GEAR">
            <FormInput
              value={requiredGear}
              onChangeText={setRequiredGear}
              placeholder="3L water, headlamp, rain jacket, trekking poles"
              multiline
              editable={!submitting}
            />
          </Field>
        </FormRow>
      </OrgLandscapeShell>

      <PickerModal
        visible={mountainPickerOpen}
        title="Select mountain"
        items={mountains}
        selectedId={mountainId}
        emptyText="No mountains available."
        onSelect={setMountainId}
        onClose={() => setMountainPickerOpen(false)}
      />

      <PickerModal
        visible={meetingPointPickerOpen}
        title="Choose meeting point"
        items={[
          ...meetingPointOptions.map((point) => ({ id: point, name: point })),
          { id: OTHER_MEETING_POINT, name: 'Other location' },
        ]}
        selectedId={customMeetingPoint ? OTHER_MEETING_POINT : meetingPoint}
        emptyText="No saved meeting points. Choose Other location."
        onSelect={(value) => {
          const isOther = value === OTHER_MEETING_POINT;
          setCustomMeetingPoint(isOther);
          setMeetingPoint(isOther ? '' : value);
        }}
        onClose={() => setMeetingPointPickerOpen(false)}
      />

      {activePicker && (
        <>
          {Platform.OS === 'ios' ? (
            <Modal transparent animationType="fade" onRequestClose={() => setActivePicker(null)}>
              <View style={styles.pickerOverlay}>
                <View style={styles.pickerCard}>
                  <DateTimePicker
                    value={activePicker === 'date'
                      ? (date ? dateFromISO(date) : new Date())
                      : (activePicker === 'start' ? time : endTime)
                        ? timeFromValue(activePicker === 'start' ? time : endTime)
                        : new Date()}
                    mode={activePicker === 'date' ? 'date' : 'time'}
                    display="spinner"
                    minimumDate={activePicker === 'date' ? new Date() : undefined}
                    onValueChange={(_, selected) => handlePickerValue(selected)}
                    onDismiss={handlePickerDismiss}
                    onNeutralButtonPress={handlePickerDismiss}
                  />
                  <TouchableOpacity style={styles.pickerDone} onPress={() => setActivePicker(null)}>
                    <Text style={styles.pickerDoneText}>Done</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>
          ) : (
            <DateTimePicker
              value={activePicker === 'date'
                ? (date ? dateFromISO(date) : new Date())
                : (activePicker === 'start' ? time : endTime)
                  ? timeFromValue(activePicker === 'start' ? time : endTime)
                  : new Date()}
              mode={activePicker === 'date' ? 'date' : 'time'}
              display="default"
              is24Hour={false}
              minimumDate={activePicker === 'date' ? new Date() : undefined}
              onValueChange={(_, selected) => handlePickerValue(selected)}
              onDismiss={handlePickerDismiss}
              onNeutralButtonPress={handlePickerDismiss}
            />
          )}
        </>
      )}
    </>
  );

  function handlePickerValue(selected: Date) {
    if (!activePicker) return;
    if (activePicker === 'date') setDate(dateToISO(selected));
    if (activePicker === 'start') setTime(timeToValue(selected));
    if (activePicker === 'end') setEndTime(timeToValue(selected));
    if (Platform.OS !== 'ios') setActivePicker(null);
  }

  function handlePickerDismiss() {
    setActivePicker(null);
  }
}


function durationFromTimes(start: string, end: string): number {
  const [startHour, startMinute] = start.split(':').map(Number);
  const [endHour, endMinute] = end.split(':').map(Number);
  let minutes = endHour * 60 + endMinute - (startHour * 60 + startMinute);
  if (minutes <= 0) minutes += 24 * 60;
  return minutes / 60;
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
      style={[styles.toggleRow, disabled && styles.disabled]}
      onPress={() => onChange(!value)}
      disabled={disabled}
      activeOpacity={0.8}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled: !!disabled }}
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

const styles = StyleSheet.create({
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pickerOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: SP.xl,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  pickerCard: {
    backgroundColor: PC.bgPanel,
    borderColor: PC.border,
    borderWidth: 1,
    borderRadius: PC.radius,
    padding: SP.md,
  },
  pickerDone: { alignSelf: 'flex-end', paddingHorizontal: SP.lg, paddingVertical: SP.sm },
  pickerDoneText: { color: PC.gold, fontSize: FS.base, fontWeight: '700' },

  toggleRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SP.md,
    backgroundColor: PC.bgPanel,
    borderRadius: PC.radius,
    borderWidth: 1,
    borderColor: PC.borderSoft,
    paddingVertical: 10,
    paddingHorizontal: SP.md,
  },
  toggleLabel: { color: '#FFF', fontSize: FS.base, fontWeight: '700' },
  toggleHint: { color: 'rgba(255,255,255,0.5)', fontSize: FS.small, marginTop: 2, lineHeight: 15 },
  toggleTrack: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.12)',
    padding: 3,
    justifyContent: 'center',
  },
  toggleTrackOn: { backgroundColor: 'rgba(201,169,110,0.6)' },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.65)',
  },
  toggleThumbOn: { backgroundColor: PC.gold, alignSelf: 'flex-end' },
  disabled: { opacity: 0.4 },
});