-- Add customer_id column to orders table for CRM connection
ALTER TABLE public.orders 
ADD COLUMN customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX idx_orders_customer_id ON public.orders(customer_id);

-- Update RLS policy for merchants to view customers linked to orders
-- (existing policies already allow merchants to view customers)