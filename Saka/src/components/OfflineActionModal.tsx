import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FULLSCREEN_MODAL_PROPS, ModalScrim } from './ModalScrim';

interface OfflineActionModalProps {
  visible: boolean;
  message: string;
  retrying?: boolean;
  onRetry: () => void;
  onDismiss: () => void;
}

export default function OfflineActionModal({
  visible,
  message,
  retrying = false,
  onRetry,
  onDismiss,
}: OfflineActionModalProps) {
  return (
    <Modal
      {...FULLSCREEN_MODAL_PROPS}
      visible={visible}
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.root}>
        <ModalScrim />
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
        <View style={styles.card}>
          <View style={styles.icon}>
            <Ionicons name="cloud-offline-outline" size={24} color="#C9A96E" />
          </View>
          <Text style={styles.title} accessibilityRole="header">You’re offline</Text>
          <Text style={styles.message}>{message}</Text>
          <Pressable
            onPress={onRetry}
            disabled={retrying}
            style={[styles.retryButton, retrying && styles.disabledButton]}
            accessibilityRole="button"
          >
            {retrying ? (
              <ActivityIndicator size="small" color="#101923" />
            ) : (
              <Text style={styles.retryText}>Try again</Text>
            )}
          </Pressable>
          <Pressable
            onPress={onDismiss}
            disabled={retrying}
            style={styles.dismissButton}
            accessibilityRole="button"
          >
            <Text style={styles.dismissText}>Not now</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    padding: 24,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: '#0E1520',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.5,
    shadowRadius: 28,
    elevation: 24,
  },
  icon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    backgroundColor: 'rgba(201,169,110,0.1)',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '800',
    textAlign: 'center',
  },
  message: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 9,
    marginBottom: 20,
  },
  retryButton: {
    minHeight: 46,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#C9A96E',
  },
  disabledButton: {
    opacity: 0.7,
  },
  retryText: {
    color: '#101923',
    fontSize: 14,
    fontWeight: '800',
  },
  dismissButton: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    marginTop: 4,
  },
  dismissText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    fontWeight: '600',
  },
});
