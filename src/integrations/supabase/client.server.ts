// Admin credentials are intentionally disabled. Server functions use the
// authenticated user's Supabase client plus server-only OpenAI credentials.

export function hasSupabaseAdminCredentials() {
  return false;
}

export function getSupabaseAdmin() {
  return undefined;
}
