import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';
import * as SecureStore from 'expo-secure-store';

// Access environment variables directly
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// Log warning if variables are missing
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials are not configured. Please check your environment variables.');
}

// Custom storage adapter that works across platforms
const storage = {
    getItem: async (key: string): Promise<string | null> => {
      return await SecureStore.getItemAsync(key);
    },
    setItem: async (key: string, value: string): Promise<void> => {
      await SecureStore.setItemAsync(key, value);
    },
    removeItem: async (key: string): Promise<void> => {
      await SecureStore.deleteItemAsync(key);
    },
  };

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});