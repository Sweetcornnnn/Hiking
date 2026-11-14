import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { Skeleton } from '../organizations/Skeleton';
import { Screen, T } from './TrailKit';

/** One loading permit stub, same footprint as EventStub (No. row, title + stamp, perforation, footer). */
export function EventStubSkeleton() {
  return (
    <View style={s.stub}>
      <View style={s.between}>
        <Skeleton width={56} height={8} />
        <Skeleton width={64} height={10} />
      </View>
      <View style={s.stubBody}>
        <View style={{ flex: 1, gap: 6 }}>
          <Skeleton width="80%" height={16} />
          <Skeleton width="55%" height={11} />
        </View>
        <Skeleton width={52} height={20} radius={3} />
      </View>
      <View style={s.perf} />
      <View style={s.between}>
        <Skeleton width={80} height={12} />
        <Skeleton width={70} height={10} />
      </View>
    </View>
  );
}

/**
 * For HikerEventsList. Render inside the FlatList's ListEmptyComponent while loading
 * (data is already [] then). `cols` is the same column count the list uses.
 */
export function EventsBoardSkeleton({ cols = 1 }: { cols?: number }) {
  const rows = [0, 1, 2];
  return (
    <View>
      <View style={s.groupHead}>
        <View style={{ flex: 1, gap: 6 }}>
          <Skeleton width={150} height={14} />
          <Skeleton width={190} height={10} />
        </View>
        <Skeleton width={52} height={38} radius={12} />
      </View>
      {rows.map((r) => (
        <View key={r} style={s.stubRow}>
          {Array.from({ length: cols }).map((_, c) => (
            <View key={c} style={{ flex: 1 }}>
              <EventStubSkeleton />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

/** Full-screen skeleton for HikerEventDetail. Wide layout matches the 300px side card. */
export function HikerEventDetailSkeleton({ onBack }: { onBack?: () => void }) {
  const { width } = useWindowDimensions();
  const wide = width >= 720;

  const main = (
    <View style={s.mainPanel}>
      <View style={s.titleRow}>
        <View style={{ flex: 1, gap: 8 }}>
          <Skeleton width="70%" height={20} />
          <Skeleton width="45%" height={12} />
        </View>
        <Skeleton width={26} height={26} radius={13} />
      </View>
      <View style={{ gap: 8 }}>
        <View style={s.pair}>
          <InfoCellSkeleton flex={1.3} />
          <InfoCellSkeleton flex={1} />
        </View>
        <InfoCellSkeleton />
      </View>
      <View style={s.pair}>
        <TileSkeleton />
        <TileSkeleton />
      </View>
    </View>
  );

  return (
    <Screen>
      <View style={s.header}>
        <Skeleton width={36} height={36} radius={18} />
        <View style={{ flex: 1, alignItems: 'center', gap: 5 }}>
          <Skeleton width={70} height={8} />
          <Skeleton width={150} height={14} />
        </View>
        <View style={{ width: 36 }} />
      </View>

      {wide ? (
        <View style={s.wideRow}>
          <View style={{ flex: 1, paddingVertical: 12 }}>{main}</View>
          <View style={s.side}>
            <View style={s.sideCard}>
              <Skeleton height={150} radius={14} />
              <View style={s.pair}>
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} height={64} radius={12} style={{ flex: 1 }} />
                ))}
              </View>
              <View style={s.avatars}>
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} width={40} height={40} radius={20} />
                ))}
              </View>
            </View>
          </View>
        </View>
      ) : (
        <>
          <View style={{ flex: 1, padding: 12 }}>{main}</View>
          <View style={s.bottomBar}>
            <Skeleton width={140} height={14} />
            <Skeleton height={44} radius={12} />
          </View>
        </>
      )}
    </Screen>
  );
}

function InfoCellSkeleton({ flex }: { flex?: number }) {
  return (
    <View style={[s.cell, flex ? { flex } : null]}>
      <Skeleton width={32} height={32} radius={16} />
      <View style={{ flex: 1, gap: 6 }}>
        <Skeleton width="40%" height={10} />
        <Skeleton width="80%" height={13} />
      </View>
    </View>
  );
}

function TileSkeleton() {
  return (
    <View style={[s.cell, { flex: 1, flexDirection: 'column', alignItems: 'flex-start', gap: 8 }]}>
      <Skeleton width={90} height={13} />
      <Skeleton height={10} />
      <Skeleton width="70%" height={10} />
    </View>
  );
}

const s = StyleSheet.create({
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  stub: {
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  stubBody: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  perf: { borderTopWidth: 1.5, borderStyle: 'dotted', borderColor: T.border },
  groupHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 10,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.border,
  },
  stubRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },

  header: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
  },
  wideRow: { flex: 1, flexDirection: 'row', gap: 12, marginHorizontal: 16 },
  side: { width: 300, paddingVertical: 12 },
  sideCard: {
    flex: 1,
    padding: 14,
    gap: 12,
    borderRadius: 18,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.border,
    overflow: 'hidden',
  },
  mainPanel: {
    gap: 10,
    padding: 14,
    borderRadius: 18,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.border,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pair: { flexDirection: 'row', gap: 8 },
  cell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T.ctrlBorder,
    backgroundColor: T.ctrl,
  },
  avatars: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  bottomBar: {
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: T.border,
  },
});