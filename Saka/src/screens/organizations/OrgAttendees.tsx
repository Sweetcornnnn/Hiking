import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  organizationService,
  type HikingEvent,
  type EventAttendee,
} from '../../services/organizationService';
import { useRequireOrganization } from '../../hooks/useRoleGuard';
import {
  OrgLandscapeShell,
  CenteredState,
  Banner,
  Card,
  Chip,
  EmptyState,
  Grid,
  StatCard,
  StatusPill,
  PC,
  SP,
  FS,
} from '../../components/organizations/OrgLandscapeShell';

type StatusFilter = 'all' | 'confirmed' | 'waitlist' | 'cancelled';

const FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'waitlist', label: 'Waitlist' },
  { id: 'cancelled', label: 'Cancelled' },
];

export default function OrgAttendees() {
  useRequireOrganization();
  const router = useRouter();
  const { eventId } = useLocalSearchParams<{ eventId?: string }>();

  const [event, setEvent] = useState<HikingEvent | null>(null);
  const [attendees, setAttendees] = useState<EventAttendee[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Errors from check-in / status actions are shown inline so the list stays on screen.
  const [actionError, setActionError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [busyRsvpId, setBusyRsvpId] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!eventId) {
      setError('Missing event id');
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const [evt, list] = await Promise.all([
        organizationService.getEventById(eventId),
        organizationService.getEventAttendees(eventId),
      ]);
      if (!evt) {
        setError('Event not found');
        return;
      }
      setEvent(evt);
      setAttendees(list);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load attendees');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setActionError(null);
    fetchAll();
  }, [fetchAll]);

  const filtered = useMemo(() => {
    if (filter === 'all') return attendees;
    return attendees.filter((a) => a.status === filter);
  }, [attendees, filter]);

  const counts = useMemo(() => {
    const c = { confirmed: 0, waitlist: 0, cancelled: 0, checkedIn: 0 };
    for (const a of attendees) {
      if (a.status === 'confirmed' || a.status === 'pending') c.confirmed += a.guest_count;
      else if (a.status === 'waitlist') c.waitlist += a.guest_count;
      else if (a.status === 'cancelled') c.cancelled += a.guest_count;
      if (a.checked_in) c.checkedIn += a.guest_count;
    }
    return c;
  }, [attendees]);

  const handleToggleCheckIn = async (a: EventAttendee) => {
    setActionError(null);
    setBusyRsvpId(a.rsvp_id);
    const { error: e } = await organizationService.toggleRsvpCheckIn(
      a.rsvp_id,
      !a.checked_in
    );
    setBusyRsvpId(null);
    if (e) {
      setActionError(e);
      return;
    }
    setAttendees((prev) =>
      prev.map((r) =>
        r.rsvp_id === a.rsvp_id ? { ...r, checked_in: !r.checked_in } : r
      )
    );
  };

  const handleSetStatus = async (a: EventAttendee, status: string) => {
    setActionError(null);
    setBusyRsvpId(a.rsvp_id);
    const { error: e } = await organizationService.updateRsvpStatus(a.rsvp_id, status);
    setBusyRsvpId(null);
    if (e) {
      setActionError(e);
      return;
    }
    setAttendees((prev) =>
      prev.map((r) => (r.rsvp_id === a.rsvp_id ? { ...r, status } : r))
    );
  };

  if (loading) return <CenteredState loading message="Loading attendees…" />;
  if (error || !event) {
    return (
      <CenteredState
        message={error ?? 'Event not found'}
        actionLabel="Go back"
        onAction={() => router.back()}
      />
    );
  }

  return (
    <OrgLandscapeShell
      onBack={() => router.back()}
      backLabel="Event"
      eyebrow="Attendees"
      title={event.title}
      titleLines={2}
      rail={
        <>
          {/* Summary, 2 x 2 */}
          <Grid>
            <StatCard label="Confirmed" value={counts.confirmed} accent={PC.green} />
            <StatCard label="Waitlist" value={counts.waitlist} accent={PC.gold} />
            <StatCard label="Checked in" value={counts.checkedIn} accent="#7DD3FC" />
            <StatCard label="Cancelled" value={counts.cancelled} accent={PC.danger} />
          </Grid>

          {/* Filters */}
          <View style={styles.filtersWrap}>
            {FILTERS.map((f) => (
              <Chip
                key={f.id}
                label={f.label}
                active={filter === f.id}
                onPress={() => setFilter(f.id)}
              />
            ))}
          </View>
        </>
      }
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PC.gold} />
      }
    >
      {actionError ? <Banner tone="error">{actionError}</Banner> : null}

      {filtered.length === 0 ? (
        <EmptyState
          icon="people-outline"
          title={`No attendees${filter !== 'all' ? ` (${filter})` : ''}`}
          hint={
            filter === 'all'
              ? 'When hikers RSVP, they’ll show up here.'
              : 'Try a different filter.'
          }
        />
      ) : (
        filtered.map((a) => {
          const name = a.full_name || a.email || 'Unknown hiker';
          const initials = name
            .split(' ')
            .map((p) => p[0])
            .join('')
            .slice(0, 2)
            .toUpperCase();
          const busy = busyRsvpId === a.rsvp_id;

          return (
            <Card key={a.rsvp_id} style={styles.attendeeCard}>
              <View style={styles.attendeeHeader}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.attendeeName} numberOfLines={1}>
                    {name}
                  </Text>
                  <Text style={styles.attendeeMeta} numberOfLines={1}>
                    {a.email ?? 'No email'}
                    {a.contact_number ? ` · ${a.contact_number}` : ''}
                  </Text>
                </View>
                <StatusPill status={a.status} />
              </View>

              <View style={styles.attendeeFooter}>
                <View style={styles.guestPill}>
                  <Ionicons name="people-outline" size={12} color="rgba(255,255,255,0.65)" />
                  <Text style={styles.guestPillText}>
                    {a.guest_count} {a.guest_count === 1 ? 'guest' : 'guests'}
                  </Text>
                </View>

                <View style={styles.actions}>
                  {a.status === 'waitlist' && (
                    <ActionButton
                      icon="checkmark"
                      label="Confirm"
                      color={PC.green}
                      disabled={busy}
                      onPress={() => handleSetStatus(a, 'confirmed')}
                    />
                  )}

                  {(a.status === 'confirmed' || a.status === 'pending') && (
                    <ActionButton
                      icon="hourglass-outline"
                      label="Waitlist"
                      color={PC.gold}
                      disabled={busy}
                      onPress={() => handleSetStatus(a, 'waitlist')}
                    />
                  )}

                  {a.status !== 'cancelled' && (
                    <ActionButton
                      icon="close"
                      label="Cancel"
                      color={PC.danger}
                      disabled={busy}
                      onPress={() => handleSetStatus(a, 'cancelled')}
                    />
                  )}

                  {a.status === 'cancelled' && (
                    <ActionButton
                      icon="refresh"
                      label="Restore"
                      color={PC.green}
                      disabled={busy}
                      onPress={() => handleSetStatus(a, 'confirmed')}
                    />
                  )}

                  <ActionButton
                    icon={a.checked_in ? 'checkmark-circle' : 'ellipse-outline'}
                    label={a.checked_in ? 'Checked in' : 'Check in'}
                    color={a.checked_in ? '#0E1520' : 'rgba(255,255,255,0.7)'}
                    filled={a.checked_in}
                    loading={busy}
                    disabled={busy || a.status === 'cancelled'}
                    onPress={() => handleToggleCheckIn(a)}
                  />
                </View>
              </View>
            </Card>
          );
        })
      )}
    </OrgLandscapeShell>
  );
}

/** Compact pill action: 32px tall with extra hit area. */
function ActionButton({
  icon,
  label,
  color,
  onPress,
  disabled,
  loading,
  filled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  filled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.actionBtn, filled && styles.actionBtnFilled, disabled && !loading && styles.actionBtnDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={filled ? '#0E1520' : PC.gold} />
      ) : (
        <>
          <Ionicons name={icon} size={13} color={color} />
          <Text style={[styles.actionText, { color }]}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  filtersWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },

  attendeeCard: { gap: SP.md },
  attendeeHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: PC.goldSoft,
    borderWidth: 1,
    borderColor: 'rgba(201,169,110,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: PC.gold, fontWeight: '800', fontSize: FS.body },
  attendeeName: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  attendeeMeta: { color: 'rgba(255,255,255,0.5)', fontSize: FS.small, marginTop: 2 },

  attendeeFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SP.sm, flexWrap: 'wrap' },
  guestPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: PC.bgSubtle,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  guestPillText: { color: 'rgba(255,255,255,0.65)', fontSize: FS.small, fontWeight: '600' },

  actions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, rowGap: SP.sm },
  actionBtn: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 11,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  actionBtnFilled: { backgroundColor: PC.green, borderColor: PC.green },
  actionBtnDisabled: { opacity: 0.4 },
  actionText: { fontSize: FS.body, fontWeight: '700' },
});