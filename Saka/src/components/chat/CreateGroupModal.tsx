// components/chat/CreateGroupModal.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FULLSCREEN_MODAL_PROPS, ModalScrim } from '../ModalScrim';
import {
  ACCENT_GOLD,
  TEXT_PRIMARY,
  TEXT_MUTED,
  CHAT_BG,
  CHAT_PANEL,
  CHAT_BORDER,
  CHAT_RADIUS_BTN,
  CHAT_RADIUS_MODAL,
} from '../../theme/designTokens';
import UserSearch from './UserSearch';
import SelectedMembers from './SelectedMembers';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { useRouter } from 'expo-router';

const NAME_MAX = 50;

export default function CreateGroupModal({
  onClose,
}: {
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [members, setMembers] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // UI-only: highlights the name field while it is focused
  const [nameFocused, setNameFocused] = useState(false);
  const user = useAuthStore((state) => state.user);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();

  const addMember = (member: any) => {
    // Never add yourself — you're automatically the admin of the group.
    if (!user || member.id === user.id) return;
    if (!members.find((existingMember) => existingMember.id === member.id)) {
      setMembers((currentMembers) => [...currentMembers, member]);
    }
  };

  const removeMember = (id: string) =>
    setMembers((currentMembers) => currentMembers.filter((m) => m.id !== id));

  const createGroup = async () => {
    if (creating) return;

    if (!user) {
      setError('You must be signed in.');
      return;
    }
    if (!name.trim()) {
      setError('Please enter a group name.');
      return;
    }
    if (members.length === 0) {
      setError('Add at least one member.');
      return;
    }

    setCreating(true);
    setError(null);

    // ── 1. Insert the group ──
    let group: { id: number | string } | null = null;
    try {
      const { data, error: groupError } = await supabase
        .from('groups')
        .insert({ name: name.trim(), creator_id: user.id })
        .select()
        .single();

      if (groupError) {
        console.error('[CreateGroup] groups insert failed:', groupError);
        setError(`groups insert: ${groupError.message}`);
        setCreating(false);
        return;
      }
      group = data;
    } catch (e: any) {
      console.error('[CreateGroup] groups insert threw:', e);
      setError(`groups insert: ${e?.message || 'unknown error'}`);
      setCreating(false);
      return;
    }

    if (!group) {
      setError('groups insert: no row returned');
      setCreating(false);
      return;
    }

    // ── 2a. Insert myself as admin first ──
    try {
      const { error: selfError } = await supabase
        .from('group_members')
        .insert({ group_id: group.id, user_id: user.id, role: 'admin' });

      if (selfError) {
        console.error('[CreateGroup] self membership insert failed:', selfError);
        setError(`group_members (self): ${selfError.message}`);
        setCreating(false);
        return;
      }
    } catch (e: any) {
      console.error('[CreateGroup] self membership threw:', e);
      setError(`group_members (self): ${e?.message || 'unknown error'}`);
      setCreating(false);
      return;
    }

    // ── 2b. Insert invited members (excluding myself) ──
    const invitees = members.filter((m) => m.id !== user.id);

    if (invitees.length > 0) {
      try {
        const memberRows = invitees.map((member) => ({
          group_id: group.id,
          user_id: member.id,
          role: 'member',
        }));

        const { error: memberError } = await supabase
          .from('group_members')
          .insert(memberRows);

        if (memberError) {
          console.error('[CreateGroup] invited members insert failed:', memberError);
          setError(`group_members (invitees): ${memberError.message}`);
          setCreating(false);
          return;
        }
      } catch (e: any) {
        console.error('[CreateGroup] invited members threw:', e);
        setError(`group_members (invitees): ${e?.message || 'unknown error'}`);
        setCreating(false);
        return;
      }
    }

    // ── 3. Seed read receipts ──
    try {
      const receiptRows = [
        {
          group_id: group.id,
          user_id: user.id,
          last_read_at: new Date().toISOString(),
        },
        ...invitees.map((member) => ({
          group_id: group.id,
          user_id: member.id,
          last_read_at: '1970-01-01T00:00:00Z',
        })),
      ];

      const { error: receiptError } = await supabase
        .from('group_read_receipts')
        .upsert(receiptRows, { onConflict: 'group_id,user_id' });

      if (receiptError) {
        console.error('[CreateGroup] receipts upsert failed:', receiptError);
        setError(`receipts upsert: ${receiptError.message}`);
        setCreating(false);
        return;
      }
    } catch (e: any) {
      console.error('[CreateGroup] receipts upsert threw:', e);
      setError(`receipts upsert: ${e?.message || 'unknown error'}`);
      setCreating(false);
      return;
    }

    // ── Done ──
    setCreating(false);
    onClose();
    router.push({
      pathname: '/chat/GroupChat',
      params: { groupId: String(group.id) },
    } as any);
  };

  const canCreate =
    name.trim().length > 0 && members.length > 0 && !creating && !!user;

  // ───────── UI-only helpers (no business logic) ─────────
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();

  const memberCountLabel =
    members.length === 0
      ? null
      : `${members.length} ${members.length === 1 ? 'person' : 'people'} added`;

  // Tells the person exactly what is still missing before they can create
  const nextStepHint = creating
    ? null
    : !name.trim()
      ? 'Give your group a name to continue'
      : members.length === 0
        ? 'Add at least one person to continue'
        : null;

  const listHeader = (
    <View style={styles.bodyContent}>
      {/* Group name, with a live preview avatar beside it */}
      <View style={styles.nameRow}>
        <View style={[styles.avatar, initials ? styles.avatarActive : null]}>
          {initials ? (
            <Text style={styles.avatarText}>{initials}</Text>
          ) : (
            <Ionicons name="people" size={20} color={TEXT_MUTED} />
          )}
        </View>

        <View style={styles.nameCol}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>Group name</Text>
            <Text
              style={[
                styles.counter,
                name.length >= NAME_MAX - 5 && styles.counterWarn,
              ]}
            >
              {name.length}/{NAME_MAX}
            </Text>
          </View>
          <View
            style={[styles.inputRow, nameFocused && styles.inputRowFocused]}
          >
            <TextInput
              placeholder="e.g. Design Team"
              placeholderTextColor="rgba(255,255,255,0.32)"
              value={name}
              onChangeText={setName}
              onFocus={() => setNameFocused(true)}
              onBlur={() => setNameFocused(false)}
              maxLength={NAME_MAX}
              style={styles.input}
              returnKeyType="done"
              accessibilityLabel="Group name"
            />
            {name.length > 0 && (
              <TouchableOpacity
                onPress={() => setName('')}
                hitSlop={10}
                style={styles.clearBtn}
                accessibilityRole="button"
                accessibilityLabel="Clear group name"
              >
                <Ionicons
                  name="close-circle"
                  size={18}
                  color="rgba(255,255,255,0.35)"
                />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* Members */}
      <View style={styles.section}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>Add people</Text>
          {memberCountLabel && (
            <View style={styles.countPill}>
              <Text style={styles.countPillText}>{memberCountLabel}</Text>
            </View>
          )}
        </View>
        <UserSearch onSelect={addMember} />
      </View>

      {members.length > 0 && (
        <View style={styles.section}>
          <SelectedMembers members={members} onRemove={removeMember} />
        </View>
      )}
    </View>
  );

  return (
    <Modal
      {...FULLSCREEN_MODAL_PROPS}
      visible
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <ModalScrim color="rgba(5,9,14,0.7)" />
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[
            styles.keyboardWrap,
            { paddingTop: insets.top, paddingBottom: insets.bottom },
          ]}
          pointerEvents="box-none"
        >
          <View
            style={[
              styles.card,
              {
                // Fixed height: the card never grows or shrinks
                height: Math.min(
                  540,
                  windowHeight * 0.86 - insets.top - insets.bottom,
                ),
              },
            ]}
          >
            <View style={styles.header}>
              <TouchableOpacity
                onPress={onClose}
                style={styles.headerBtn}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={18} color={TEXT_PRIMARY} />
              </TouchableOpacity>
              <View style={styles.titleWrap}>
                <Text style={styles.title}>New group</Text>
                <Text style={styles.subtitle}>
                  You'll be the admin. Add the people you want to chat with.
                </Text>
              </View>
              <View style={styles.headerBtnSpacer} />
            </View>

            {/* FlatList (not ScrollView) so the lists inside UserSearch /
                SelectedMembers don't nest in a plain ScrollView */}
            <FlatList
              data={[]}
              keyExtractor={() => 'x'}
              renderItem={null as any}
              ListHeaderComponent={listHeader}
              style={styles.body}
              scrollEnabled
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            />

            <View style={styles.errorWrap}>
            {error && (
              <View
                style={styles.errorBanner}
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
              >
                <Ionicons name="alert-circle" size={16} color="#E07070" />
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity
                  onPress={() => setError(null)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Dismiss error"
                >
                  <Ionicons name="close" size={16} color="#E07070" />
                </TouchableOpacity>
              </View>
            )}
            </View>

            <View style={[styles.footer, { paddingBottom: 12 }]}>
              {nextStepHint && (
                <View style={styles.hintRow}>
                  <Ionicons
                    name="information-circle-outline"
                    size={15}
                    color={TEXT_MUTED}
                  />
                  <Text style={styles.hintText}>{nextStepHint}</Text>
                </View>
              )}

              <View style={styles.footerButtons}>
                <TouchableOpacity
                  onPress={onClose}
                  style={[styles.footerBtn, styles.footerCancel]}
                  disabled={creating}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel"
                >
                  <Text style={styles.footerCancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={createGroup}
                  style={[
                    styles.footerBtn,
                    styles.footerPrimary,
                    !canCreate && styles.footerPrimaryDisabled,
                  ]}
                  disabled={!canCreate}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="Create group"
                  accessibilityState={{ disabled: !canCreate, busy: creating }}
                >
                  {creating ? (
                    <>
                      <ActivityIndicator size="small" color="#fff" />
                      <Text style={styles.footerPrimaryTextDisabled}>
                        Creating…
                      </Text>
                    </>
                  ) : (
                    <>
                      <Ionicons
                        name="checkmark"
                        size={16}
                        color={canCreate ? CHAT_BG : 'rgba(255,255,255,0.4)'}
                      />
                      <Text
                        style={[
                          styles.footerPrimaryText,
                          !canCreate && styles.footerPrimaryTextDisabled,
                        ]}
                      >
                        Create group
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  keyboardWrap: {
    width: '100%',
    maxHeight: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    backgroundColor: CHAT_PANEL,
    borderRadius: CHAT_RADIUS_MODAL,
    borderWidth: 1,
    borderColor: CHAT_BORDER,
    overflow: 'hidden',
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: CHAT_BORDER,
  },
  headerBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
  },
  headerBtnSpacer: { width: 34, height: 34 },
  titleWrap: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  title: { fontSize: 16, fontWeight: '700', color: TEXT_PRIMARY },
  subtitle: {
    marginTop: 1,
    fontSize: 11,
    color: TEXT_MUTED,
    textAlign: 'center',
  },

  // ── Body ──
  body: { flex: 1 },
  errorWrap: { paddingHorizontal: 16 },
  bodyContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 },

  nameRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  nameCol: { flex: 1 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  avatarActive: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: ACCENT_GOLD,
  },
  avatarText: { fontSize: 16, fontWeight: '700', color: ACCENT_GOLD },

  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  label: { fontSize: 12, fontWeight: '600', color: TEXT_PRIMARY },
  counter: { fontSize: 11, color: TEXT_MUTED },
  counterWarn: { color: '#E0B070' },
  countPill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  countPillText: { fontSize: 11, fontWeight: '600', color: ACCENT_GOLD },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 42,
    borderRadius: CHAT_RADIUS_BTN,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 12,
  },
  inputRowFocused: {
    borderColor: ACCENT_GOLD,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  input: { flex: 1, fontSize: 14, color: TEXT_PRIMARY, paddingVertical: 0 },
  clearBtn: { marginLeft: 6 },
  section: { marginTop: 14 },

  errorBanner: {
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: CHAT_RADIUS_BTN,
    backgroundColor: 'rgba(224,112,112,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(224,112,112,0.25)',
  },
  errorText: { color: '#E07070', fontSize: 12, flex: 1, lineHeight: 18 },

  // ── Footer ──
  footer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: CHAT_BORDER,
    backgroundColor: CHAT_PANEL,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hintText: { fontSize: 12, color: TEXT_MUTED, flex: 1 },
  footerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  footerBtn: {
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 16,
    borderRadius: CHAT_RADIUS_BTN,
  },
  footerCancel: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  footerCancelText: { color: TEXT_PRIMARY, fontWeight: '600', fontSize: 14 },
  footerPrimary: { flex: 1.6, backgroundColor: ACCENT_GOLD },
  footerPrimaryDisabled: { backgroundColor: 'rgba(255,255,255,0.07)' },
  footerPrimaryText: { color: CHAT_BG, fontWeight: '700', fontSize: 14 },
  footerPrimaryTextDisabled: {
    color: 'rgba(255,255,255,0.45)',
    fontWeight: '600',
    fontSize: 14,
  },
});
