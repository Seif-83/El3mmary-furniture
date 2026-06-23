-- Migration 0008: Remove FK constraints and mark 0006 as complete

-- First ensure 0006 migration is marked as applied
DELETE FROM supabase_migrations.schema_migrations WHERE version = '0006';
INSERT INTO supabase_migrations.schema_migrations(version, name, statements) 
SELECT '0006', 'policies_and_seed', array_agg(sql) FROM (
  SELECT unnest(string_to_array($$
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visit_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visit_room_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_stages ENABLE ROW LEVEL SECURITY;
INSERT INTO public.app_settings (key, value) VALUES ('whatsapp_api_url', ''), ('staff_numbers', '');
INSERT INTO public.user_profiles (auth_uid, email, username, role) VALUES (NULL, 'admin@example.com', 'admin', 'admin') ON CONFLICT (email) DO NOTHING;
$$, ';')) AS sql
) AS sub;

-- Fix FK constraints to accept arbitrary IDs
ALTER TABLE public.production_stages DROP CONSTRAINT IF EXISTS production_stages_client_id_fkey;
ALTER TABLE public.production_stages DROP CONSTRAINT IF EXISTS production_stages_visit_id_fkey;
