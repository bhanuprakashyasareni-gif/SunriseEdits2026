-- SunriseEdits2026 database + storage setup
-- Run this entire script in Supabase SQL Editor.

create extension if not exists "pgcrypto";

create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default 'Reels',
  description text default '',
  preview_url text,
  preview_type text not null default 'video' check (preview_type in ('video','image')),
  required_photos integer not null default 0 check (required_photos >= 0 and required_photos <= 100),
  required_videos integer not null default 0 check (required_videos >= 0 and required_videos <= 20),
  song_required boolean not null default false,
  price numeric(10,2),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_code text unique not null,
  template_id uuid references public.templates(id) on delete set null,
  name text not null,
  mobile text not null,
  email text not null,
  instagram_username text not null,
  song text default '',
  requirements text default '',
  status text not null default 'New' check (status in ('New','Processing','Completed','Cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists public.order_files (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  file_path text not null,
  file_name text not null,
  file_kind text not null check (file_kind in ('photo','video')),
  created_at timestamptz not null default now()
);

alter table public.templates enable row level security;
alter table public.orders enable row level security;
alter table public.order_files enable row level security;

-- Public customers may view active templates only.
drop policy if exists "public read active templates" on public.templates;
create policy "public read active templates"
on public.templates for select
to anon, authenticated
using (is_active = true);

-- Authenticated admins can manage templates.
drop policy if exists "admins manage templates" on public.templates;
create policy "admins manage templates"
on public.templates for all
to authenticated
using (true)
with check (true);

-- Anonymous customers may create an order.
drop policy if exists "public create orders" on public.orders;
create policy "public create orders"
on public.orders for insert
to anon, authenticated
with check (
  length(trim(name)) between 1 and 100
  and length(trim(mobile)) between 5 and 30
  and length(trim(email)) between 3 and 200
  and length(trim(instagram_username)) between 1 and 100
);

-- Only authenticated admins may read/update orders.
drop policy if exists "admins read orders" on public.orders;
create policy "admins read orders"
on public.orders for select
to authenticated
using (true);

drop policy if exists "admins update orders" on public.orders;
create policy "admins update orders"
on public.orders for update
to authenticated
using (true)
with check (true);

-- Customer may add file metadata after creating an order.
drop policy if exists "public create order file metadata" on public.order_files;
create policy "public create order file metadata"
on public.order_files for insert
to anon, authenticated
with check (true);

-- Only admins can read file metadata.
drop policy if exists "admins read order files" on public.order_files;
create policy "admins read order files"
on public.order_files for select
to authenticated
using (true);

-- Storage buckets.
insert into storage.buckets (id, name, public)
values ('template-previews', 'template-previews', true)
on conflict (id) do update set public = true;

insert into storage.buckets (id, name, public)
values ('customer-orders', 'customer-orders', false)
on conflict (id) do update set public = false;

-- Public can read template previews.
drop policy if exists "public read template previews" on storage.objects;
create policy "public read template previews"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'template-previews');

-- Authenticated admins can upload/update/delete previews.
drop policy if exists "admins manage template previews" on storage.objects;
create policy "admins manage template previews"
on storage.objects for all
to authenticated
using (bucket_id = 'template-previews')
with check (bucket_id = 'template-previews');

-- MVP: anonymous customers can upload into customer-orders.
-- Objects are private and there is no public SELECT policy.
-- Client uses unique paths, and only INSERT is allowed.
drop policy if exists "public upload customer files" on storage.objects;
create policy "public upload customer files"
on storage.objects for insert
to anon, authenticated
with check (bucket_id = 'customer-orders');

-- Admins can read/download/delete customer order files.
drop policy if exists "admins read customer files" on storage.objects;
create policy "admins read customer files"
on storage.objects for select
to authenticated
using (bucket_id = 'customer-orders');

drop policy if exists "admins delete customer files" on storage.objects;
create policy "admins delete customer files"
on storage.objects for delete
to authenticated
using (bucket_id = 'customer-orders');

-- Starter templates. Replace/delete these in the Admin dashboard.
insert into public.templates
(title, category, description, preview_type, required_photos, required_videos, song_required, price)
select * from (values
('Birthday Photo Reel — Template 001','Reels','Birthday Reel using your photos.','video',12,0,true,null),
('Cinematic Couple Reel — Template 002','Reels','Cinematic couple edit.','video',8,1,true,null),
('Portrait Creative Edit — Template 003','Photo','Creative portrait treatment.','image',1,0,false,null)
) v(title,category,description,preview_type,required_photos,required_videos,song_required,price)
where not exists (select 1 from public.templates);


-- Free Collab + Premium pricing fields
alter table public.templates add column if not exists premium_price numeric(10,2);
alter table public.templates add column if not exists premium_revisions integer not null default 2 check (premium_revisions between 0 and 2);
alter table public.templates add column if not exists premium_duration_seconds integer not null default 60 check (premium_duration_seconds between 1 and 3600);
alter table public.orders add column if not exists plan text not null default 'free' check (plan in ('free','premium'));
alter table public.orders add column if not exists payment_status text not null default 'not_required' check (payment_status in ('not_required','pending','paid','failed'));
alter table public.orders add column if not exists revision_limit integer not null default 0 check (revision_limit between 0 and 10);
alter table public.orders add column if not exists watermark boolean not null default true;
alter table public.orders add column if not exists duration_limit_seconds integer not null default 15 check (duration_limit_seconds between 1 and 3600);
update public.templates set premium_price=coalesce(premium_price,price) where premium_price is null;


-- Razorpay payment tracking fields
alter table public.orders add column if not exists razorpay_order_id text;
alter table public.orders add column if not exists razorpay_payment_id text;
alter table public.orders add column if not exists payment_amount_paise bigint;

-- Never allow anonymous clients to insert an already-paid order.
drop policy if exists "public create orders" on public.orders;
create policy "public create orders"
on public.orders for insert
to anon, authenticated
with check (
  length(trim(name)) between 1 and 100
  and length(trim(mobile)) between 5 and 30
  and length(trim(email)) between 3 and 200
  and length(trim(instagram_username)) between 1 and 100
  and (
    (plan = 'free' and payment_status = 'not_required')
    or
    (plan = 'premium' and payment_status = 'pending')
  )
);
