import { createClient } from "@supabase/supabase-js";

// Browser client — uses the public/anon (publishable) key. Safe to expose.
let _client = null;

export function getSupabase() {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null; // not configured yet
  _client = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  return _client;
}

export function supabaseConfigured() {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
