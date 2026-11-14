import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Skeleton } from '../organizations/Skeleton';

const CARD = '#101925';
const BORDER = 'rgba(255,255,255,0.07)';

/**
 * Drop-in for the "Loading users…" / "Loading organizations…" text blocks in Admin.
 * Use anywhere a tab shows a list: <AdminListSkeleton rows={6} />.
 */
export function AdminListSkeleton({ rows = 6, avatar = true, marginTop = 14 }: { rows?: number; avatar?: boolean; marginTop?: number }) {
  return (
    <View style={[s.list, { marginTop }]}>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={s.row}>
          {avatar ? <Skeleton width={34} height={34} radius={17} /> : null}
          <View style={{ flex: 1, gap: 6 }}>
            <Skeleton width="45%" height={12} />
            <Skeleton width="70%" height={10} />
          </View>
          <Skeleton width={56} height={18} radius={6} />
        </View>
      ))}
    </View>
  );
}

/** For the Overview tab ("Loading overview…"): a grid of stat tiles. */
export function AdminStatsSkeleton({ tiles = 6 }: { tiles?: number }) {
  return (
    <View style={s.grid}>
      {Array.from({ length: tiles }).map((_, i) => (
        <View key={i} style={s.tile}>
          <Skeleton width="50%" height={9} />
          <Skeleton width="35%" height={20} radius={5} />
        </View>
      ))}
    </View>
  );
}

/** Replaces the hourglass + "Loading manager dashboard…" screen in Manager.tsx. */
export function ManagerSkeleton() {
  return (
    <View style={s.screen}>
      <View style={s.header}>
        <View style={{ gap: 6 }}>
          <Skeleton width={140} height={16} />
          <Skeleton width={90} height={10} />
        </View>
        <Skeleton width={60} height={28} radius={14} />
      </View>
      <View style={s.tabs}>
        {[70, 60, 80, 64].map((w, i) => (
          <Skeleton key={i} width={w} height={28} radius={14} />
        ))}
      </View>
      <View style={{ flex: 1, paddingHorizontal: 16 }}>
        <AdminListSkeleton rows={5} avatar={false} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  list: { gap: 8, marginTop: 14, paddingHorizontal: 14 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
    paddingHorizontal: 14,
  },
  tile: {
    flexGrow: 1,
    flexBasis: '30%',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
  },
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
});