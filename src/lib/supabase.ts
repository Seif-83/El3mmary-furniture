import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY?.trim();

let supabase: any = null;
let supabaseAdmin: any = null;
let SUPABASE_CONFIGURED = false;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not set — falling back to demo mock client.');

  const noop = async () => ({ data: null, error: null });
  const mockFrom = (_table: string) => ({ select: async () => ({ data: [], error: null }), insert: async () => ({ data: null, error: null }), update: async () => ({ data: null, error: null }), delete: async () => ({ data: null, error: null }) });
  const mockAuth = {
    getSession: async () => ({ data: { session: null } }),
    onAuthStateChange: (_cb: any) => ({ subscription: { unsubscribe: () => {} } })
  };

  const mockStorage = { from: (_: string) => ({ upload: noop, download: noop }) };
  supabase = { from: mockFrom, auth: mockAuth, rpc: noop, storage: mockStorage } as any;
  supabaseAdmin = { from: mockFrom, auth: mockAuth, rpc: noop, storage: mockStorage } as any;
  SUPABASE_CONFIGURED = false;
} else {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
  supabaseAdmin = supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey)
    : supabase;
  SUPABASE_CONFIGURED = true;
}

export { supabase, supabaseAdmin, SUPABASE_CONFIGURED };
