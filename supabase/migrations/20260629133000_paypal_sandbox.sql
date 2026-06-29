ALTER TABLE public.payment_orders
  DROP CONSTRAINT IF EXISTS payment_orders_provider_check;

ALTER TABLE public.payment_orders
  ADD CONSTRAINT payment_orders_provider_check
  CHECK (provider IN ('payhere', 'paypal'));

ALTER TABLE public.payment_orders
  ADD COLUMN IF NOT EXISTS paypal_order_id text,
  ADD COLUMN IF NOT EXISTS paypal_capture_id text;

CREATE INDEX IF NOT EXISTS payment_orders_paypal_order_idx
  ON public.payment_orders(paypal_order_id)
  WHERE paypal_order_id IS NOT NULL;
