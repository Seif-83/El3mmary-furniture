import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig, loadEnv } from "vite";

const clientEnvAliases = {
  supabaseUrl: [
    "VITE_SUPABASE_URL",
    "SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
  ],
  supabaseAnonKey: [
    "VITE_SUPABASE_ANON_KEY",
    "SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ],
} as const;

function readFirstEnv(env: Record<string, string>, keys: readonly string[]) {
  return keys.map((key) => env[key]?.trim()).find(Boolean) || "";
}

function assertRequiredEnv(env: Record<string, string>) {
  const supabaseUrl = readFirstEnv(env, clientEnvAliases.supabaseUrl);
  const supabaseAnonKey = readFirstEnv(env, clientEnvAliases.supabaseAnonKey);

  const isPlaceholderValue = (value: string | undefined) => {
    if (!value) return true;
    const normalized = value.trim();
    return (
      normalized === "" ||
      /your-project-ref\.supabase\.co|your-anon-key|<your-project-ref>|<anon-key>/i.test(
        normalized,
      )
    );
  };

  const invalid: string[] = [];

  if (!supabaseUrl || isPlaceholderValue(supabaseUrl)) {
    invalid.push(clientEnvAliases.supabaseUrl.join(" / "));
  }

  if (!supabaseAnonKey || isPlaceholderValue(supabaseAnonKey)) {
    invalid.push(clientEnvAliases.supabaseAnonKey.join(" / "));
  }

  if (invalid.length > 0) {
    console.warn(
      `Supabase environment variables are not configured or are using placeholders. ${invalid.join(" and ")} must be replaced with your actual values from Supabase. ` +
        "The dev server will still start, but Supabase features will be mocked locally.",
    );
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  assertRequiredEnv(env);
  const supabaseUrl = readFirstEnv(env, clientEnvAliases.supabaseUrl);
  const supabaseAnonKey = readFirstEnv(env, clientEnvAliases.supabaseAnonKey);

  return {
    plugins: [react(), tailwindcss()],
    define: {
      "process.env.GEMINI_API_KEY": JSON.stringify(env.GEMINI_API_KEY),
      "process.env.ADMIN_EMAIL": JSON.stringify(env.ADMIN_EMAIL),
      "process.env.ADMIN_PASSWORD": JSON.stringify(env.ADMIN_PASSWORD),
      "process.env.VIEWER_EMAIL": JSON.stringify(env.VIEWER_EMAIL),
      "process.env.SUPABASE_URL": JSON.stringify(supabaseUrl),
      "process.env.SUPABASE_ANON_KEY": JSON.stringify(supabaseAnonKey),
      "process.env.NEXT_PUBLIC_SUPABASE_URL": JSON.stringify(supabaseUrl),
      "process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY":
        JSON.stringify(supabaseAnonKey),
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR.
      // Do not modify; file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== "true",
    },
  };
});
