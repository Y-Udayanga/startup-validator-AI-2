import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let adminClient: SupabaseClient<Database> | undefined;

if (supabaseUrl && serviceRoleKey) {
  adminClient = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export const supabaseAdmin = adminClient;

export function hasSupabaseAdminCredentials() {
  return !!adminClient;
}

export function getSupabaseAdmin() {
  return adminClient;
}
