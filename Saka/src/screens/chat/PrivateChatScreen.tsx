// PrivateChatScreen.tsx - Clean with no blocking
import React, { useState, useRef } from 'react';
import { 
  View, Text, Modal, TextInput, TouchableOpacity, 
  StyleSheet, Animated, Platform 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { 
  BG_CARD, BG_PANEL, BG_SUBTLE, ACCENT_GOLD, 
  TEXT_PRIMARY, TEXT_MUTED, BORDER_DEFAULT 
} from '../../theme/designTokens';
import ConversationList from '../../components/chat/ConversationList';
import UserSearch from '../../components/chat/UserSearch';
import SelectedMembers from '../../components/chat/SelectedMembers';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';

export default function PrivateChatScreen() {
  const [showCreate, setShowCreate] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;

  return (
    <View style={styles.container}>
      <ConversationList
        scrollY={scrollY}
        header={
          <View style={styles.headerContainer}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={[styles.title, { color: TEXT_PRIMARY }]}>Conversations</Text>
            <View style={styles.hintContainer}>
              <Ionicons name="search-outline" size={14} color={TEXT_MUTED} />
              <Text style={[styles.hint, { color: TEXT_MUTED }]}>Find or start a chat</Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.createButton, { backgroundColor: ACCENT_GOLD }]}
            onPress={() => setShowCreate(true)}
          >
            <Ionicons name="add-outline" size={18} color="#fff" />
            <Text style={[styles.createButtonText, { color: '#fff' }]}>New Group</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchWrapper}>
          <UserSearch onSelect={() => undefined} />
        </View>
          </View>
        }
      />

      {/* Create Group Modal */}
      {showCreate && <CreateGroupModal onClose={() => setShowCreate(false)} />}
    </View>
  );
}

// ... CreateGroupModal component (same as before) ...
function CreateGroupModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [members, setMembers] = useState<any[]>([]);
  const user = useAuthStore((s) => s.user);

  const addMember = (member: any) => {
    if (!members.find((existingMember) => existingMember.id === member.id)) {
      setMembers((currentMembers) => [...currentMembers, member]);
    }
  };

  const removeMember = (id: string) => setMembers((currentMembers) => currentMembers.filter((member) => member.id !== id));

  const create = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase.from('groups').insert({ name, creator_id: user.id }).select().single();
      if (error) throw error;
      const memberRows = members.map((member) => ({ group_id: data.id, user_id: member.id }));
      await supabase.from('group_members').insert(memberRows);
      onClose();
    } catch (error) {
      console.warn('create group failed', error);
    }
  };

  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: BG_CARD, borderColor: BORDER_DEFAULT }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
              <Ionicons name="close-outline" size={24} color={TEXT_PRIMARY} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: TEXT_PRIMARY }]}>Create Group</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.modalBody}>
            <View style={styles.inputWrapper}>
              <Ionicons name="people-outline" size={20} color={TEXT_MUTED} style={styles.inputIcon} />
              <TextInput
                placeholder="Group name"
                placeholderTextColor={TEXT_MUTED}
                value={name}
                onChangeText={setName}
                maxLength={50}
                style={[styles.input, { color: TEXT_PRIMARY, backgroundColor: BG_SUBTLE }]}
              />
            </View>

            <View style={styles.memberSection}>
              <Text style={[styles.label, { color: TEXT_MUTED }]}>Add Members</Text>
              <UserSearch onSelect={addMember} />
            </View>

            {members.length > 0 && (
              <View style={styles.selectedSection}>
                <SelectedMembers members={members} onRemove={removeMember} />
              </View>
            )}
          </View>

          <View style={styles.actions}>
            <TouchableOpacity onPress={onClose} style={[styles.modalButton, styles.cancelButton]}>
              <Text style={{ color: TEXT_MUTED, fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={create} 
              style={[styles.modalButton, styles.createModalButton, { backgroundColor: ACCENT_GOLD }]}
              disabled={!name || members.length === 0}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>Create</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_PANEL,
  },
  headerContainer: {
    paddingTop: Platform.OS === 'ios' ? 4 : 8,
    paddingBottom: 4,
    backgroundColor: BG_PANEL,
  },
  headerRow: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    gap: 4,
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  hintContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hint: {
    fontSize: 13,
    opacity: 0.6,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: ACCENT_GOLD,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  createButtonText: {
    fontWeight: '600',
    fontSize: 13,
  },
  searchWrapper: {
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  listWrapper: {
    flex: 1,
    backgroundColor: BG_PANEL,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: 20,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  modalCloseBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  modalBody: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  inputIcon: {
    position: 'absolute',
    left: 14,
    zIndex: 1,
  },
  input: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: BORDER_DEFAULT,
    borderRadius: 12,
    paddingHorizontal: 44,
    fontSize: 15,
  },
  memberSection: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  selectedSection: {
    marginTop: 8,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    gap: 12,
  },
  modalButton: {
    minWidth: 84,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 12,
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: BORDER_DEFAULT,
  },
  createModalButton: {
    shadowColor: ACCENT_GOLD,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
});