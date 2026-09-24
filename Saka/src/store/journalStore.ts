import { create } from 'zustand';
import { createJournalEntry, deleteJournalEntry, fetchMyJournalEntries } from '../services/journalService';
import type { CreateJournalEntryInput, JournalEntry } from '../types/journal';

interface JournalState {
  entries: JournalEntry[];
  isLoading: boolean;
  error: string | null;
  fetchEntries: () => Promise<void>;
  saveEntry: (input: CreateJournalEntryInput) => Promise<{ error: string | null }>;
  deleteEntry: (entry: JournalEntry) => Promise<{ error: string | null }>;
  clearError: () => void;
}

export const useJournalStore = create<JournalState>((set, get) => ({
  entries: [],
  isLoading: false,
  error: null,

  fetchEntries: async () => {
    set({ isLoading: true, error: null });
    try {
      set({ entries: await fetchMyJournalEntries(), isLoading: false });
    } catch (error: any) {
      set({ isLoading: false, error: error.message || 'Unable to load journal entries.' });
    }
  },

  saveEntry: async (input) => {
    set({ isLoading: true, error: null });
    try {
      const entry = await createJournalEntry(input);
      set({ entries: [entry, ...get().entries], isLoading: false });
      return { error: null };
    } catch (error: any) {
      const message = error.message || 'Unable to save journal entry.';
      set({ isLoading: false, error: message });
      return { error: message };
    }
  },

  deleteEntry: async (entry) => {
    set({ isLoading: true, error: null });
    try {
      await deleteJournalEntry(entry);
      set({
        entries: get().entries.filter((item) => item.id !== entry.id),
        isLoading: false,
      });
      return { error: null };
    } catch (error: any) {
      const message = error.message || 'Unable to delete journal entry.';
      set({ isLoading: false, error: message });
      return { error: message };
    }
  },

  clearError: () => set({ error: null }),
}));
