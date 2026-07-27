-- DIG-11: RLS by restaurant ownership.
-- Public (anon): SELECT active restaurant + active children.
-- Authenticated owners: full read/write on owned restaurants via owner_restaurants.
-- Restaurant INSERT and owner_restaurants writes: service_role only (until DIG-27).

-- ---------------------------------------------------------------------------
-- Helper (security invoker — no recursion into restaurants)
-- ---------------------------------------------------------------------------
create or replace function public.is_restaurant_owner(p_restaurant_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from public.owner_restaurants o
    where o.restaurant_id = p_restaurant_id
      and o.user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_restaurant_owner(uuid) from public;
grant execute on function public.is_restaurant_owner(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Enable RLS
-- ---------------------------------------------------------------------------
alter table public.restaurants enable row level security;
alter table public.menus enable row level security;
alter table public.categories enable row level security;
alter table public.tags enable row level security;
alter table public.products enable row level security;
alter table public.menu_products enable row level security;
alter table public.product_tags enable row level security;
alter table public.owner_restaurants enable row level security;

-- ---------------------------------------------------------------------------
-- owner_restaurants: SELECT own rows only (no client writes)
-- ---------------------------------------------------------------------------
create policy "owner_restaurants_select_own"
on public.owner_restaurants
for select
to authenticated
using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- restaurants
-- ---------------------------------------------------------------------------
create policy "restaurants_select_anon_active"
on public.restaurants
for select
to anon
using (active = true);

create policy "restaurants_select_authenticated"
on public.restaurants
for select
to authenticated
using (
  active = true
  or (select public.is_restaurant_owner(id))
);

create policy "restaurants_update_owner"
on public.restaurants
for update
to authenticated
using ((select public.is_restaurant_owner(id)))
with check ((select public.is_restaurant_owner(id)));

create policy "restaurants_delete_owner"
on public.restaurants
for delete
to authenticated
using ((select public.is_restaurant_owner(id)));

-- ---------------------------------------------------------------------------
-- menus
-- ---------------------------------------------------------------------------
create policy "menus_select_anon_active"
on public.menus
for select
to anon
using (
  active = true
  and exists (
    select 1 from public.restaurants r
    where r.id = restaurant_id and r.active = true
  )
);

create policy "menus_select_authenticated"
on public.menus
for select
to authenticated
using (
  (select public.is_restaurant_owner(restaurant_id))
  or (
    active = true
    and exists (
      select 1 from public.restaurants r
      where r.id = restaurant_id and r.active = true
    )
  )
);

create policy "menus_insert_owner"
on public.menus
for insert
to authenticated
with check ((select public.is_restaurant_owner(restaurant_id)));

create policy "menus_update_owner"
on public.menus
for update
to authenticated
using ((select public.is_restaurant_owner(restaurant_id)))
with check ((select public.is_restaurant_owner(restaurant_id)));

create policy "menus_delete_owner"
on public.menus
for delete
to authenticated
using ((select public.is_restaurant_owner(restaurant_id)));

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------
create policy "categories_select_anon_active"
on public.categories
for select
to anon
using (
  active = true
  and exists (
    select 1 from public.restaurants r
    where r.id = restaurant_id and r.active = true
  )
);

create policy "categories_select_authenticated"
on public.categories
for select
to authenticated
using (
  (select public.is_restaurant_owner(restaurant_id))
  or (
    active = true
    and exists (
      select 1 from public.restaurants r
      where r.id = restaurant_id and r.active = true
    )
  )
);

create policy "categories_insert_owner"
on public.categories
for insert
to authenticated
with check ((select public.is_restaurant_owner(restaurant_id)));

create policy "categories_update_owner"
on public.categories
for update
to authenticated
using ((select public.is_restaurant_owner(restaurant_id)))
with check ((select public.is_restaurant_owner(restaurant_id)));

create policy "categories_delete_owner"
on public.categories
for delete
to authenticated
using ((select public.is_restaurant_owner(restaurant_id)));

-- ---------------------------------------------------------------------------
-- tags
-- ---------------------------------------------------------------------------
create policy "tags_select_anon_active"
on public.tags
for select
to anon
using (
  active = true
  and exists (
    select 1 from public.restaurants r
    where r.id = restaurant_id and r.active = true
  )
);

create policy "tags_select_authenticated"
on public.tags
for select
to authenticated
using (
  (select public.is_restaurant_owner(restaurant_id))
  or (
    active = true
    and exists (
      select 1 from public.restaurants r
      where r.id = restaurant_id and r.active = true
    )
  )
);

create policy "tags_insert_owner"
on public.tags
for insert
to authenticated
with check ((select public.is_restaurant_owner(restaurant_id)));

create policy "tags_update_owner"
on public.tags
for update
to authenticated
using ((select public.is_restaurant_owner(restaurant_id)))
with check ((select public.is_restaurant_owner(restaurant_id)));

create policy "tags_delete_owner"
on public.tags
for delete
to authenticated
using ((select public.is_restaurant_owner(restaurant_id)));

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
create policy "products_select_anon_active"
on public.products
for select
to anon
using (
  active = true
  and exists (
    select 1 from public.restaurants r
    where r.id = restaurant_id and r.active = true
  )
);

create policy "products_select_authenticated"
on public.products
for select
to authenticated
using (
  (select public.is_restaurant_owner(restaurant_id))
  or (
    active = true
    and exists (
      select 1 from public.restaurants r
      where r.id = restaurant_id and r.active = true
    )
  )
);

create policy "products_insert_owner"
on public.products
for insert
to authenticated
with check ((select public.is_restaurant_owner(restaurant_id)));

create policy "products_update_owner"
on public.products
for update
to authenticated
using ((select public.is_restaurant_owner(restaurant_id)))
with check ((select public.is_restaurant_owner(restaurant_id)));

create policy "products_delete_owner"
on public.products
for delete
to authenticated
using ((select public.is_restaurant_owner(restaurant_id)));

-- ---------------------------------------------------------------------------
-- menu_products (junction — no active flag)
-- ---------------------------------------------------------------------------
create policy "menu_products_select_anon_active"
on public.menu_products
for select
to anon
using (
  exists (
    select 1 from public.restaurants r
    where r.id = restaurant_id and r.active = true
  )
);

create policy "menu_products_select_authenticated"
on public.menu_products
for select
to authenticated
using (
  (select public.is_restaurant_owner(restaurant_id))
  or exists (
    select 1 from public.restaurants r
    where r.id = restaurant_id and r.active = true
  )
);

create policy "menu_products_insert_owner"
on public.menu_products
for insert
to authenticated
with check ((select public.is_restaurant_owner(restaurant_id)));

create policy "menu_products_update_owner"
on public.menu_products
for update
to authenticated
using ((select public.is_restaurant_owner(restaurant_id)))
with check ((select public.is_restaurant_owner(restaurant_id)));

create policy "menu_products_delete_owner"
on public.menu_products
for delete
to authenticated
using ((select public.is_restaurant_owner(restaurant_id)));

-- ---------------------------------------------------------------------------
-- product_tags (junction — no active flag)
-- ---------------------------------------------------------------------------
create policy "product_tags_select_anon_active"
on public.product_tags
for select
to anon
using (
  exists (
    select 1 from public.restaurants r
    where r.id = restaurant_id and r.active = true
  )
);

create policy "product_tags_select_authenticated"
on public.product_tags
for select
to authenticated
using (
  (select public.is_restaurant_owner(restaurant_id))
  or exists (
    select 1 from public.restaurants r
    where r.id = restaurant_id and r.active = true
  )
);

create policy "product_tags_insert_owner"
on public.product_tags
for insert
to authenticated
with check ((select public.is_restaurant_owner(restaurant_id)));

create policy "product_tags_update_owner"
on public.product_tags
for update
to authenticated
using ((select public.is_restaurant_owner(restaurant_id)))
with check ((select public.is_restaurant_owner(restaurant_id)));

create policy "product_tags_delete_owner"
on public.product_tags
for delete
to authenticated
using ((select public.is_restaurant_owner(restaurant_id)));
