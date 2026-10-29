import React, { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { BG_PANEL, BORDER_DEFAULT } from '../../theme/designTokens';

/**
 * Two tiles sharing one card, split by a line down the middle.
 * Each half stays its own tile (give it the `bare` prop so it drops its own border).
 */
export default function MergedTile({ left, right }: { left: ReactNode; right: ReactNode }) {
  return (
    <View style={styles.card}>
      <View style={styles.half}>{left}</View>
      <View style={styles.divider} />
      <View style={styles.half}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    flexDirection: 'row',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER_DEFAULT,
    backgroundColor: BG_PANEL,
    overflow: 'hidden',
  },
  half: {
    flex: 1,
    minWidth: 0,
  },
  divider: {
    width: 1,
    marginVertical: 14,
    backgroundColor: BORDER_DEFAULT,
  },
});