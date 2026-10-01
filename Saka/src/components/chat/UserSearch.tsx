// components/chat/UserSearch.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  TextInput,
  FlatList,
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  TEXT_PRIMARY,
  TEXT_MUTED,
  ACCENT_GOLD,
  BG_CARD,
  CHAT_SUBTLE,
  CHAT_BORDER,
  CHAT_RADIUS_BTN,
  CHAT_RADIUS_CARD,
  CHAT_FS_BODY,
  CHAT_BG,
} from '../../theme/designTokens';
import { supabase } from '../../lib/supabase';
import { getAvatarColor, getInitials } from '../../utils/colors';

export default function UserSearch({
  onSelect,
  buttonLabel = 'Add',
}: {
  onSelect: (u: any) => void;
  buttonLabel?: string;
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);

  const search = useCallback(async (text: string) => {
    setQ(text);
    if (!text.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, username, email, avatar_url')
        .ilike('full_name', `%${text}%`)
        .limit(10);

      if (error) throw error;

      const formattedData = (data || []).map((item) => ({
        ...item,
        name: item.full_name || item.username || 'Unknown User',
      }));

      setResults(formattedData);
    } catch (error) {
      console.warn('user search', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (q.trim()) search(q);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [q, search]);

  const handleSelect = (user: any) => {
    onSelect(user);
    setQ('');
    setResults([]);
  };

  const buttonIcon = buttonLabel.toLowerCase() === 'message' ? 'chatbubble' : 'add';

  return (
    <View style={styles.container}>
      <View style={[styles.searchBar, focused && styles.searchBarFocused]}>
        <Ionicons name="search-outline" size={14} color={TEXT_MUTED} />
        <TextInput
          placeholder="Search users…"
          placeholderTextColor="rgba(255,255,255,0.28)"
          value={q}
          onChangeText={setQ}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[styles.input, { color: TEXT_PRIMARY }]}
          returnKeyType="search"
        />
        {loading ? (
          <ActivityIndicator size="small" color={TEXT_MUTED} />
        ) : q.length > 0 ? (
          <TouchableOpacity
            onPress={() => {
              setQ('');
              setResults([]);
            }}
            hitSlop={6}
          >
            <Ionicons name="close-circle" size={15} color="rgba(255,255,255,0.3)" />
          </TouchableOpacity>
        ) : null}
      </View>

      {results.length > 0 && (
        <View style={styles.resultsCard}>
          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            renderItem={({ item }) => (
              <View style={styles.row}>
                <TouchableOpacity
                  style={styles.rowLeft}
                  onPress={() => handleSelect(item)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.avatar,
                      { backgroundColor: getAvatarColor(item.id) },
                    ]}
                  >
                    <Text style={styles.avatarText}>{getInitials(item.name)}</Text>
                  </View>
                  <View style={styles.userInfo}>
                    <Text style={styles.name} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.email} numberOfLines={1}>
                      {item.email}
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.addBtn}
                  onPress={() => handleSelect(item)}
                  activeOpacity={0.85}
                >
                  <Ionicons name={buttonIcon} size={11} color={CHAT_BG} />
                  <Text style={styles.addText}>{buttonLabel}</Text>
                </TouchableOpacity>
              </View>
            )}
            style={styles.resultsList}
            nestedScrollEnabled
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: 2 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: CHAT_RADIUS_BTN,
    paddingHorizontal: 10,
    height: 36,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 8,
  },
  searchBarFocused: {
    borderColor: 'rgba(201,169,110,0.45)',
  },
  input: { flex: 1, paddingVertical: 6, fontSize: 12 },
  resultsCard: {
    marginTop: 8,
    backgroundColor: BG_CARD,
    borderRadius: CHAT_RADIUS_CARD,
    borderWidth: 1,
    borderColor: CHAT_BORDER,
    overflow: 'hidden',
    maxHeight: 320,
  },
  resultsList: { maxHeight: 320 },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: CHAT_BORDER,
    marginLeft: 56,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 8,
  },
  rowLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  userInfo: { flex: 1, minWidth: 0 },
  name: { fontSize: 12.5, fontWeight: '600', color: TEXT_PRIMARY },
  email: { fontSize: 10, color: TEXT_MUTED, opacity: 0.75, marginTop: 1 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: ACCENT_GOLD,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: CHAT_RADIUS_BTN,
  },
  addText: { color: CHAT_BG, fontSize: 11, fontWeight: '700' },
});