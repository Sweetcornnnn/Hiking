import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-url-polyfill/auto';

// Get credentials from environment variables
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Validate that environment variables exist
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '⚠️ Missing Supabase environment variables. Please check your .env file.'
  );
  // Fallback to your existing credentials (but these should only be used if .env is missing)
  // Remove these fallbacks once .env is properly configured
  const fallbackUrl = 'https://yyfrpusqnnoubzyudgya.supabase.co';
  const fallbackKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5ZnJwdXNxbm5vdWJ6eXVkZ3lhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5Njg1NzcsImV4cCI6MjEwMzU0NDU3N30.NVsdo5bYGrkg4wxR-YSov-7P-VQFrCvcFcQ77BcEpqk';
  
  if (supabaseUrl === 'https://yyfrpusqnnoubzyudgya.supabase.co' || supabaseAnonKey === 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5ZnJwdXNxbm5vdWJ6eXVkZ3lhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5Njg1NzcsImV4cCI6MjEwMzU0NDU3N30.NVsdo5bYGrkg4wxR-YSov-7P-VQFrCvcFcQ77BcEpqk') {
    throw new Error(
      'Please add your EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env file'
    );
  }
}

// Create and export the Supabase client
export const supabase = createClient(
  supabaseUrl || 'https://yyfrpusqnnoubzyudgya.supabase.co',
  supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5ZnJwdXNxbm5vdWJ6eXVkZ3lhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5Njg1NzcsImV4cCI6MjEwMzU0NDU3N30.NVsdo5bYGrkg4wxR-YSov-7P-VQFrCvcFcQ77BcEpqk',
  {
    auth: {
      storage: AsyncStorage,        // Persist session in AsyncStorage
      autoRefreshToken: true,       // Auto-refresh expired tokens
      persistSession: true,         // Keep session across app restarts
      detectSessionInUrl: false,    // Disable for React Native (no URL redirects)
    },
  }
);

// Type definitions for your database tables
export type Tables = {
  profiles: {
    id: string;
    email?: string | null;
    name?: string | null;
    full_name?: string | null;
    is_admin?: boolean | null;
    avatar_url?: string | null;
    bio?: string | null;
    experience_level?: 'beginner' | 'intermediate' | 'advanced' | 'expert' | null;
    created_at: string;
    updated_at?: string | null;
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
  // Add more tables as needed
  mountains: {
    id: string;
    name: string;
    location: string;
    description: string;
    difficulty: string;
    elevation: number;
    trail_length_km: number;
    estimated_duration: string;
    entrance_fee: number;
    permit_required: boolean;
    operating_hours: string;
    latitude: number;
    longitude: number;
    image_url: string;
    created_at: string;
  };
  species: {
    id: string;
    name: string;
    scientific_name: string;
    type: string;
    description: string;
    habitat: string;
    conservation_status: string;
    image_url: string;
    created_at: string;
  };
  mountain_species: {
    id: string;
    mountain_id: string;
    species_id: string;
    created_at: string;
  };
  hiking_journals: {
    id: string;
    user_id: string;
    mountain_id: string;
    hike_id: string;
    title: string;
    content: string;
    images: string[];
    rating: number;
    is_public: boolean;
    created_at: string;
    updated_at: string;
  };
  chat_messages: {
    id: string;
    user_id: string;
    mountain_id: string;
    content: string;
    created_at: string;
  };
  organizations: {
    id: string;
    name: string;
    description: string;
    logo_url: string;
    is_accredited: boolean;
    contact_email: string;
    contact_phone: string;
    created_at: string;
    updated_at: string;
  };
};