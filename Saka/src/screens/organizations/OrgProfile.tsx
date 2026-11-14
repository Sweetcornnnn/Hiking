import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
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
import { ProfileSkeleton } from '../../components/organizations/OrgSkeletons';
import Toast, { type ToastHandle } from '../../components/Toast';

export default function OrgProfile() {
  useRequireOrganization();
  const router = useRouter();
  const { loadProfile } = useAuthStore();

  const [org, setOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toastRef = useRef<ToastHandle>(null);

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
      console.error('[OrgProfile] Failed to load organization:', e);
      setError('Unable to load your organization profile. Please try again.');
      toastRef.current?.show({
        type: 'error',
        title: 'Organization profile failed to load',
        message: e?.message ?? 'Please try again.',
      });
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
      toastRef.current?.show({
        type: 'warning',
        title: 'Invalid name',
        message: 'Organization name must be at least 2 characters.',
      });
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
      toastRef.current?.show({ type: 'error', title: 'Save failed', message: e });
      return;
    }

    // refresh local cache + auth store profile so dashboard reflects changes
    await fetchOrg();
    await loadProfile();
    toastRef.current?.show({
      type: 'success',
      title: 'Saved',
      message: 'Your organization profile has been updated.',
    });
  };

  if (loading) {
    return (
      <>
        <ProfileSkeleton onBack={() => router.back()} />
        <Toast ref={toastRef} />
      </>
    );
  }
  if (error || !org) {
    return (
      <>
        <CenteredState
          message={error ?? 'Organization not found'}
          actionLabel="Retry"
          onAction={fetchOrg}
        />
        <Toast ref={toastRef} />
      </>
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
    <>
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
      <Toast ref={toastRef} />
    </>
  );
}

const styles = StyleSheet.create({
  footnote: { color: PC.textMuted, fontSize: FS.small, lineHeight: 14 },
  readonlyInput: {
    minHeight: 32,
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: PC.radiusControl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 12,
  },
  readonlyText: { color: PC.textMuted, fontSize: FS.body },
});