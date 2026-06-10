import { createClient } from "@supabase/supabase-js";

// Server-only client. Uses the SECRET service-role key (never exposed to the browser).
// Also verifies a user's access token so we act as that user, not as god-mode blindly.

export function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) return null;
  return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}

// Given a bearer token from the client, return the authenticated user (or null).
export async function getUserFromToken(token) {
  const admin = getAdmin();
  if (!admin || !token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error) return null;
  return data?.user || null;
}
