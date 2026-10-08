import React, { useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { organizationService } from '../../services/organizationService';
import { useRequireAuth } from '../../hooks/useRoleGuard';
import {
  OrgLandscapeShell,
  RailButton,
  Banner,
  Field,
  FormInput,
  FormRow,
  FS,
} from '../../components/organizations/OrgLandscapeShell';

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
    <OrgLandscapeShell
      onBack={() => router.back()}
      backLabel="Back"
      eyebrow="Become an organizer"
      title="Create your organization"
      titleLines={2}
      subtitle="Organize hikes, manage attendees, and reach hikers on Saka. You'll be able to create events right away — publishing goes live after an admin verifies your organization."
      railFooter={
        <>
          <RailButton
            icon="checkmark-circle-outline"
            label="Create organization"
            variant="primary"
            loading={submitting}
            disabled={!canSubmit}
            onPress={handleSubmit}
          />
          <Text style={styles.footnote}>
            You can update these details any time from your dashboard.
          </Text>
        </>
      }
    >
      {error && <Banner tone="error">{error}</Banner>}

      <FormRow>
        <Field label="ORGANIZATION NAME">
          <FormInput
            value={name}
            onChangeText={setName}
            placeholder="Trail Partners Co."
            editable={!submitting}
          />
        </Field>
        <Field label="SLUG (URL HANDLE)" hint={`saka.app/org/${effectiveSlug || '…'}`}>
          <FormInput
            value={effectiveSlug}
            onChangeText={(v) => {
              setSlugTouched(true);
              setSlug(organizationService.slugify(v));
            }}
            placeholder="trail-partners"
            autoCapitalize="none"
            editable={!submitting}
          />
        </Field>
      </FormRow>

      <Field label="SHORT DESCRIPTION">
        <FormInput
          value={description}
          onChangeText={setDescription}
          placeholder="Weekend ridge hikes around Batangas and the Cordillera."
          multiline
          editable={!submitting}
        />
      </Field>

      <FormRow>
        <Field label="CONTACT EMAIL">
          <FormInput
            value={email}
            onChangeText={setEmail}
            placeholder="hello@trailpartners.com"
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!submitting}
          />
        </Field>
        <Field label="PHONE">
          <FormInput
            value={phone}
            onChangeText={setPhone}
            placeholder="09xx xxx xxxx"
            keyboardType="phone-pad"
            editable={!submitting}
          />
        </Field>
      </FormRow>

      <Field label="WEBSITE (OPTIONAL)">
        <FormInput
          value={website}
          onChangeText={setWebsite}
          placeholder="https://trailpartners.com"
          autoCapitalize="none"
          editable={!submitting}
        />
      </Field>
    </OrgLandscapeShell>
  );
}

const styles = StyleSheet.create({
  footnote: { color: 'rgba(255,255,255,0.4)', fontSize: FS.micro + 1, textAlign: 'center', lineHeight: 15 },
});