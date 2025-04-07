import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './env';

// Use environment variables from our env.js module
const supabaseUrl = SUPABASE_URL;
const supabaseAnonKey = SUPABASE_ANON_KEY;

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