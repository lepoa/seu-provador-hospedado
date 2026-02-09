-- 1) Table to persist Mercado Pago webhook + reconciliation events (visible in admin)
create table if not exists public.mp_payment_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid null,
  live_cart_id uuid null,
  mp_payment_id text null,
  mp_preference_id text null,
  event_type text null,
  mp_status text null,
  mp_status_detail text null,
  amount numeric null,
  processing_result text not null default 'received',
  error_message text null,
  payload jsonb null,
  received_at timestamptz not null default now(),
  processed_at timestamptz null
);

alter table public.mp_payment_events enable row level security;

-- Admin/Merchant visibility
create policy "Merchants can view mp payment events"
on public.mp_payment_events
for select
using (has_role(auth.uid(), 'merchant'::app_role) or has_role(auth.uid(), 'admin'::app_role));

-- System insert (edge functions)
create policy "System can insert mp payment events"
on public.mp_payment_events
for insert
with check (true);

-- 2) Harden orders with payment audit fields
alter table public.orders
  add column if not exists payment_confirmed_at timestamptz null,
  add column if not exists payment_provider_payment_id text null,
  add column if not exists payment_mismatch boolean not null default false,
  add column if not exists payment_mismatch_details text null;

-- 3) Enforce one payment row per order/provider (enables safe upsert)
create unique index if not exists payments_order_provider_unique
on public.payments(order_id, provider);
