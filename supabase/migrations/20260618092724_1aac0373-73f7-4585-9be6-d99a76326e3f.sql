
-- Lock down profiles: remove INSERT policy (handled by trigger or service role)
DROP POLICY IF EXISTS "users insert own profile" ON public.profiles;
REVOKE INSERT ON public.profiles FROM authenticated;

-- Lock down business_plans: read-only for users; writes go through service role
DROP POLICY IF EXISTS "users manage own business plans" ON public.business_plans;
CREATE POLICY "users read own business plans"
  ON public.business_plans
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
REVOKE INSERT, UPDATE, DELETE ON public.business_plans FROM authenticated;
