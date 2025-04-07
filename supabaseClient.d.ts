import { SupabaseClient } from '@supabase/supabase-js';

// Declare the module using the base name used in imports
declare module './supabaseClient' {
  // Export the 'supabase' variable with its type
  export const supabase: SupabaseClient;
}

// Also declare for paths relative to the 'screens' directory
declare module '../supabaseClient' {
    export const supabase: SupabaseClient;
}