import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnon = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnon) {
  throw new Error('Missing REACT_APP_SUPABASE_URL or REACT_APP_SUPABASE_ANON_KEY in .env.local');
}

export const supabase = createClient(supabaseUrl, supabaseAnon, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    // navigator.locks can stall for ~9s waiting for a lock held by a previous
    // tab/session. This app is single-tab and single-user per session, so we
    // don't need distributed locking — bypass it entirely.
    lock: async (_name, _acquireTimeout, fn) => fn(),
  },
});

// Fire a no-op query immediately on module load to pre-warm the PostgREST
// TCP + TLS connection. This runs before any component mounts, so by the
// time hooks need real data the connection is already established.
supabase.from('profiles').select('id').limit(1).then(() => {});
