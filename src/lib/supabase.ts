import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
const supabaseServiceKey =
  import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY?.trim();

let supabase: any = null;
let supabaseAdmin: any = null;
let SUPABASE_CONFIGURED = false;

const isPlaceholderValue = (value: string | null | undefined) => {
  if (!value) return true;
  const normalized = value.trim();
  return (
    normalized === "" ||
    /your-project-ref\.supabase\.co|your-anon-key|<your-project-ref>|<anon-key>/i.test(
      normalized,
    )
  );
};

const useMockSupabase =
  isPlaceholderValue(supabaseUrl) || isPlaceholderValue(supabaseAnonKey);

if (useMockSupabase) {
  console.warn(
    "Supabase is not configured or is using placeholder values — falling back to a demo mock client.",
  );

  const noop = async () => ({ data: null, error: null });
  const createMockQuery = () => {
    const chain: any = {
      select: async () => ({ data: [], error: null }),
      insert: async () => ({ data: null, error: null }),
      update: async () => ({ data: null, error: null }),
      delete: async () => ({ data: null, error: null }),
      upsert: async () => ({ data: null, error: null }),
      rpc: async () => ({ data: null, error: null }),
      single: async () => ({ data: null, error: null }),
      maybeSingle: async () => ({ data: null, error: null }),
      order: () => chain,
      limit: () => chain,
      eq: () => chain,
      neq: () => chain,
      in: () => chain,
      match: () => chain,
      is: () => chain,
      not: () => chain,
      or: () => chain,
      filter: () => chain,
      range: () => chain,
      onConflict: () => chain,
      returns: () => chain,
    };
    return chain;
  };

  const mockFrom = (_table: string) => createMockQuery();
  const mockAuth = {
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: (_cb: any) => ({
      data: { subscription: { unsubscribe: () => {} } },
    }),
    signInWithPassword: async () => ({
      data: null,
      error: {
        message:
          "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env to enable authentication.",
      },
    }),
    signOut: async () => ({ data: null, error: null }),
  };

  const mockStorage = {
    from: (_: string) => ({
      upload: noop,
      download: noop,
      getPublicUrl: () => ({ data: { publicUrl: null }, error: null }),
    }),
  };

  supabase = {
    from: mockFrom,
    auth: mockAuth,
    rpc: noop,
    storage: mockStorage,
  } as any;
  supabaseAdmin = {
    from: mockFrom,
    auth: mockAuth,
    rpc: noop,
    storage: mockStorage,
  } as any;
  SUPABASE_CONFIGURED = false;
} else {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
  supabaseAdmin = supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey)
    : supabase;
  SUPABASE_CONFIGURED = true;
}

export { supabase, supabaseAdmin, SUPABASE_CONFIGURED };
