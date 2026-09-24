import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { useRequireOrganization } from '../../hooks/useRoleGuard';
import { organizationService, type Organization } from '../../services/organizationService';

export default function OrgProfile() {
  useRequireOrganization();
  const router = useRouter();
  const { loadProfile } = useAuthStore();

  const [org, setOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [logoUrl, setLogoUrl] = useState('');

  const fetchOrg = useCallback(async () => {
    setError(null);
    try {
      const organization = await organizationService.getMyOrganization();
      if (!organization) {
        router.replace('/organizations/BecomeOrganizer');
        return;
      }
      setOrg(organization);
      setName(organization.name);
      setDescription(organization.description ?? '');
      setContactEmail(organization.contact_email ?? '');
      setContactPhone(organization.contact_phone ?? '');
      setWebsite(organization.website ?? '');
      setLogoUrl(organization.logo_url ?? '');
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load organization');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchOrg();
  }, [fetchOrg]);

  const handleSave = async () => {
    if (!org) return;
    if (name.trim().length < 2) {
      Alert.alert('Invalid name', 'Organization name must be at least 2 characters.');
      return;
    }

    setSaving(true);
    const { error: e } = await organizationService.updateOrganization(org.id, {
      name: name.trim(),
      description: description.trim() || undefined,
      contact_email: contactEmail.trim() || undefined,
      contact_phone: contactPhone.trim() || undefined,
      website: website.trim() || undefined,
      logo_url: logoUrl.trim() || undefined,
    });
    setSaving(false);

    if (e) {
      Alert.alert('Save failed', e);
      return;
    }

    // refresh local cache + auth store profile so dashboard reflects changes
    await fetchOrg();
    await loadProfile();
    Alert.alert('Saved', 'Your organization profile has been updated.');
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#C9A96E" />
        <Text style={styles.centeredText}>Loading profile…</Text>
      </View>
    );
  }

  if (error || !org) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={36} color="#E07070" />
        <Text style={styles.centeredText}>{error ?? 'Organization not found'}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={fetchOrg}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const dirty =
    name !== org.name ||
    description !== (org.description ?? '') ||
    contactEmail !== (org.contact_email ?? '') ||
    contactPhone !== (org.contact_phone ?? '') ||
    website !== (org.website ?? '') ||
    logoUrl !== (org.logo_url ?? '');

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
        <Ionicons name="chevron-back" size={18} color="#C9A96E" />
        <Text style={styles.backText}>Dashboard</Text>
      </TouchableOpacity>

      <View style={styles.headerRow}>
        <View style={styles.logoBox}>
          <Ionicons name="business-outline" size={22} color="#C9A96E" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>Organization</Text>
          <Text style={styles.title} numberOfLines={1}>
            {org.name}
          </Text>
          <View style={styles.statusRow}>
            {org.is_verified ? (
              <>
                <Ionicons name="shield-checkmark" size={12} color="#3FD69D" />
                <Text style={styles.verifiedText}>Verified organizer</Text>
              </>
            ) : (
              <>
                <Ionicons name="time-outline" size={12} color="#C9A96E" />
                <Text style={styles.pendingText}>Pending verification</Text>
              </>
            )}
          </View>
        </View>
      </View>

      <FieldGroup label="NAME">
        <TextInput
          value={name}
          onChangeText={setName}
          style={styles.input}
          editable={!saving}
          placeholder="Trail Partners Co."
          placeholderTextColor="rgba(255,255,255,0.2)"
        />
      </FieldGroup>

      <FieldGroup label="SLUG (READ-ONLY)">
        <View style={styles.readonlyInput}>
          <Text style={styles.readonlyText}>saka.app/org/{org.slug}</Text>
        </View>
      </FieldGroup>

      <FieldGroup label="DESCRIPTION">
        <TextInput
          value={description}
          onChangeText={setDescription}
          style={[styles.input, styles.textarea]}
          multiline
          editable={!saving}
          placeholder="What does your group do?"
          placeholderTextColor="rgba(255,255,255,0.2)"
        />
      </FieldGroup>

      <View style={styles.row}>
        <View style={styles.rowItem}>
          <FieldGroup label="CONTACT EMAIL">
            <TextInput
              value={contactEmail}
              onChangeText={setContactEmail}
              style={styles.input}
              editable={!saving}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="hello@example.com"
              placeholderTextColor="rgba(255,255,255,0.2)"
            />
          </FieldGroup>
        </View>
        <View style={styles.rowItem}>
          <FieldGroup label="PHONE">
            <TextInput
              value={contactPhone}
              onChangeText={setContactPhone}
              style={styles.input}
              editable={!saving}
              keyboardType="phone-pad"
              placeholder="09xx xxx xxxx"
              placeholderTextColor="rgba(255,255,255,0.2)"
            />
          </FieldGroup>
        </View>
      </View>

      <FieldGroup label="WEBSITE">
        <TextInput
          value={website}
          onChangeText={setWebsite}
          style={styles.input}
          editable={!saving}
          autoCapitalize="none"
          placeholder="https://example.com"
          placeholderTextColor="rgba(255,255,255,0.2)"
        />
      </FieldGroup>

      <FieldGroup label="LOGO URL">
        <TextInput
          value={logoUrl}
          onChangeText={setLogoUrl}
          style={styles.input}
          editable={!saving}
          autoCapitalize="none"
          placeholder="https://…/logo.png"
          placeholderTextColor="rgba(255,255,255,0.2)"
        />
      </FieldGroup>

      <TouchableOpacity
        style={[styles.primaryButton, (!dirty || saving) && styles.btnDisabled]}
        onPress={handleSave}
        disabled={!dirty || saving}
        activeOpacity={0.85}
      >
        {saving ? (
          <ActivityIndicator color="#0E1520" />
        ) : (
          <>
            <Ionicons name="save-outline" size={16} color="#0E1520" />
            <Text style={styles.primaryButtonText}>
              {dirty ? 'Save changes' : 'No changes'}
            </Text>
          </>
        )}
      </TouchableOpacity>

      <Text style={styles.footnote}>
        Changes to your display name appear everywhere your events are shown. Contact an admin if
        your verification status is wrong.
      </Text>
    </ScrollView>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0A121A' },
  container: { padding: 22, paddingTop: 26, paddingBottom: 80, gap: 14 },
  centered: { flex: 1, backgroundColor: '#0A121A', justifyContent: 'center', alignItems: 'center', gap: 12 },
  centeredText: { color: 'rgba(255,255,255,0.6)', fontSize: 13 },
  retryBtn: { marginTop: 8, paddingHorizontal: 18, paddingVertical: 10, backgroundColor: '#C9A96E', borderRadius: 10 },
  retryText: { color: '#0E1520', fontWeight: '700' },

  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingVertical: 4 },
  backText: { color: '#C9A96E', fontWeight: '600', fontSize: 12 },

  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4, marginBottom: 4 },
  logoBox: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: 'rgba(201,169,110,0.12)',
    borderWidth: 1, borderColor: 'rgba(201,169,110,0.28)',
    justifyContent: 'center', alignItems: 'center',
  },
  eyebrow: { color: '#C9A96E', fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
  title: { color: '#FFF', fontSize: 20, fontWeight: '800', marginTop: 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  verifiedText: { color: '#3FD69D', fontSize: 11, fontWeight: '600' },
  pendingText: { color: '#C9A96E', fontSize: 11, fontWeight: '600' },

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
  textarea: { minHeight: 90, textAlignVertical: 'top' },
  readonlyInput: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  readonlyText: { color: 'rgba(255,255,255,0.4)', fontSize: 13 },

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
    marginTop: 8,
  },
  primaryButtonText: { color: '#0E1520', fontWeight: '800', fontSize: 13 },
  btnDisabled: { opacity: 0.4 },

  footnote: { color: 'rgba(255,255,255,0.35)', fontSize: 11, textAlign: 'center', marginTop: 6, lineHeight: 16 },
});