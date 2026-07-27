import { auth } from "./auth";
import { categories } from "./categories";
import { menus } from "./menus";
import { products } from "./products";
import { restaurant } from "./restaurant";
import { tags } from "./tags";

export const server = {
	auth,
	restaurant,
	menus,
	categories,
	tags,
	products,
};
