import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Skeleton } from './Skeleton';
import {
  OrgLandscapeShell,
  Card,
  Grid,
  Block,
  Field,
  FormRow,
  PC,
  SP,
} from './OrgLandscapeShell';

/* Building blocks. Dimensions mirror the real components in OrgLandscapeShell so nothing shifts on load. */

function StatCardSkeleton() {
  return (
    <View style={styles.stat}>
      <Skeleton width="55%" height={8} />
      <Skeleton width="40%" height={16} radius={5} />
    </View>
  );
}

function InfoRowSkeleton() {
  return (
    <View style={styles.info}>
      <Skeleton width={22} height={22} radius={7} />
      <View style={styles.flex}>
        <Skeleton width="35%" height={8} />
        <Skeleton width="75%" height={11} style={{ marginTop: 5 }} />
      </View>
    </View>
  );
}

function EventCardSkeleton() {
  return (
    <Card style={styles.eventCard}>
      <View style={styles.spaceBetween}>
        <Skeleton width="60%" height={12} />
        <Skeleton width={36} height={18} radius={6} />
      </View>
      <Skeleton width="75%" height={10} />
      <Skeleton width="55%" height={10} />
    </Card>
  );
}

const RailButtonSkeleton = () => <Skeleton height={34} radius={PC.radiusBtn} />;
const FieldSkeleton = ({ label, tall }: { label: string; tall?: boolean }) => (
  <Field label={label}>
    <Skeleton height={tall ? 58 : 32} radius={PC.radiusControl} />
  </Field>
);

type BackProps = { onBack?: () => void };

/* Screens */

export function DashboardSkeleton() {
  return (
    <OrgLandscapeShell
      eyebrow="Organizer dashboard"
      title="Dashboard"
      rail={
        <Grid columns={3} gap={6}>
          {[0, 1, 2].map((i) => (
            <StatCardSkeleton key={i} />
          ))}
        </Grid>
      }
      railFooter={
        <>
          <View style={styles.utilityRow}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} width={28} height={28} radius={9} />
            ))}
          </View>
          <RailButtonSkeleton />
          <RailButtonSkeleton />
        </>
      }
    >
      <View style={styles.spaceBetween}>
        <Skeleton width={80} height={13} />
        <Skeleton width={50} height={10} />
      </View>
      <Grid>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <EventCardSkeleton key={i} />
        ))}
      </Grid>
    </OrgLandscapeShell>
  );
}

export function EventsListSkeleton({ onBack }: BackProps) {
  return (
    <OrgLandscapeShell
      onBack={onBack}
      backLabel="Dashboard"
      eyebrow="Your events"
      title="Events"
      rail={
        <View style={{ gap: 4 }}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} height={30} radius={8} />
          ))}
        </View>
      }
      railFooter={<RailButtonSkeleton />}
    >
      <Card padded={false} style={styles.table}>
        {[0, 1, 2, 3, 4, 5, 6].map((i, _, a) => (
          <View key={i} style={[styles.row, i === a.length - 1 && { borderBottomWidth: 0 }]}>
            <View style={styles.flex}>
              <Skeleton width="50%" height={12} />
              <Skeleton width="78%" height={10} style={{ marginTop: 5 }} />
            </View>
            <Skeleton width={96} height={12} />
            <Skeleton width={78} height={18} radius={6} />
            <Skeleton width={12} height={12} radius={6} />
          </View>
        ))}
      </Card>
    </OrgLandscapeShell>
  );
}

export function EventDetailSkeleton({ onBack }: BackProps) {
  return (
    <OrgLandscapeShell
      onBack={onBack}
      backLabel="Events"
      title="Event"
      badge={<Skeleton width={64} height={18} radius={6} />}
      rail={
        <Grid>
          <StatCardSkeleton />
          <StatCardSkeleton />
        </Grid>
      }
      railFooter={
        <>
          <RailButtonSkeleton />
          <RailButtonSkeleton />
          <RailButtonSkeleton />
        </>
      }
    >
      <Grid>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <InfoRowSkeleton key={i} />
        ))}
      </Grid>
      <Block label="DESCRIPTION">
        <Skeleton height={11} />
        <Skeleton height={11} />
        <Skeleton width="60%" height={11} />
      </Block>
    </OrgLandscapeShell>
  );
}

export function AttendeesSkeleton({ onBack }: BackProps) {
  return (
    <OrgLandscapeShell
      onBack={onBack}
      backLabel="Event"
      eyebrow="Attendees"
      title="Attendees"
      titleLines={2}
      rail={
        <>
          <Grid>
            {[0, 1, 2, 3].map((i) => (
              <StatCardSkeleton key={i} />
            ))}
          </Grid>
          <View style={styles.chipsWrap}>
            {[34, 68, 58, 70].map((w, i) => (
              <Skeleton key={i} width={w} height={24} radius={8} />
            ))}
          </View>
        </>
      }
    >
      <Card padded={false} style={styles.table}>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i, _, a) => (
          <View key={i} style={[styles.row, i === a.length - 1 && { borderBottomWidth: 0 }]}>
            <Skeleton width={28} height={28} radius={14} />
            <View style={[styles.flex, { minWidth: 120 }]}>
              <Skeleton width="42%" height={12} />
              <Skeleton width="62%" height={10} style={{ marginTop: 4 }} />
            </View>
            <Skeleton width={30} height={18} radius={6} />
            <Skeleton width={64} height={18} radius={6} />
            <Skeleton width={150} height={26} radius={8} />
          </View>
        ))}
      </Card>
    </OrgLandscapeShell>
  );
}

export function ProfileSkeleton({ onBack }: BackProps) {
  return (
    <OrgLandscapeShell
      onBack={onBack}
      backLabel="Dashboard"
      eyebrow="Organization"
      title="Profile"
      badge={<Skeleton width={110} height={18} radius={6} />}
      rail={
        <View style={{ gap: 5 }}>
          <Skeleton height={9} />
          <Skeleton height={9} />
          <Skeleton width="55%" height={9} />
        </View>
      }
      railFooter={<RailButtonSkeleton />}
    >
      <FormRow>
        <FieldSkeleton label="NAME" />
        <FieldSkeleton label="SLUG (READ-ONLY)" />
      </FormRow>
      <FieldSkeleton label="DESCRIPTION" tall />
      <FormRow>
        <FieldSkeleton label="CONTACT EMAIL" />
        <FieldSkeleton label="PHONE" />
      </FormRow>
      <FormRow>
        <FieldSkeleton label="WEBSITE" />
        <FieldSkeleton label="LOGO URL" />
      </FormRow>
    </OrgLandscapeShell>
  );
}

/** For OrgCreateEvent's initial org lookup. The real form layout wasn't checked, so this is a generic form. */
export function CreateEventSkeleton({ onBack }: BackProps) {
  return (
    <OrgLandscapeShell
      onBack={onBack}
      backLabel="Back"
      eyebrow="New event"
      title="Create a hiking event"
      titleLines={2}
      rail={
        <View style={{ gap: 5 }}>
          <Skeleton height={9} />
          <Skeleton width="70%" height={9} />
        </View>
      }
      railFooter={<RailButtonSkeleton />}
    >
      <FieldSkeleton label="TITLE" />
      <FormRow>
        <FieldSkeleton label="MOUNTAIN" />
        <FieldSkeleton label="DATE" />
      </FormRow>
      <FormRow>
        <FieldSkeleton label="START TIME" />
        <FieldSkeleton label="CAPACITY" />
      </FormRow>
      <FieldSkeleton label="DESCRIPTION" tall />
    </OrgLandscapeShell>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  spaceBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SP.sm },
  stat: {
    backgroundColor: PC.bgPanel,
    borderRadius: PC.radiusControl,
    borderWidth: 1,
    borderColor: PC.borderSoft,
    paddingVertical: 7,
    paddingHorizontal: 9,
    gap: 6,
  },
  info: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: PC.bgPanel,
    borderRadius: PC.radiusControl,
    borderWidth: 1,
    borderColor: PC.borderSoft,
    paddingVertical: 7,
    paddingHorizontal: SP.md,
  },
  eventCard: { gap: 7 },
  utilityRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  table: { overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: SP.md,
    minHeight: 42,
    paddingHorizontal: SP.md,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
});