import { createClient } from '@supabase/supabase-js';

// Access environment variables directly
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// Log warning if variables are missing
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials are not configured. Please check your environment variables.');
}

const storage = {
  getItem: async (key: string): Promise<string | null> => {
    // Ensure this runs only in a browser context
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(key);
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