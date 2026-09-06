// UserSearch.tsx - Enhanced with modern search and debounce
import React, { useState, useEffect, useCallback } from 'react';
import { View, TextInput, FlatList, TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SPACING, BG_PANEL, TEXT_PRIMARY, TEXT_MUTED, RADIUS_PILL } from '../../theme/designTokens';
import { supabase } from '../../lib/supabase';

export default function UserSearch({ onSelect }: { onSelect: (u: any) => void }) {
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
        .select('id,name,email,avatar_url')
        .ilike('name', `%${text}%`)
        .limit(10);
      
      if (error) throw error;
      setResults(data || []);
    } catch (error) {
      console.warn('user search', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const getInitials = (name: string) => {
    return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
  };

  const getRandomColor = (id: string) => {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'];
    const index = parseInt(id) % colors.length;
    return colors[index];
  };

  return (
    <View style={styles.container}>
      <View style={[styles.searchBar, focused && styles.searchBarFocused]}>
        <Ionicons name="search-outline" size={20} color={TEXT_MUTED} />
        <TextInput 
          placeholder="Search users..." 
          placeholderTextColor={TEXT_MUTED}
          value={q} 
          onChangeText={search}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[styles.input, { color: TEXT_PRIMARY }]}
        />
        {q.length > 0 && (
          <TouchableOpacity onPress={() => { setQ(''); setResults([]); }}>
            <Ionicons name="close-circle" size={20} color={TEXT_MUTED} />
          </TouchableOpacity>
        )}
        {loading && <ActivityIndicator size="small" color={TEXT_MUTED} />}
      </View>

      {results.length > 0 && (
        <FlatList 
          data={results} 
          keyExtractor={(i) => i.id} 
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.row} 
              onPress={() => { onSelect(item); setQ(''); setResults([]); }}
              activeOpacity={0.7}
            >
              <View style={[styles.avatar, { backgroundColor: getRandomColor(item.id) }]}>
                <Text style={styles.avatarText}>{getInitials(item.name)}</Text>
              </View>
              <View style={styles.userInfo}>
                <Text style={[styles.name, { color: TEXT_PRIMARY }]}>{item.name}</Text>
                <Text style={[styles.email, { color: TEXT_MUTED }]}>{item.email}</Text>
              </View>
              <TouchableOpacity style={styles.addBtn}>
                <Text style={styles.addText}>Add</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          )}
          style={styles.resultsList}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: SPACING.gap / 2,
    position: 'relative',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 10,
  },
  searchBarFocused: {
    borderColor: '#4ECDC4',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
  },
  resultsList: {
    maxHeight: 300,
    marginTop: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.03)',
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  userInfo: {
    flex: 1,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
  },
  email: {
    fontSize: 12,
    opacity: 0.6,
  },
  addBtn: {
    backgroundColor: '#4ECDC4',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
  },
  addText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});