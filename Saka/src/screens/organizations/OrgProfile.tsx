import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { useRequireOrganization } from '../../hooks/useRoleGuard';
import { organizationService, type Organization } from '../../services/organizationService';
import {
  OrgLandscapeShell,
  RailButton,
  CenteredState,
  Field,
  FormInput,
  FormRow,
  Pill,
  PC,
  FS,
} from '../../components/organizations/OrgLandscapeShell';

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

  if (loading) return <CenteredState loading message="Loading profile…" />;
  if (error || !org) {
    return (
      <CenteredState
        message={error ?? 'Organization not found'}
        actionLabel="Retry"
        onAction={fetchOrg}
      />
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
    <OrgLandscapeShell
      onBack={() => router.back()}
      backLabel="Dashboard"
      icon="business-outline"
      eyebrow="Organization"
      title={org.name}
      titleLines={2}
      badge={
        org.is_verified ? (
          <Pill
            label="Verified organizer"
            icon="shield-checkmark"
            bg="rgba(63,214,157,0.12)"
            color={PC.green}
            uppercase={false}
          />
        ) : (
          <Pill
            label="Pending verification"
            icon="time-outline"
            bg="rgba(201,169,110,0.12)"
            color={PC.gold}
            uppercase={false}
          />
        )
      }
      rail={
        <Text style={styles.footnote}>
          Changes to your display name appear everywhere your events are shown. Contact an
          admin if your verification status is wrong.
        </Text>
      }
      railFooter={
        <RailButton
          icon="save-outline"
          label={dirty ? 'Save changes' : 'No changes'}
          variant="primary"
          loading={saving}
          disabled={!dirty || saving}
          onPress={handleSave}
        />
      }
    >
      <FormRow>
        <Field label="NAME">
          <FormInput
            value={name}
            onChangeText={setName}
            editable={!saving}
            placeholder="Trail Partners Co."
          />
        </Field>
        <Field label="SLUG (READ-ONLY)">
          <View style={styles.readonlyInput}>
            <Text style={styles.readonlyText} numberOfLines={1}>saka.app/org/{org.slug}</Text>
          </View>
        </Field>
      </FormRow>

      <Field label="DESCRIPTION">
        <FormInput
          value={description}
          onChangeText={setDescription}
          multiline
          editable={!saving}
          placeholder="What does your group do?"
        />
      </Field>

      <FormRow>
        <Field label="CONTACT EMAIL">
          <FormInput
            value={contactEmail}
            onChangeText={setContactEmail}
            editable={!saving}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder="hello@example.com"
          />
        </Field>
        <Field label="PHONE">
          <FormInput
            value={contactPhone}
            onChangeText={setContactPhone}
            editable={!saving}
            keyboardType="phone-pad"
            placeholder="09xx xxx xxxx"
          />
        </Field>
      </FormRow>

      <FormRow>
        <Field label="WEBSITE">
          <FormInput
            value={website}
            onChangeText={setWebsite}
            editable={!saving}
            autoCapitalize="none"
            placeholder="https://example.com"
          />
        </Field>
        <Field label="LOGO URL">
          <FormInput
            value={logoUrl}
            onChangeText={setLogoUrl}
            editable={!saving}
            autoCapitalize="none"
            placeholder="https://…/logo.png"
          />
        </Field>
      </FormRow>
    </OrgLandscapeShell>
  );
}

const styles = StyleSheet.create({
  footnote: { color: 'rgba(255,255,255,0.45)', fontSize: FS.small, lineHeight: 16 },
  readonlyInput: {
    minHeight: 42,
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: PC.radiusControl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 12,
  },
  readonlyText: { color: 'rgba(255,255,255,0.45)', fontSize: FS.base },
});