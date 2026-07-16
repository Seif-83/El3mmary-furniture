CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  email text UNIQUE NOT NULL,
  role text NOT NULL,
  permissions text[] NOT NULL DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read
DROP POLICY IF EXISTS "Allow public read of username/email mapping" ON public.user_profiles;
CREATE POLICY "Allow public read of username/email mapping" ON public.user_profiles
  FOR SELECT USING (true);

-- Function to check if super admin
CREATE OR REPLACE FUNCTION public.is_super_admin(user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = user_id AND role = 'super_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Policy: Super Admin manage
DROP POLICY IF EXISTS "Super Admins can manage all profiles" ON public.user_profiles;
CREATE POLICY "Super Admins can manage all profiles" ON public.user_profiles
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- Insert seed data
INSERT INTO public.user_profiles (id, username, email, role, permissions)
VALUES 
  ('2d2ead3c-5609-42a9-bdad-cd0f5180f66f', 'admin', 'admin@gmail.com', 'super_admin', ARRAY['contracts.upload', 'contracts.edit', 'production.view', 'production.edit', 'production.alexandria', 'production.cairo', 'users.manage', 'reports.view']),
  ('832b7509-0320-4ce8-9154-2293eeba44d1', 'omarshalaby', 'omarshalaby@gmail.com', 'super_admin', ARRAY['contracts.upload', 'contracts.edit', 'production.view', 'production.edit', 'production.alexandria', 'production.cairo', 'users.manage', 'reports.view']),
  ('acedfe3c-827b-4c7e-8df3-87866ab4f227', 'jana', 'jana@gmail.com', 'super_admin', ARRAY['contracts.upload', 'contracts.edit', 'production.view', 'production.edit', 'production.alexandria', 'production.cairo', 'users.manage', 'reports.view']),
  ('f86151b5-8837-4473-93fe-ad233a77f4ac', 'viewer', 'viewer@gmail.com', 'moderator', ARRAY['production.view', 'production.alexandria', 'production.cairo']),
  ('58cf2c52-5636-4ee3-8b12-338750ff1b21', 'view', 'view@gmail.com', 'moderator', ARRAY['production.view', 'production.alexandria', 'production.cairo'])
ON CONFLICT (id) DO NOTHING;
