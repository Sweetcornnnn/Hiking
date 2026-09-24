import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
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
    setBusyRsvpId(a.rsvp_id);
    const { error: e } = await organizationService.toggleRsvpCheckIn(
      a.rsvp_id,
      !a.checked_in
    );
    setBusyRsvpId(null);
    if (e) {
      setError(e);
      return;
    }
    setAttendees((prev) =>
      prev.map((r) =>
        r.rsvp_id === a.rsvp_id ? { ...r, checked_in: !r.checked_in } : r
      )
    );
  };

  const handleSetStatus = async (a: EventAttendee, status: string) => {
    setBusyRsvpId(a.rsvp_id);
    const { error: e } = await organizationService.updateRsvpStatus(a.rsvp_id, status);
    setBusyRsvpId(null);
    if (e) {
      setError(e);
      return;
    }
    setAttendees((prev) =>
      prev.map((r) => (r.rsvp_id === a.rsvp_id ? { ...r, status } : r))
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#C9A96E" />
        <Text style={styles.centeredText}>Loading attendees…</Text>
      </View>
    );
  }

  if (error || !event) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={36} color="#E07070" />
        <Text style={styles.centeredText}>{error ?? 'Event not found'}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => router.back()}>
          <Text style={styles.retryText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#C9A96E" />
      }
    >
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
        <Ionicons name="chevron-back" size={18} color="#C9A96E" />
        <Text style={styles.backText}>Event</Text>
      </TouchableOpacity>

      <Text style={styles.eyebrow}>Attendees</Text>
      <Text style={styles.title} numberOfLines={1}>
        {event.title}
      </Text>

      {/* Summary */}
      <View style={styles.summaryGrid}>
        <Summary label="Confirmed" value={counts.confirmed} accent="#3FD69D" />
        <Summary label="Waitlist" value={counts.waitlist} accent="#C9A96E" />
        <Summary label="Checked in" value={counts.checkedIn} accent="#7DD3FC" />
        <Summary label="Cancelled" value={counts.cancelled} accent="#E07070" />
      </View>

      {/* Filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersRow}
      >
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.id}
            style={[styles.filterChip, filter === f.id && styles.filterChipActive]}
            onPress={() => setFilter(f.id)}
            activeOpacity={0.85}
          >
            <Text
              style={[styles.filterChipText, filter === f.id && styles.filterChipTextActive]}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* List */}
      {filtered.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="people-outline" size={30} color="rgba(255,255,255,0.25)" />
          <Text style={styles.emptyText}>No attendees {filter !== 'all' ? `(${filter})` : ''}</Text>
          <Text style={styles.emptyHint}>
            {filter === 'all'
              ? 'When hikers RSVP, they’ll show up here.'
              : 'Try a different filter.'}
          </Text>
        </View>
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
            <View key={a.rsvp_id} style={styles.attendeeCard}>
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
                  <Ionicons name="people-outline" size={11} color="rgba(255,255,255,0.6)" />
                  <Text style={styles.guestPillText}>
                    {a.guest_count} {a.guest_count === 1 ? 'guest' : 'guests'}
                  </Text>
                </View>

                <View style={{ flex: 1 }} />

                {a.status === 'waitlist' && (
                  <TouchableOpacity
                    style={styles.smallBtn}
                    onPress={() => handleSetStatus(a, 'confirmed')}
                    disabled={busy}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="checkmark" size={12} color="#3FD69D" />
                    <Text style={[styles.smallBtnText, { color: '#3FD69D' }]}>Confirm</Text>
                  </TouchableOpacity>
                )}

                {(a.status === 'confirmed' || a.status === 'pending') && (
                  <TouchableOpacity
                    style={styles.smallBtn}
                    onPress={() => handleSetStatus(a, 'waitlist')}
                    disabled={busy}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="hourglass-outline" size={12} color="#C9A96E" />
                    <Text style={[styles.smallBtnText, { color: '#C9A96E' }]}>Waitlist</Text>
                  </TouchableOpacity>
                )}

                {a.status !== 'cancelled' && (
                  <TouchableOpacity
                    style={styles.smallBtn}
                    onPress={() => handleSetStatus(a, 'cancelled')}
                    disabled={busy}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="close" size={12} color="#E07070" />
                    <Text style={[styles.smallBtnText, { color: '#E07070' }]}>Cancel</Text>
                  </TouchableOpacity>
                )}

                {a.status === 'cancelled' && (
                  <TouchableOpacity
                    style={styles.smallBtn}
                    onPress={() => handleSetStatus(a, 'confirmed')}
                    disabled={busy}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="refresh" size={12} color="#3FD69D" />
                    <Text style={[styles.smallBtnText, { color: '#3FD69D' }]}>Restore</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.checkInBtn, a.checked_in && styles.checkInBtnActive]}
                  onPress={() => handleToggleCheckIn(a)}
                  disabled={busy || a.status === 'cancelled'}
                  activeOpacity={0.85}
                >
                  {busy ? (
                    <ActivityIndicator size="small" color="#0E1520" />
                  ) : (
                    <>
                      <Ionicons
                        name={a.checked_in ? 'checkmark-circle' : 'ellipse-outline'}
                        size={12}
                        color={a.checked_in ? '#0E1520' : 'rgba(255,255,255,0.5)'}
                      />
                      <Text
                        style={[
                          styles.checkInText,
                          a.checked_in && styles.checkInTextActive,
                        ]}
                      >
                        {a.checked_in ? 'Checked in' : 'Check in'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

function Summary({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, { color: accent }]}>{value}</Text>
    </View>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    confirmed: { bg: 'rgba(29,143,106,0.2)', text: '#3FD69D', label: 'Confirmed' },
    pending: { bg: 'rgba(201,169,110,0.18)', text: '#C9A96E', label: 'Pending' },
    waitlist: { bg: 'rgba(201,169,110,0.15)', text: '#C9A96E', label: 'Waitlist' },
    cancelled: { bg: 'rgba(224,112,112,0.18)', text: '#E07070', label: 'Cancelled' },
  };
  const meta = map[status] ?? { bg: 'rgba(255,255,255,0.08)', text: 'rgba(255,255,255,0.6)', label: status };
  return (
    <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
      <Text style={[styles.statusPillText, { color: meta.text }]}>{meta.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0A121A' },
  container: { padding: 20, paddingTop: 26, paddingBottom: 80, gap: 12 },
  centered: { flex: 1, backgroundColor: '#0A121A', justifyContent: 'center', alignItems: 'center', gap: 12 },
  centeredText: { color: 'rgba(255,255,255,0.6)', fontSize: 13 },
  retryBtn: { marginTop: 8, paddingHorizontal: 18, paddingVertical: 10, backgroundColor: '#C9A96E', borderRadius: 10 },
  retryText: { color: '#0E1520', fontWeight: '700' },

  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingVertical: 4 },
  backText: { color: '#C9A96E', fontWeight: '600', fontSize: 12 },
  eyebrow: { color: '#C9A96E', fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 4 },
  title: { color: '#FFF', fontSize: 20, fontWeight: '800', marginTop: 2 },

  summaryGrid: { flexDirection: 'row', gap: 8, marginTop: 6 },
  summaryCard: {
    flex: 1,
    backgroundColor: '#111C27',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 10,
  },
  summaryLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  summaryValue: { fontSize: 18, fontWeight: '800', marginTop: 4 },

  filtersRow: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  filterChipActive: { backgroundColor: '#C9A96E', borderColor: '#C9A96E' },
  filterChipText: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '600' },
  filterChipTextActive: { color: '#0E1520', fontWeight: '800' },

  attendeeCard: {
    backgroundColor: '#111C27',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 12,
    gap: 10,
  },
  attendeeHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(201,169,110,0.12)',
    borderWidth: 1, borderColor: 'rgba(201,169,110,0.3)',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { color: '#C9A96E', fontWeight: '800', fontSize: 12 },
  attendeeName: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  attendeeMeta: { color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 2 },

  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  statusPillText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },

  attendeeFooter: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  guestPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  guestPillText: { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '600' },

  smallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  smallBtnText: { fontSize: 10, fontWeight: '700' },

  checkInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  checkInBtnActive: {
    backgroundColor: '#3FD69D',
    borderColor: '#3FD69D',
  },
  checkInText: { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '700' },
  checkInTextActive: { color: '#0E1520', fontWeight: '800' },

  emptyCard: {
    backgroundColor: '#111C27',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 30,
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  emptyText: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600' },
  emptyHint: { color: 'rgba(255,255,255,0.35)', fontSize: 11, textAlign: 'center' },
});