// Server-side Supabase admin client. It is optional so features that only need
// the user's session do not fail when service-role credentials are absent.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

function createSupabaseAdminClient() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return undefined;
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    }
  });
}

export function hasSupabaseAdminCredentials() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

let _supabaseAdmin: ReturnType<typeof createSupabaseAdminClient> | undefined;

export function getSupabaseAdmin() {
  if (_supabaseAdmin === undefined) _supabaseAdmin = createSupabaseAdminClient();
  return _supabaseAdmin;
}
