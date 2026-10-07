import React, { useCallback, useEffect, useState } from 'react';
import { Text, Alert, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  organizationService,
  type Organization,
  type HikingEvent,
  type EventStatus,
} from '../../services/organizationService';
import { mountainService, type Mountain } from '../../services/mountainService';
import { useRequireOrganization } from '../../hooks/useRoleGuard';
import {
  OrgLandscapeShell,
  RailButton,
  CenteredState,
  Banner,
  StatusPill,
  StatCard,
  InfoRow,
  Block,
  Grid,
  PC,
  FS,
} from '../../components/organizations/OrgLandscapeShell';

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

  if (loading) return <CenteredState loading message="Loading event…" />;
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
      backLabel="Events"
      title={event.title}
      titleLines={2}
      badge={<StatusPill status={event.status} />}
      rail={
        <Grid>
          <StatCard
            label="Attending"
            value={counts.confirmed}
            sub={` / ${event.capacity ?? '∞'}`}
          />
          <StatCard label="Waitlist" value={counts.waitlist} />
        </Grid>
      }
      railFooter={
        <>
          <RailButton
            icon="people-outline"
            label={`Manage attendees (${counts.confirmed + counts.waitlist})`}
            variant="gold"
            onPress={() =>
              router.push({
                pathname: '/organizations/Attendees',
                params: { eventId: event.id },
              } as any)
            }
          />

          {event.status === 'draft' && (
            <>
              <RailButton
                icon={isVerified ? 'rocket-outline' : 'lock-closed-outline'}
                label={isVerified ? 'Publish event' : 'Publish locked'}
                variant="primary"
                loading={working}
                disabled={!isVerified || working}
                onPress={() => handleSetStatus('published')}
              />
              <RailButton
                icon="trash-outline"
                label="Delete draft"
                variant="danger"
                disabled={working}
                onPress={handleDelete}
              />
            </>
          )}

          {event.status === 'published' && (
            <>
              <RailButton
                icon="arrow-undo-outline"
                label="Move back to draft"
                variant="secondary"
                disabled={working}
                onPress={() => handleSetStatus('draft')}
              />
              <RailButton
                icon="close-circle-outline"
                label="Cancel event"
                variant="danger"
                disabled={working}
                onPress={() => handleSetStatus('cancelled')}
              />
            </>
          )}

          {(event.status === 'cancelled' || event.status === 'completed') && (
            <RailButton
              icon="trash-outline"
              label="Delete event"
              variant="danger"
              disabled={working}
              onPress={handleDelete}
            />
          )}
        </>
      }
    >
      {!isVerified && event.status === 'draft' && (
        <Banner>Awaiting admin verification — publishing is locked for now.</Banner>
      )}

      {/* Info blocks, two per row */}
      <Grid>
        <InfoRow icon="trail-sign-outline" label="Mountain" value={mountain?.name ?? '—'} />
        <InfoRow
          icon="calendar-outline"
          label="When"
          value={`${event.end_date && event.end_date !== event.event_date
            ? `${event.event_date} – ${event.end_date}`
            : event.event_date} · ${event.start_time}${event.end_time ? `–${event.end_time}` : event.duration_hours ? ` · ${event.duration_hours}h` : ''}`}
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
      </Grid>

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
    </OrgLandscapeShell>
  );
}

const styles = StyleSheet.create({
  blockText: { color: PC.textBody, fontSize: FS.base, lineHeight: 19 },
});