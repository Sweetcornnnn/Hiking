import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
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
import { EventDetailSkeleton } from '../../components/organizations/OrgSkeletons';
import Toast, { type ToastHandle } from '../../components/Toast';
import { FULLSCREEN_MODAL_PROPS, ModalScrim } from '../../components/ModalScrim';

export default function OrgEventDetail() {
  useRequireOrganization();
  const router = useRouter();
  const { eventId, createdStatus } = useLocalSearchParams<{
    eventId?: string;
    createdStatus?: EventStatus;
  }>();

  const [org, setOrg] = useState<Organization | null>(null);
  const [event, setEvent] = useState<HikingEvent | null>(null);
  const [mountain, setMountain] = useState<Mountain | null>(null);
  const [counts, setCounts] = useState({ confirmed: 0, waitlist: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toastRef = useRef<ToastHandle>(null);
  const creationNoticeShown = useRef(false);

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
      console.error('[OrgEventDetail] Failed to load event:', e);
      setError('Unable to load this event. Please try again.');
      toastRef.current?.show({
        type: 'error',
        title: 'Event failed to load',
        message: e?.message ?? 'Please try again.',
      });
    } finally {
      setLoading(false);
    }
  }, [eventId, router]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (creationNoticeShown.current || !createdStatus) return;
    creationNoticeShown.current = true;
    toastRef.current?.show({
      type: 'success',
      title: createdStatus === 'draft' ? 'Draft saved' : 'Event created',
      message: createdStatus === 'draft'
        ? 'Your event is saved as a draft.'
        : 'Your event has been published.',
    });
  }, [createdStatus]);

  const isVerified = org?.is_verified === true;

  const handleSetStatus = async (status: EventStatus) => {
    if (!event) return;
    if (status === 'published' && !isVerified) {
      toastRef.current?.show({
        type: 'warning',
        title: 'Verification required',
        message: 'Your organization must be verified before publishing events.',
      });
      return;
    }
    setWorking(true);
    try {
      const { error: e } = await organizationService.updateEventStatus(event.id, status);
      if (e) {
        toastRef.current?.show({ type: 'error', title: 'Update failed', message: e });
        return;
      }
      toastRef.current?.show({
        type: 'success',
        title: status === 'published'
          ? 'Event published'
          : status === 'draft'
            ? 'Event moved to drafts'
            : 'Event cancelled',
        message: status === 'published'
          ? 'Your event is now visible to hikers.'
          : status === 'draft'
            ? 'Your event is no longer published.'
            : 'Hikers can no longer join this event.',
      });
      await fetchAll();
    } catch (error) {
      toastRef.current?.show({
        type: 'error',
        title: 'Update failed',
        message: error instanceof Error ? error.message : 'Unable to update the event.',
      });
    } finally {
      setWorking(false);
    }
  };

  const handleDelete = () => {
    if (!event) return;
    setDeleteConfirmVisible(true);
  };

  const confirmDelete = async () => {
    if (!event || working) return;
    setWorking(true);
    try {
      const { error: e } = await organizationService.deleteEvent(event.id);
      if (e) {
        setDeleteConfirmVisible(false);
        toastRef.current?.show({ type: 'error', title: 'Delete failed', message: e });
        return;
      }
      setDeleteConfirmVisible(false);
      router.replace({
        pathname: '/organizations/Events',
        params: { notice: 'event-deleted' },
      } as any);
    } catch (error) {
      setDeleteConfirmVisible(false);
      toastRef.current?.show({
        type: 'error',
        title: 'Delete failed',
        message: error instanceof Error ? error.message : 'Unable to delete the event.',
      });
    } finally {
      setWorking(false);
    }
  };

  if (loading) {
    return (
      <>
        <EventDetailSkeleton onBack={() => router.back()} />
        <Toast ref={toastRef} />
      </>
    );
  }
  if (error || !event) {
    return (
      <>
        <CenteredState
          message={error ?? 'Event not found'}
          actionLabel="Go back"
          onAction={() => router.back()}
        />
        <Toast ref={toastRef} />
      </>
    );
  }

  return (
    <>
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
      <Modal
        {...FULLSCREEN_MODAL_PROPS}
        visible={deleteConfirmVisible}
        animationType="fade"
        onRequestClose={() => {
          if (!working) setDeleteConfirmVisible(false);
        }}
      >
        <View style={styles.deleteConfirmRoot}>
          <ModalScrim color="rgba(0,0,0,0.68)" />
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              if (!working) setDeleteConfirmVisible(false);
            }}
            accessible={false}
          />
          <View style={styles.deleteConfirmCard} accessibilityViewIsModal>
            <View style={styles.deleteConfirmIcon}>
              <Ionicons name="trash-outline" size={22} color={PC.danger} />
            </View>
            <Text style={styles.deleteConfirmTitle}>
              Delete {event.status === 'draft' ? 'draft' : 'event'}?
            </Text>
            <Text style={styles.deleteConfirmMessage}>
              “{event.title}” will be permanently removed. This action cannot be undone.
            </Text>
            <View style={styles.deleteConfirmActions}>
              <TouchableOpacity
                onPress={() => setDeleteConfirmVisible(false)}
                disabled={working}
                style={styles.deleteCancelButton}
                accessibilityRole="button"
              >
                <Text style={styles.deleteCancelText}>Keep event</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => void confirmDelete()}
                disabled={working}
                style={[styles.deleteConfirmButton, working && styles.deleteConfirmButtonDisabled]}
                accessibilityRole="button"
              >
                {working ? <ActivityIndicator size="small" color="#FFFFFF" /> : null}
                <Text style={styles.deleteConfirmButtonText}>
                  {working ? 'Deleting…' : 'Delete'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <Toast ref={toastRef} />
    </>
  );
}

const styles = StyleSheet.create({
  blockText: { color: PC.textBody, fontSize: FS.base, lineHeight: 19 },
  deleteConfirmRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  deleteConfirmCard: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    padding: 22,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: '#101923',
  },
  deleteConfirmIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(224,112,112,0.28)',
    backgroundColor: 'rgba(224,112,112,0.12)',
  },
  deleteConfirmTitle: {
    marginTop: 14,
    color: PC.textPrimary,
    fontSize: 17,
    fontWeight: '700',
  },
  deleteConfirmMessage: {
    marginTop: 7,
    color: PC.textMuted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  deleteConfirmActions: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    gap: 10,
    marginTop: 20,
  },
  deleteCancelButton: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: PC.border,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  deleteCancelText: { color: PC.textSecondary, fontSize: 12, fontWeight: '600' },
  deleteConfirmButton: {
    flex: 1,
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
    backgroundColor: PC.danger,
  },
  deleteConfirmButtonDisabled: { opacity: 0.6 },
  deleteConfirmButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
});