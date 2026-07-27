-- DIG-10: domain schema (English tables/columns, UUID PKs, real junctions).
-- RLS deferred to DIG-11. CSV ES↔EN mapping is app-layer (DIG-14 / Phase 2).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- restaurants
-- ---------------------------------------------------------------------------
create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  name text not null,
  description text,
  active boolean not null default true,
  brand jsonb not null default '{}'::jsonb,
  theme jsonb not null default '{}'::jsonb,
  logo_light_url text,
  logo_dark_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint restaurants_slug_key unique (slug)
);

create trigger restaurants_set_updated_at
before update on public.restaurants
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- menus
-- ---------------------------------------------------------------------------
create table public.menus (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  slug text not null,
  name text not null,
  description text,
  sort_order integer not null default 0,
  template text not null default 'classic',
  icon text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint menus_restaurant_slug_key unique (restaurant_id, slug),
  constraint menus_id_restaurant_key unique (id, restaurant_id)
);

create index menus_restaurant_id_idx on public.menus (restaurant_id);
create index menus_restaurant_sort_idx on public.menus (restaurant_id, sort_order);

create trigger menus_set_updated_at
before update on public.menus
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  slug text not null,
  name text not null,
  icon text,
  sort_order integer not null default 0,
  cover_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint categories_restaurant_slug_key unique (restaurant_id, slug),
  constraint categories_id_restaurant_key unique (id, restaurant_id)
);

create index categories_restaurant_id_idx on public.categories (restaurant_id);
create index categories_restaurant_sort_idx on public.categories (restaurant_id, sort_order);

create trigger categories_set_updated_at
before update on public.categories
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- tags
-- ---------------------------------------------------------------------------
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  slug text not null,
  name text not null,
  icon text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tags_restaurant_slug_key unique (restaurant_id, slug),
  constraint tags_id_restaurant_key unique (id, restaurant_id)
);

create index tags_restaurant_id_idx on public.tags (restaurant_id);

create trigger tags_set_updated_at
before update on public.tags
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  slug text not null,
  name text not null,
  description text,
  price numeric(12, 2) not null default 0,
  category_id uuid,
  image_url text,
  active boolean not null default true,
  available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_restaurant_slug_key unique (restaurant_id, slug),
  constraint products_id_restaurant_key unique (id, restaurant_id),
  constraint products_category_same_restaurant_fkey
    foreign key (category_id, restaurant_id)
    references public.categories (id, restaurant_id)
    on delete set null
);

create index products_restaurant_id_idx on public.products (restaurant_id);
create index products_category_id_idx on public.products (category_id);

create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- menu_products (M2M)
-- ---------------------------------------------------------------------------
create table public.menu_products (
  menu_id uuid not null,
  product_id uuid not null,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  sort_order integer not null default 0,
  primary key (menu_id, product_id),
  constraint menu_products_menu_same_restaurant_fkey
    foreign key (menu_id, restaurant_id)
    references public.menus (id, restaurant_id)
    on delete cascade,
  constraint menu_products_product_same_restaurant_fkey
    foreign key (product_id, restaurant_id)
    references public.products (id, restaurant_id)
    on delete cascade
);

create index menu_products_restaurant_id_idx on public.menu_products (restaurant_id);
create index menu_products_product_id_idx on public.menu_products (product_id);
create index menu_products_restaurant_sort_idx on public.menu_products (restaurant_id, sort_order);

-- ---------------------------------------------------------------------------
-- product_tags (M2M)
-- ---------------------------------------------------------------------------
create table public.product_tags (
  product_id uuid not null,
  tag_id uuid not null,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  primary key (product_id, tag_id),
  constraint product_tags_product_same_restaurant_fkey
    foreign key (product_id, restaurant_id)
    references public.products (id, restaurant_id)
    on delete cascade,
  constraint product_tags_tag_same_restaurant_fkey
    foreign key (tag_id, restaurant_id)
    references public.tags (id, restaurant_id)
    on delete cascade
);

create index product_tags_restaurant_id_idx on public.product_tags (restaurant_id);
create index product_tags_tag_id_idx on public.product_tags (tag_id);

-- ---------------------------------------------------------------------------
-- owner_restaurants (tenancy; cookie/app wiring in DIG-13, RLS in DIG-11)
-- ---------------------------------------------------------------------------
create table public.owner_restaurants (
  user_id uuid not null references auth.users (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, restaurant_id)
);

create index owner_restaurants_restaurant_id_idx on public.owner_restaurants (restaurant_id);
