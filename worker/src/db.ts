import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { WorkerEnv } from './auth';

export function getSupabaseClient(env: WorkerEnv): SupabaseClient {
  const supabaseUrl = env.SUPABASE_URL?.trim();
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase is not configured');
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false
    }
  });
}
