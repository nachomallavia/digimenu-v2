-- DIG-14: synthetic mini-catalog for local/dev (not Finca CSV restore).
-- Idempotent: fixed UUIDs + upserts. Safe to re-run.
-- Does NOT insert owner_restaurants — link Auth user separately (docs/seed.md).

-- Fixed IDs
-- restaurant:  a0000000-0000-4000-8000-000000000001
-- categories:  a0000000-0000-4000-8000-000000000011 / 012
-- tags:        a0000000-0000-4000-8000-000000000021 / 022
-- products:    a0000000-0000-4000-8000-000000000031 .. 034
-- menu:        a0000000-0000-4000-8000-000000000041

insert into public.restaurants (
  id, slug, name, description, active, brand, theme,
  logo_light_url, logo_dark_url
)
values (
  'a0000000-0000-4000-8000-000000000001',
  'seed-demo',
  'Seed Demo Café',
  'Catálogo sintético DIG-14 para desarrollo.',
  true,
  '{"colors":[{"hex":"#2f5d50","nombre":"Primario"},{"hex":"#f7f3eb","nombre":"Fondo"}],"fonts":[{"family":"Georgia, serif","etiqueta":"Serif"}]}'::jsonb,
  '{"mode":"light","primary":"#2f5d50","background":"#f7f3eb","foreground":"#1a1a1a","muted":"#6b6b6b","border":"#d4cfc4","radius":"md","fontDisplay":"Georgia, serif","fontBody":"Georgia, serif"}'::jsonb,
  null,
  null
)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  active = excluded.active,
  brand = excluded.brand,
  theme = excluded.theme,
  updated_at = now();

-- Ensure id stays stable if row existed with different id (re-seed path uses fixed id via slug conflict only).
-- Children keyed by restaurant_id = fixed seed restaurant id.

insert into public.categories (id, restaurant_id, slug, name, icon, sort_order, cover_url, active)
values
  ('a0000000-0000-4000-8000-000000000011', 'a0000000-0000-4000-8000-000000000001', 'cafes', 'Cafés', 'cup', 0, null, true),
  ('a0000000-0000-4000-8000-000000000012', 'a0000000-0000-4000-8000-000000000001', 'dulces', 'Dulces', 'cake', 1, null, true)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  icon = excluded.icon,
  sort_order = excluded.sort_order,
  active = excluded.active,
  updated_at = now();

insert into public.tags (id, restaurant_id, slug, name, icon, active)
values
  ('a0000000-0000-4000-8000-000000000021', 'a0000000-0000-4000-8000-000000000001', 'vegano', 'Vegano', 'leaf', true),
  ('a0000000-0000-4000-8000-000000000022', 'a0000000-0000-4000-8000-000000000001', 'sin-tacc', 'Sin TACC', 'bread', true)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  icon = excluded.icon,
  active = excluded.active,
  updated_at = now();

insert into public.products (
  id, restaurant_id, slug, name, description, price, category_id, image_url, active, available
)
values
  (
    'a0000000-0000-4000-8000-000000000031',
    'a0000000-0000-4000-8000-000000000001',
    'espresso',
    'Espresso',
    'Shot corto.',
    2500.00,
    'a0000000-0000-4000-8000-000000000011',
    null, true, true
  ),
  (
    'a0000000-0000-4000-8000-000000000032',
    'a0000000-0000-4000-8000-000000000001',
    'latte',
    'Latte',
    'Espresso con leche vaporizada.',
    4200.00,
    'a0000000-0000-4000-8000-000000000011',
    null, true, true
  ),
  (
    'a0000000-0000-4000-8000-000000000033',
    'a0000000-0000-4000-8000-000000000001',
    'brownie',
    'Brownie',
    'Chocolate amargo.',
    3800.00,
    'a0000000-0000-4000-8000-000000000012',
    null, true, true
  ),
  (
    'a0000000-0000-4000-8000-000000000034',
    'a0000000-0000-4000-8000-000000000001',
    'cookie-avena',
    'Cookie de avena',
    'Vegana y sin TACC.',
    3200.00,
    'a0000000-0000-4000-8000-000000000012',
    null, true, true
  )
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  description = excluded.description,
  price = excluded.price,
  category_id = excluded.category_id,
  active = excluded.active,
  available = excluded.available,
  updated_at = now();

insert into public.menus (
  id, restaurant_id, slug, name, description, sort_order, template, icon, active
)
values (
  'a0000000-0000-4000-8000-000000000041',
  'a0000000-0000-4000-8000-000000000001',
  'carta',
  'Carta',
  'Menú principal seed.',
  0,
  'classic',
  'tools-kitchen-2',
  true
)
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  template = excluded.template,
  icon = excluded.icon,
  active = excluded.active,
  updated_at = now();

delete from public.menu_products
where restaurant_id = 'a0000000-0000-4000-8000-000000000001'
  and menu_id = 'a0000000-0000-4000-8000-000000000041';

insert into public.menu_products (menu_id, product_id, restaurant_id, sort_order)
values
  ('a0000000-0000-4000-8000-000000000041', 'a0000000-0000-4000-8000-000000000031', 'a0000000-0000-4000-8000-000000000001', 0),
  ('a0000000-0000-4000-8000-000000000041', 'a0000000-0000-4000-8000-000000000032', 'a0000000-0000-4000-8000-000000000001', 1),
  ('a0000000-0000-4000-8000-000000000041', 'a0000000-0000-4000-8000-000000000033', 'a0000000-0000-4000-8000-000000000001', 2),
  ('a0000000-0000-4000-8000-000000000041', 'a0000000-0000-4000-8000-000000000034', 'a0000000-0000-4000-8000-000000000001', 3);

delete from public.product_tags
where restaurant_id = 'a0000000-0000-4000-8000-000000000001'
  and product_id = 'a0000000-0000-4000-8000-000000000034';

insert into public.product_tags (product_id, tag_id, restaurant_id)
values
  ('a0000000-0000-4000-8000-000000000034', 'a0000000-0000-4000-8000-000000000021', 'a0000000-0000-4000-8000-000000000001'),
  ('a0000000-0000-4000-8000-000000000034', 'a0000000-0000-4000-8000-000000000022', 'a0000000-0000-4000-8000-000000000001');
