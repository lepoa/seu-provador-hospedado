-- Explicitly deny anon access to sensitive tables
-- This ensures even if auth is bypassed, anon role cannot read

-- customers: deny anon SELECT
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'customers' AND policyname = 'Deny public access to customers'
  ) THEN
    EXECUTE 'CREATE POLICY "Deny public access to customers" ON public.customers FOR SELECT TO anon USING (false)';
  END IF;
END $$;

-- profiles: deny anon SELECT
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Deny public access to profiles'
  ) THEN
    EXECUTE 'CREATE POLICY "Deny public access to profiles" ON public.profiles FOR SELECT TO anon USING (false)';
  END IF;
END $$;

-- customer_addresses: deny anon SELECT
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'customer_addresses' AND policyname = 'Deny public access to customer_addresses'
  ) THEN
    EXECUTE 'CREATE POLICY "Deny public access to customer_addresses" ON public.customer_addresses FOR SELECT TO anon USING (false)';
  END IF;
END $$;

-- payments: deny anon SELECT
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'payments' AND policyname = 'Deny public access to payments'
  ) THEN
    EXECUTE 'CREATE POLICY "Deny public access to payments" ON public.payments FOR SELECT TO anon USING (false)';
  END IF;
END $$;