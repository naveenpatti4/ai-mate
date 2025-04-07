console.log("Checking environment variables:");
console.log("EXPO_PUBLIC_SUPABASE_URL:", process.env.EXPO_PUBLIC_SUPABASE_URL);
console.log("EXPO_PUBLIC_SUPABASE_ANON_KEY:", process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ? 
  "Key exists (not showing full value for security)" : "Key is undefined");