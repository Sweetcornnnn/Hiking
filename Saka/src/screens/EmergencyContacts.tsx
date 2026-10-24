import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import EmergencyContactFeature from '../components/emergency/EmergencyContactFeature';

export default function EmergencyContactsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const horizontalInset = Math.max(insets.left, insets.right);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={[styles.content, { paddingHorizontal: 18 + horizontalInset }]}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={18} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.heading}>
            <Text style={styles.title}>Emergency contacts</Text>
            <Text style={styles.subtitle}>Choose who you would contact for help.</Text>
          </View>
        </View>

        <View style={styles.notice}>
          <Ionicons name="information-circle-outline" size={15} color="#C9A96E" />
          <Text style={styles.noticeText}>
            Contacts are saved to your account. Admins can view them to assist in an emergency.
          </Text>
        </View>

        <View style={styles.form}>
          <EmergencyContactFeature visible />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0E1520',
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 14,
  },
  backButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  heading: {
    flex: 1,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    marginTop: 3,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 11,
    marginBottom: 12,
    borderRadius: 9,
    backgroundColor: 'rgba(201,169,110,0.07)',
  },
  noticeText: {
    flex: 1,
    color: 'rgba(255,255,255,0.65)',
    fontSize: 10,
    lineHeight: 15,
  },
  form: {
    flex: 1,
    minHeight: 0,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
});
