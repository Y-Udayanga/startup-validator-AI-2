ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS stripe_customer_id,
  DROP COLUMN IF EXISTS stripe_subscription_id;

CREATE TABLE public.payment_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text NOT NULL CHECK (plan IN ('free', 'pro', 'business')),
  provider text NOT NULL DEFAULT 'payhere' CHECK (provider = 'payhere'),
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled', 'failed')),
  payhere_order_id text NOT NULL UNIQUE,
  payhere_payment_id text,
  payhere_status_code text,
  payhere_status_message text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.payment_orders TO authenticated;
GRANT ALL ON public.payment_orders TO service_role;
REVOKE INSERT, UPDATE, DELETE ON public.payment_orders FROM authenticated;

ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own payment orders"
  ON public.payment_orders
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER payment_orders_updated_at
BEFORE UPDATE ON public.payment_orders
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX payment_orders_user_created_idx ON public.payment_orders(user_id, created_at DESC);
CREATE INDEX payment_orders_status_idx ON public.payment_orders(status, created_at DESC);
