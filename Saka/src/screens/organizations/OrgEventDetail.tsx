import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  organizationService,
  type Organization,
  type HikingEvent,
  type EventStatus,
} from '../../services/organizationService';
import { mountainService, type Mountain } from '../../services/mountainService';
import { useRequireOrganization } from '../../hooks/useRoleGuard';

export default function OrgEventDetail() {
  useRequireOrganization();
  const router = useRouter();
  const { eventId } = useLocalSearchParams<{ eventId?: string }>();

  const [org, setOrg] = useState<Organization | null>(null);
  const [event, setEvent] = useState<HikingEvent | null>(null);
  const [mountain, setMountain] = useState<Mountain | null>(null);
  const [counts, setCounts] = useState({ confirmed: 0, waitlist: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!eventId) {
      setError('Missing event id');
      setLoading(false);
      return;
    }

    setError(null);
    try {
      const [organization, evt] = await Promise.all([
        organizationService.getMyOrganization(),
        organizationService.getEventById(eventId),
      ]);

      if (!organization) {
        router.replace('/organizations/BecomeOrganizer');
        return;
      }
      if (!evt) {
        setError('Event not found');
        return;
      }
      setOrg(organization);
      setEvent(evt);

      const cached = mountainService.getCachedMountainById(evt.mountain_id);
      if (cached) {
        setMountain(cached);
      } else {
        const fresh = await mountainService.fetchMountainById(evt.mountain_id);
        setMountain(fresh);
      }

      const map = await organizationService.getEventRsvpCounts([evt.id]);
      setCounts(map[evt.id] ?? { confirmed: 0, waitlist: 0, total: 0 });
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load event');
    } finally {
      setLoading(false);
    }
  }, [eventId, router]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const isVerified = org?.is_verified === true;

  const handleSetStatus = async (status: EventStatus) => {
    if (!event) return;
    if (status === 'published' && !isVerified) {
      Alert.alert(
        'Verification required',
        'Your organization must be verified before publishing events.'
      );
      return;
    }
    setWorking(true);
    const { error: e } = await organizationService.updateEventStatus(event.id, status);
    setWorking(false);
    if (e) {
      Alert.alert('Update failed', e);
      return;
    }
    await fetchAll();
  };

  const handleDelete = () => {
    if (!event) return;
    Alert.alert('Delete event?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setWorking(true);
          const { error: e } = await organizationService.deleteEvent(event.id);
          setWorking(false);
          if (e) {
            Alert.alert('Delete failed', e);
            return;
          }
          router.replace('/organizations/Events');
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#C9A96E" />
        <Text style={styles.centeredText}>Loading event…</Text>
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

  const statusInfo = statusMeta(event.status);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
        <Ionicons name="chevron-back" size={18} color="#C9A96E" />
        <Text style={styles.backText}>Events</Text>
      </TouchableOpacity>

      <View style={styles.headerRow}>
        <Text style={styles.title} numberOfLines={2}>
          {event.title}
        </Text>
        <View style={[styles.statusPill, { backgroundColor: statusInfo.bg }]}>
          <Text style={[styles.statusPillText, { color: statusInfo.text }]}>
            {statusInfo.label}
          </Text>
        </View>
      </View>

      {!isVerified && event.status === 'draft' && (
        <View style={styles.warnBanner}>
          <Ionicons name="information-circle-outline" size={14} color="#C9A96E" />
          <Text style={styles.warnText}>
            Awaiting admin verification — publishing is locked for now.
          </Text>
        </View>
      )}

      {/* Stat row */}
      <View style={styles.statRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Attending</Text>
          <Text style={styles.statValue}>
            {counts.confirmed}
            {event.capacity ? <Text style={styles.statValueSub}>{` / ${event.capacity}`}</Text> : null}
          </Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Waitlist</Text>
          <Text style={styles.statValue}>{counts.waitlist}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Capacity</Text>
          <Text style={styles.statValue}>{event.capacity ?? '∞'}</Text>
        </View>
      </View>

      {/* Info blocks */}
      <InfoRow icon="trail-sign-outline" label="Mountain" value={mountain?.name ?? '—'} />
      <InfoRow
        icon="calendar-outline"
        label="When"
        value={`${event.event_date} · ${event.start_time}${event.duration_hours ? ` · ${event.duration_hours}h` : ''}`}
      />
      <InfoRow icon="location-outline" label="Meeting point" value={event.meeting_point} />
      <InfoRow icon="speedometer-outline" label="Difficulty" value={event.difficulty} />
      <InfoRow
        icon="eye-outline"
        label="Visibility"
        value={event.is_public ? 'Public — anyone can see' : 'Private — invite only'}
      />
      <InfoRow
        icon="walk-outline"
        label="Walk-ins"
        value={event.allow_walkins ? 'Allowed' : 'Not allowed'}
      />

      {event.description ? (
        <Block label="DESCRIPTION">
          <Text style={styles.blockText}>{event.description}</Text>
        </Block>
      ) : null}

      {event.safety_notes ? (
        <Block label="SAFETY NOTES">
          <Text style={styles.blockText}>{event.safety_notes}</Text>
        </Block>
      ) : null}

      {event.required_gear ? (
        <Block label="REQUIRED GEAR">
          <Text style={styles.blockText}>{event.required_gear}</Text>
        </Block>
      ) : null}

      {/* Actions */}
      <View style={styles.actionSection}>
        <TouchableOpacity
          style={styles.attendeesBtn}
          onPress={() =>
            router.push({
              pathname: '/organizations/Attendees',
              params: { eventId: event.id },
            } as any)
          }
          activeOpacity={0.85}
        >
          <Ionicons name="people-outline" size={17} color="#C9A96E" />
          <Text style={styles.attendeesBtnText}>
            Manage attendees ({counts.confirmed + counts.waitlist})
          </Text>
        </TouchableOpacity>

        {event.status === 'draft' && (
          <>
            <TouchableOpacity
              style={[styles.primaryBtn, (!isVerified || working) && styles.btnDisabled]}
              onPress={() => handleSetStatus('published')}
              disabled={!isVerified || working}
              activeOpacity={0.85}
            >
              {working ? (
                <ActivityIndicator color="#0E1520" />
              ) : (
                <>
                  <Ionicons
                    name={isVerified ? 'rocket-outline' : 'lock-closed-outline'}
                    size={16}
                    color="#0E1520"
                  />
                  <Text style={styles.primaryBtnText}>
                    {isVerified ? 'Publish event' : 'Publish locked'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dangerOutlineBtn}
              onPress={handleDelete}
              disabled={working}
              activeOpacity={0.85}
            >
              <Ionicons name="trash-outline" size={16} color="#E07070" />
              <Text style={styles.dangerOutlineText}>Delete draft</Text>
            </TouchableOpacity>
          </>
        )}

        {event.status === 'published' && (
          <>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => handleSetStatus('draft')}
              disabled={working}
              activeOpacity={0.85}
            >
              <Ionicons name="arrow-undo-outline" size={16} color="#F4E7C5" />
              <Text style={styles.secondaryBtnText}>Move back to draft</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dangerOutlineBtn}
              onPress={() => handleSetStatus('cancelled')}
              disabled={working}
              activeOpacity={0.85}
            >
              <Ionicons name="close-circle-outline" size={16} color="#E07070" />
              <Text style={styles.dangerOutlineText}>Cancel event</Text>
            </TouchableOpacity>
          </>
        )}

        {(event.status === 'cancelled' || event.status === 'completed') && (
          <TouchableOpacity
            style={styles.dangerOutlineBtn}
            onPress={handleDelete}
            disabled={working}
            activeOpacity={0.85}
          >
            <Ionicons name="trash-outline" size={16} color="#E07070" />
            <Text style={styles.dangerOutlineText}>Delete event</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

function statusMeta(status: EventStatus) {
  switch (status) {
    case 'draft':
      return { bg: 'rgba(201,169,110,0.18)', text: '#C9A96E', label: 'Draft' };
    case 'published':
      return { bg: 'rgba(29,143,106,0.2)', text: '#3FD69D', label: 'Published' };
    case 'full':
      return { bg: 'rgba(230,126,34,0.2)', text: '#E67E22', label: 'Full' };
    case 'cancelled':
      return { bg: 'rgba(224,112,112,0.18)', text: '#E07070', label: 'Cancelled' };
    case 'completed':
      return { bg: 'rgba(106,127,149,0.2)', text: '#8FA4BA', label: 'Completed' };
  }
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Ionicons name={icon} size={14} color="#C9A96E" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.block}>
      <Text style={styles.blockLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0A121A' },
  container: { padding: 22, paddingTop: 26, paddingBottom: 80, gap: 12 },
  centered: { flex: 1, backgroundColor: '#0A121A', justifyContent: 'center', alignItems: 'center', gap: 12 },
  centeredText: { color: 'rgba(255,255,255,0.6)', fontSize: 13 },
  retryBtn: { marginTop: 8, paddingHorizontal: 18, paddingVertical: 10, backgroundColor: '#C9A96E', borderRadius: 10 },
  retryText: { color: '#0E1520', fontWeight: '700' },

  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingVertical: 4 },
  backText: { color: '#C9A96E', fontWeight: '600', fontSize: 12 },

  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 4 },
  title: { color: '#FFF', fontSize: 22, fontWeight: '800', flex: 1 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, marginTop: 6 },
  statusPillText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },

  warnBanner: {
    flexDirection: 'row',
    gap: 8,
    padding: 10,
    backgroundColor: 'rgba(201,169,110,0.06)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(201,169,110,0.2)',
  },
  warnText: { color: '#E8D7AE', fontSize: 11, flex: 1, lineHeight: 16 },

  statRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  statCard: {
    flex: 1,
    backgroundColor: '#111C27',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 12,
  },
  statLabel: { color: '#A9B7C4', fontSize: 10, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 },
  statValue: { color: '#FFF', fontSize: 20, fontWeight: '800' },
  statValueSub: { color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: '600' },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#111C27',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 12,
  },
  infoIcon: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: 'rgba(201,169,110,0.1)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(201,169,110,0.2)',
  },
  infoLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  infoValue: { color: '#FFF', fontSize: 13, fontWeight: '600', marginTop: 2 },

  block: {
    backgroundColor: '#111C27',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 14,
    gap: 6,
  },
  blockLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  blockText: { color: '#DCE6EF', fontSize: 13, lineHeight: 19 },

  actionSection: { gap: 10, marginTop: 10 },
  attendeesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(201,169,110,0.08)',
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(201,169,110,0.28)',
  },
  attendeesBtnText: { color: '#C9A96E', fontWeight: '700', fontSize: 13 },

  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#C9A96E',
    borderRadius: 12,
    paddingVertical: 15,
  },
  primaryBtnText: { color: '#0E1520', fontWeight: '800', fontSize: 13 },

  secondaryBtn: {
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
  secondaryBtnText: { color: '#F4E7C5', fontWeight: '700', fontSize: 13 },

  dangerOutlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(224,112,112,0.06)',
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(224,112,112,0.3)',
  },
  dangerOutlineText: { color: '#E07070', fontWeight: '700', fontSize: 13 },
  btnDisabled: { opacity: 0.4 },
});