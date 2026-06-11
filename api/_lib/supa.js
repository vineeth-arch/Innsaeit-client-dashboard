// api/_lib/supa.js
// Server-only Supabase client (service role). Never import this in src/.
import { createClient } from '@supabase/supabase-js';

export function serviceClient() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

// Verify the caller's Supabase JWT and return their profile (or null).
export async function getCaller(req) {
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  const supa = serviceClient();
  const { data: { user }, error } = await supa.auth.getUser(token);
  if (error || !user) return null;
  const { data: profile } = await supa
    .from('profiles').select('*').eq('id', user.id).single();
  return profile || null;
}
