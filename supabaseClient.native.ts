import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';
import * as SecureStore from 'expo-secure-store';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './env';

// Use environment variables from our env.js module
const supabaseUrl = SUPABASE_URL;
const supabaseAnonKey = SUPABASE_ANON_KEY;

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