import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useHikeSafetyStore } from '../../store/hikeSafetyStore';

export default function HomeCheckPrompt() {
  const { prompt, busy, respondToPrompt, dismissPrompt } = useHikeSafetyStore();
  if (!prompt) return null;

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <Ionicons name="home-outline" size={18} color="#C9A96E" />
        </View>
        <Text style={styles.title}>Are you home?</Text>
        <Text style={styles.body} numberOfLines={2}>
          We were going to ask about “{prompt.title}”.
        </Text>

        <View style={styles.row}>
          <TouchableOpacity
            style={[styles.btn, styles.btnGhost]}
            onPress={dismissPrompt}
            disabled={busy}
          >
            <Text style={styles.btnGhostText}>Later</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, styles.btnDanger]}
            onPress={() => respondToPrompt('not_home_yet')}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="alert-circle-outline" size={13} color="#fff" />
                <Text style={styles.btnDangerText}>Not home yet</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary]}
            onPress={() => respondToPrompt('got_home')}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator size="small" color="#0E1520" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={13} color="#0E1520" />
                <Text style={styles.btnPrimaryText}>Got home</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 0, right: 0, bottom: 16,
    alignItems: 'center',
    zIndex: 900,
  },
  card: {
    width: 340,
    backgroundColor: '#141E2D',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(201,169,110,0.28)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
  },
  iconWrap: {
    width: 30, height: 30, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(201,169,110,0.1)',
    borderWidth: 1, borderColor: 'rgba(201,169,110,0.24)',
  },
  title: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', marginTop: 2 },
  body: { color: 'rgba(255,255,255,0.55)', fontSize: 11, lineHeight: 15 },
  row: { flexDirection: 'row', gap: 6, marginTop: 8 },
  btn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingVertical: 8, borderRadius: 9,
  },
  btnGhost: { backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  btnGhostText: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '600' },
  btnDanger: { backgroundColor: '#E07070' },
  btnDangerText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  btnPrimary: { backgroundColor: '#C9A96E' },
  btnPrimaryText: { color: '#0E1520', fontSize: 11, fontWeight: '700' },
});