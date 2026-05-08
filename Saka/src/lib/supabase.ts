import { createClient } from '@supabase/supabase-js';

// Mock Supabase client for development
function createMockClient() {
  return {
    auth: {
      signInWithPassword: async () => ({ data: { user: null }, error: new Error('Mock mode - add Supabase credentials') }),
      signUp: async () => ({ data: { user: null }, error: new Error('Mock mode - add Supabase credentials') }),
      signOut: async () => ({ error: null }),
      getUser: async () => ({ data: { user: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      getSession: async () => ({ data: { session: null }, error: null }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          order: async () => ({ data: [], error: null }),
          single: async () => ({ data: null, error: null }),
        }),
        order: async () => ({ data: [], error: null }),
      }),
      insert: async () => ({ data: null, error: null }),
      update: async () => ({ data: null, error: null }),
      delete: async () => ({ data: null, error: null }),
    }),
  } as any;
}

// Replace with your actual Supabase credentials or set environment variables
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key';

// Create a mock client if credentials are not set
const isMockMode = supabaseUrl.includes('your-project') || supabaseAnonKey.includes('your-anon-key');

export const supabase = isMockMode 
  ? createMockClient()
  : createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export type Tables = {
  profiles: {
    id: string;
    email: string;
    name: string;
    is_admin: boolean;
    created_at: string;
  };
  hikes: {
    id: string;
    user_id: string;
    date: string;
    start_time: string;
    end_time: string;
    tagalongs: number;
    contact_number: string;
    emergency_contact: string;
    created_at: string;
  };
};
