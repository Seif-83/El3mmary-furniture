const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();
const ws = require("ws");

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing credentials in env file!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
  realtime: { transport: ws }
});

async function run() {
  const tables = [
    "inspections",
    "customers",
    "contracted_customers",
    "non_contracted_customers",
    "catalogs",
    "payments",
    "production_stages",
    "clients",
    "app_settings"
  ];
  for (const table of tables) {
    const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });
    if (error) {
      console.error(`Error counting ${table}:`, error.message);
    } else {
      console.log(`Table ${table}: ${count} rows`);
    }
  }
}

run();
