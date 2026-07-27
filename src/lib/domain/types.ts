/** Domain row shapes — match docs/schema.md (English Postgres columns). */

export type JsonObject = Record<string, unknown>;

export type Restaurant = {
	id: string;
	slug: string;
	name: string;
	description: string | null;
	active: boolean;
	brand: JsonObject;
	theme: JsonObject;
	logo_light_url: string | null;
	logo_dark_url: string | null;
	created_at: string;
	updated_at: string;
};

export type RestaurantUpdate = Partial<
	Pick<
		Restaurant,
		| "slug"
		| "name"
		| "description"
		| "active"
		| "brand"
		| "theme"
		| "logo_light_url"
		| "logo_dark_url"
	>
>;

export type Menu = {
	id: string;
	restaurant_id: string;
	slug: string;
	name: string;
	description: string | null;
	sort_order: number;
	template: string;
	icon: string | null;
	active: boolean;
	created_at: string;
	updated_at: string;
};

export type MenuInsert = {
	restaurant_id: string;
	slug: string;
	name: string;
	description?: string | null;
	sort_order?: number;
	template?: string;
	icon?: string | null;
	active?: boolean;
};

export type MenuUpdate = Partial<Omit<MenuInsert, "restaurant_id">>;

export type Category = {
	id: string;
	restaurant_id: string;
	slug: string;
	name: string;
	icon: string | null;
	sort_order: number;
	cover_url: string | null;
	active: boolean;
	created_at: string;
	updated_at: string;
};

export type CategoryInsert = {
	restaurant_id: string;
	slug: string;
	name: string;
	icon?: string | null;
	sort_order?: number;
	cover_url?: string | null;
	active?: boolean;
};

export type CategoryUpdate = Partial<Omit<CategoryInsert, "restaurant_id">>;

export type Tag = {
	id: string;
	restaurant_id: string;
	slug: string;
	name: string;
	icon: string | null;
	active: boolean;
	created_at: string;
	updated_at: string;
};

export type TagInsert = {
	restaurant_id: string;
	slug: string;
	name: string;
	icon?: string | null;
	active?: boolean;
};

export type TagUpdate = Partial<Omit<TagInsert, "restaurant_id">>;

export type Product = {
	id: string;
	restaurant_id: string;
	slug: string;
	name: string;
	description: string | null;
	/** Postgres numeric(12,2); normalized to number in db layer. */
	price: number;
	category_id: string | null;
	image_url: string | null;
	active: boolean;
	available: boolean;
	created_at: string;
	updated_at: string;
};

export type ProductInsert = {
	restaurant_id: string;
	slug: string;
	name: string;
	description?: string | null;
	price?: number;
	category_id?: string | null;
	image_url?: string | null;
	active?: boolean;
	available?: boolean;
};

export type ProductUpdate = Partial<Omit<ProductInsert, "restaurant_id">>;

export type MenuProduct = {
	menu_id: string;
	product_id: string;
	restaurant_id: string;
	sort_order: number;
};

export type ProductTag = {
	product_id: string;
	tag_id: string;
	restaurant_id: string;
};

export type OwnerRestaurant = {
	user_id: string;
	restaurant_id: string;
	created_at: string;
};
