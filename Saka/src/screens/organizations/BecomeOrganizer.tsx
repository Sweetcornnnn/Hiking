import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { organizationService } from '../../services/organizationService';
import { useRequireAuth } from '../../hooks/useRoleGuard';

export default function BecomeOrganizer() {
  useRequireAuth();
  const router = useRouter();
  const { profile, loadProfile } = useAuthStore();

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [email, setEmail] = useState(profile?.email ?? '');
  const [phone, setPhone] = useState(profile?.contact_number ?? '');
  const [website, setWebsite] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveSlug = slugTouched ? slug : organizationService.slugify(name);
  const canSubmit =
    name.trim().length >= 2 && effectiveSlug.length >= 2 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);

    const { error: createError } = await organizationService.createOrganization({
      name: name.trim(),
      slug: effectiveSlug,
      description: description.trim() || undefined,
      contact_email: email.trim() || undefined,
      contact_phone: phone.trim() || undefined,
      website: website.trim() || undefined,
    });

    if (createError) {
      setError(createError);
      setSubmitting(false);
      return;
    }

    await loadProfile();
    setSubmitting(false);
    router.replace('/organizations/Dashboard');
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => router.back()}
        activeOpacity={0.7}
      >
        <Ionicons name="chevron-back" size={18} color="#C9A96E" />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      <Text style={styles.eyebrow}>Become an organizer</Text>
      <Text style={styles.title}>Create your organization</Text>
      <Text style={styles.subtitle}>
        Organize hikes, manage attendees, and reach hikers on Saka. You'll be able to
        create events right away — publishing goes live after an admin verifies your
        organization.
      </Text>

      {error && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={16} color="#E07070" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>ORGANIZATION NAME</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Trail Partners Co."
          placeholderTextColor="rgba(255,255,255,0.2)"
          style={styles.input}
          editable={!submitting}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>SLUG (URL HANDLE)</Text>
        <TextInput
          value={effectiveSlug}
          onChangeText={(v) => {
            setSlugTouched(true);
            setSlug(organizationService.slugify(v));
          }}
          placeholder="trail-partners"
          placeholderTextColor="rgba(255,255,255,0.2)"
          autoCapitalize="none"
          style={styles.input}
          editable={!submitting}
        />
        <Text style={styles.hint}>saka.app/org/{effectiveSlug || '…'}</Text>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>SHORT DESCRIPTION</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Weekend ridge hikes around Batangas and the Cordillera."
          placeholderTextColor="rgba(255,255,255,0.2)"
          style={[styles.input, styles.textarea]}
          multiline
          editable={!submitting}
        />
      </View>

      <View style={styles.row}>
        <View style={[styles.fieldGroup, styles.rowItem]}>
          <Text style={styles.label}>CONTACT EMAIL</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="hello@trailpartners.com"
            placeholderTextColor="rgba(255,255,255,0.2)"
            keyboardType="email-address"
            autoCapitalize="none"
            style={styles.input}
            editable={!submitting}
          />
        </View>
        <View style={[styles.fieldGroup, styles.rowItem]}>
          <Text style={styles.label}>PHONE</Text>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="09xx xxx xxxx"
            placeholderTextColor="rgba(255,255,255,0.2)"
            keyboardType="phone-pad"
            style={styles.input}
            editable={!submitting}
          />
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>WEBSITE (OPTIONAL)</Text>
        <TextInput
          value={website}
          onChangeText={setWebsite}
          placeholder="https://trailpartners.com"
          placeholderTextColor="rgba(255,255,255,0.2)"
          autoCapitalize="none"
          style={styles.input}
          editable={!submitting}
        />
      </View>

      <TouchableOpacity
        style={[styles.primaryButton, !canSubmit && styles.primaryButtonDisabled]}
        onPress={handleSubmit}
        disabled={!canSubmit}
        activeOpacity={0.85}
      >
        {submitting ? (
          <ActivityIndicator color="#0E1520" />
        ) : (
          <>
            <Ionicons name="checkmark-circle-outline" size={18} color="#0E1520" />
            <Text style={styles.primaryButtonText}>Create organization</Text>
          </>
        )}
      </TouchableOpacity>

      <Text style={styles.footnote}>
        You can update these details any time from your dashboard.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0A121A' },
  container: { padding: 24, paddingTop: 32, paddingBottom: 60, gap: 14 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingVertical: 6 },
  backText: { color: '#C9A96E', fontWeight: '600', fontSize: 12 },
  eyebrow: {
    color: '#C9A96E',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 8,
  },
  title: { color: '#FFF', fontSize: 28, fontWeight: '800', marginTop: 2 },
  subtitle: { color: '#9FB0C0', fontSize: 13, lineHeight: 19, marginBottom: 8 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(224,112,112,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(224,112,112,0.25)',
    padding: 12,
    borderRadius: 10,
  },
  errorText: { color: '#E07070', fontSize: 12, flex: 1 },
  fieldGroup: { gap: 6 },
  label: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  input: {
    backgroundColor: '#111C27',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#FFF',
    fontSize: 13,
  },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  hint: { color: 'rgba(255,255,255,0.3)', fontSize: 10, marginTop: 2 },
  row: { flexDirection: 'row', gap: 12 },
  rowItem: { flex: 1 },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#C9A96E',
    borderRadius: 12,
    paddingVertical: 15,
    marginTop: 12,
  },
  primaryButtonDisabled: { opacity: 0.45 },
  primaryButtonText: { color: '#0E1520', fontWeight: '800', fontSize: 13 },
  footnote: { color: 'rgba(255,255,255,0.3)', fontSize: 11, textAlign: 'center', marginTop: 6 },
});