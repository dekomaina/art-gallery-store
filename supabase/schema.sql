-- Deko Arts Gallery: tables used by server.js (id + data jsonb). Run once in Supabase SQL Editor.
-- Removes the two demo tables created earlier (artworks, orders in the old simple layout).
drop table if exists public.artworks cascade;
drop table if exists public.orders cascade;

do $$
declare t text;
begin
  foreach t in array array['products','orders','payments','carts','cart_events','bookings','service_requests'] loop
    execute format('create table if not exists public.%I (id text primary key, data jsonb not null default ''{}''::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now())', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
  end loop;
end $$;

create index if not exists orders_checkout_idx on public.orders ((data->>'checkoutId'));
create index if not exists carts_created_idx on public.carts (created_at desc);
create index if not exists cart_events_created_idx on public.cart_events (created_at desc);
-- No policies on purpose: the browser can never read or write these tables.
-- Only the server, using the service_role / secret key, can.
