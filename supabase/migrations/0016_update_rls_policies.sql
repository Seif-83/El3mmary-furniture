-- Migration 0016: Update RLS policies for Roles and Permissions and add Customer Login Helpers

-- Helper functions
CREATE OR REPLACE FUNCTION public.normalize_phone(p text)
RETURNS text AS $$
DECLARE
  res text;
BEGIN
  IF p IS NULL THEN
    RETURN '';
  END IF;
  res := p;
  res := translate(res, '٠١٢٣٤٥٦٧٨٩', '0123456789');
  res := translate(res, '۰۱۲۳۴۵۶۷۸٩', '0123456789');
  res := regexp_replace(res, '\D', '', 'g');
  RETURN res;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.has_permission(user_id uuid, perm text)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = user_id AND (role = 'super_admin' OR perm = ANY(permissions))
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_authenticated_user(user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_profiles WHERE id = user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Customer passwordless login RPC function
CREATE OR REPLACE FUNCTION public.get_customer_by_phone(phone_input text)
RETURNS json AS $$
DECLARE
  cust record;
  normalized text;
BEGIN
  normalized := public.normalize_phone(phone_input);
  
  SELECT * INTO cust FROM public.contracted_customers
  WHERE public.normalize_phone(phone) = normalized
  LIMIT 1;
  
  IF cust IS NULL THEN
    RETURN NULL;
  END IF;
  
  RETURN row_to_json(cust);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.get_customer_by_phone(text) TO anon, authenticated;

-- Customer payments and stages lookup RPC functions
CREATE OR REPLACE FUNCTION public.get_customer_payments_by_id(customer_id text)
RETURNS SETOF public.payments AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.payments
  WHERE note LIKE 'cc:' || customer_id || ':%';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.get_customer_payments_by_id(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_customer_stages_by_phone(phone_input text)
RETURNS json AS $$
DECLARE
  normalized text;
  result json;
BEGIN
  normalized := public.normalize_phone(phone_input);
  
  SELECT json_agg(t) INTO result FROM (
    SELECT 
      s.id,
      s.client_id,
      s.visit_id,
      s.stage,
      s.status,
      s.completed_at,
      s.created_at,
      json_build_object('phones', c.phones) AS client
    FROM public.production_stages s
    JOIN public.clients c ON s.client_id = c.id
    WHERE EXISTS (
      SELECT 1 FROM unnest(c.phones) p
      WHERE public.normalize_phone(p) = normalized
    )
  ) t;
  
  RETURN coalesce(result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.get_customer_stages_by_phone(text) TO anon, authenticated;

-- Drop existing policies
DROP POLICY IF EXISTS "Allow admin and viewer read catalogs" ON public.catalogs;
DROP POLICY IF EXISTS "Allow admin write catalogs" ON public.catalogs;
DROP POLICY IF EXISTS "Allow admin and viewer read customers" ON public.customers;
DROP POLICY IF EXISTS "Allow admin write customers" ON public.customers;
DROP POLICY IF EXISTS "Allow admin and viewer read inspections" ON public.inspections;
DROP POLICY IF EXISTS "Allow admin write inspections" ON public.inspections;
DROP POLICY IF EXISTS "Allow admin and viewer read contracted_customers" ON public.contracted_customers;
DROP POLICY IF EXISTS "Allow admin write contracted_customers" ON public.contracted_customers;
DROP POLICY IF EXISTS "Allow admin and viewer read non_contracted_customers" ON public.non_contracted_customers;
DROP POLICY IF EXISTS "Allow admin write non_contracted_customers" ON public.non_contracted_customers;
DROP POLICY IF EXISTS "Allow admin and viewer read deleted_records" ON public.deleted_records;
DROP POLICY IF EXISTS "Allow admin write deleted_records" ON public.deleted_records;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.activity_logs;

-- Recreate updated RLS policies for all tables
-- 1. Catalogs
CREATE POLICY "Allow employees select catalogs" ON public.catalogs FOR SELECT TO authenticated USING (public.is_authenticated_user(auth.uid()));
CREATE POLICY "Allow authorized edit catalogs" ON public.catalogs FOR ALL TO authenticated USING (public.has_permission(auth.uid(), 'production.edit')) WITH CHECK (public.has_permission(auth.uid(), 'production.edit'));

-- 2. Customers
CREATE POLICY "Allow employees select customers" ON public.customers FOR SELECT TO authenticated USING (public.is_authenticated_user(auth.uid()));
CREATE POLICY "Allow authorized edit customers" ON public.customers FOR ALL TO authenticated USING (public.has_permission(auth.uid(), 'production.edit')) WITH CHECK (public.has_permission(auth.uid(), 'production.edit'));

-- 3. Inspections
CREATE POLICY "Allow employees select inspections" ON public.inspections FOR SELECT TO authenticated USING (public.is_authenticated_user(auth.uid()));
CREATE POLICY "Allow authorized edit inspections" ON public.inspections FOR ALL TO authenticated USING (public.has_permission(auth.uid(), 'production.edit') OR public.has_permission(auth.uid(), 'contracts.upload')) WITH CHECK (public.has_permission(auth.uid(), 'production.edit') OR public.has_permission(auth.uid(), 'contracts.upload'));

-- 4. Contracted Customers
CREATE POLICY "Allow employees select contracted_customers" ON public.contracted_customers FOR SELECT TO authenticated USING (public.is_authenticated_user(auth.uid()));
CREATE POLICY "Allow authorized edit contracted_customers" ON public.contracted_customers FOR ALL TO authenticated USING (public.has_permission(auth.uid(), 'production.edit') OR public.has_permission(auth.uid(), 'contracts.upload')) WITH CHECK (public.has_permission(auth.uid(), 'production.edit') OR public.has_permission(auth.uid(), 'contracts.upload'));

-- 5. Non Contracted Customers
CREATE POLICY "Allow employees select non_contracted_customers" ON public.non_contracted_customers FOR SELECT TO authenticated USING (public.is_authenticated_user(auth.uid()));
CREATE POLICY "Allow authorized edit non_contracted_customers" ON public.non_contracted_customers FOR ALL TO authenticated USING (public.has_permission(auth.uid(), 'production.edit')) WITH CHECK (public.has_permission(auth.uid(), 'production.edit'));

-- 6. Clients
DROP POLICY IF EXISTS "Allow employees select clients" ON public.clients;
DROP POLICY IF EXISTS "Allow authorized edit clients" ON public.clients;
CREATE POLICY "Allow employees select clients" ON public.clients FOR SELECT TO authenticated USING (public.is_authenticated_user(auth.uid()));
CREATE POLICY "Allow authorized edit clients" ON public.clients FOR ALL TO authenticated USING (public.has_permission(auth.uid(), 'production.edit')) WITH CHECK (public.has_permission(auth.uid(), 'production.edit'));

-- 7. Production Stages
DROP POLICY IF EXISTS "Allow employees select production_stages" ON public.production_stages;
DROP POLICY IF EXISTS "Allow authorized edit production_stages" ON public.production_stages;
CREATE POLICY "Allow employees select production_stages" ON public.production_stages FOR SELECT TO authenticated USING (public.is_authenticated_user(auth.uid()));
CREATE POLICY "Allow authorized edit production_stages" ON public.production_stages FOR ALL TO authenticated USING (public.has_permission(auth.uid(), 'production.edit')) WITH CHECK (public.has_permission(auth.uid(), 'production.edit'));

-- 8. Payments
DROP POLICY IF EXISTS "Allow employees select payments" ON public.payments;
DROP POLICY IF EXISTS "Allow authorized edit payments" ON public.payments;
CREATE POLICY "Allow employees select payments" ON public.payments FOR SELECT TO authenticated USING (public.is_authenticated_user(auth.uid()));
CREATE POLICY "Allow authorized edit payments" ON public.payments FOR ALL TO authenticated USING (public.has_permission(auth.uid(), 'production.edit')) WITH CHECK (public.has_permission(auth.uid(), 'production.edit'));

-- 9. App Settings
DROP POLICY IF EXISTS "Allow employees select app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Allow admin edit app_settings" ON public.app_settings;
CREATE POLICY "Allow employees select app_settings" ON public.app_settings FOR SELECT TO authenticated USING (public.is_authenticated_user(auth.uid()));
CREATE POLICY "Allow admin edit app_settings" ON public.app_settings FOR ALL TO authenticated USING (public.has_permission(auth.uid(), 'production.edit')) WITH CHECK (public.has_permission(auth.uid(), 'production.edit'));

-- 10. Deleted Records
CREATE POLICY "Allow employees select deleted_records" ON public.deleted_records FOR SELECT TO authenticated USING (public.is_authenticated_user(auth.uid()));
CREATE POLICY "Allow authorized edit deleted_records" ON public.deleted_records FOR ALL TO authenticated USING (public.has_permission(auth.uid(), 'production.edit')) WITH CHECK (public.has_permission(auth.uid(), 'production.edit'));

-- 11. Activity Logs
CREATE POLICY "Allow employees select activity_logs" ON public.activity_logs FOR SELECT TO authenticated USING (public.is_authenticated_user(auth.uid()));
CREATE POLICY "Allow all authenticated write activity_logs" ON public.activity_logs FOR INSERT TO authenticated WITH CHECK (true);
