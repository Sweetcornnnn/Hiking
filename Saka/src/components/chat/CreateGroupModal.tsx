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

export default function CreateGroupModal({
  onClose,
}: {
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [members, setMembers] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  const listHeader = (
    <View style={styles.bodyContent}>
      <Text style={styles.label}>GROUP NAME</Text>
      <View style={styles.inputRow}>
        <Ionicons
          name="people-outline"
          size={13}
          color={TEXT_MUTED}
          style={styles.inputIcon}
        />
        <TextInput
          placeholder="e.g. Design Team"
          placeholderTextColor="rgba(255,255,255,0.28)"
          value={name}
          onChangeText={setName}
          maxLength={50}
          style={styles.input}
          returnKeyType="done"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>ADD MEMBERS</Text>
        <UserSearch onSelect={addMember} />
      </View>

      {members.length > 0 && (
        <View style={styles.section}>
          <SelectedMembers members={members} onRemove={removeMember} />
        </View>
      )}

      {error && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={12} color="#E07070" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </View>
  );

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardWrap}
          pointerEvents="box-none"
        >
          <View
            style={[
              styles.card,
              { minHeight: Math.min(520, windowHeight * 0.68) },
            ]}
          >
            <View style={styles.header}>
              <TouchableOpacity
                onPress={onClose}
                style={styles.headerBtn}
                hitSlop={6}
              >
                <Ionicons name="close" size={16} color={TEXT_PRIMARY} />
              </TouchableOpacity>
              <Text style={styles.title}>New Group</Text>
              <View style={styles.headerBtn} />
            </View>

            <FlatList
              data={[]}
              keyExtractor={() => 'x'}
              renderItem={null as any}
              ListHeaderComponent={listHeader}
              style={styles.body}
              contentContainerStyle={styles.bodyScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            />

            <View
              style={[
                styles.footer,
                { paddingBottom: Math.max(insets.bottom, 12) },
              ]}
            >
              <TouchableOpacity
                onPress={onClose}
                style={[styles.footerBtn, styles.footerCancel]}
                disabled={creating}
                activeOpacity={0.85}
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
              >
                {creating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons
                      name="checkmark"
                      size={13}
                      color={canCreate ? CHAT_BG : 'rgba(255,255,255,0.4)'}
                    />
                    <Text
                      style={[
                        styles.footerPrimaryText,
                        !canCreate && styles.footerPrimaryTextDisabled,
                      ]}
                    >
                      Create
                    </Text>
                  </>
                )}
              </TouchableOpacity>
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
    backgroundColor: 'transparent',
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
    maxWidth: 560,
    maxHeight: '95%',
    alignSelf: 'center',
    backgroundColor: CHAT_PANEL,
    borderRadius: CHAT_RADIUS_MODAL,
    borderWidth: 1,
    borderColor: CHAT_BORDER,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: CHAT_BORDER,
  },
  headerBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  title: { fontSize: 13, fontWeight: '700', color: TEXT_PRIMARY },
  body: { flexGrow: 1, flexShrink: 1, minHeight: 120 },
  bodyScrollContent: { flexGrow: 0 },
  bodyContent: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: CHAT_BORDER,
    backgroundColor: CHAT_PANEL,
  },
  footerBtn: {
    minWidth: 88,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 14,
    borderRadius: CHAT_RADIUS_BTN,
  },
  footerCancel: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  footerCancelText: { color: TEXT_MUTED, fontWeight: '600', fontSize: 12 },
  footerPrimary: { backgroundColor: ACCENT_GOLD },
  footerPrimaryDisabled: { backgroundColor: 'rgba(255,255,255,0.06)' },
  footerPrimaryText: { color: CHAT_BG, fontWeight: '700', fontSize: 12 },
  footerPrimaryTextDisabled: { color: 'rgba(255,255,255,0.4)' },

  label: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.9,
    color: TEXT_MUTED,
    opacity: 0.75,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 36,
    borderRadius: CHAT_RADIUS_BTN,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingLeft: 34,
    paddingRight: 12,
  },
  inputIcon: { position: 'absolute', left: 11 },
  input: { flex: 1, fontSize: 12, color: TEXT_PRIMARY, paddingVertical: 0 },
  section: { marginTop: 16 },
  errorBanner: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: CHAT_RADIUS_BTN,
    backgroundColor: 'rgba(224,112,112,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(224,112,112,0.22)',
  },
  errorText: { color: '#E07070', fontSize: 11, flex: 1 },
});