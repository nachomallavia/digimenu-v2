# `lib/client/menu`

Browser-only public menu runtime for `/m/*`.

## Now (DIG-24)

DOM + `data-*` client ([`public-menu.ts`](./public-menu.ts)): filters, multi-menu History API, section/product visibility.

```ts
import { bootPublicMenus } from "@/lib/client/menu";
bootPublicMenus();
```

Must not import `lib/server/*`. Membership helpers live in [`membership.ts`](./membership.ts).

## Later (Nanostores)

Nanostores was intended as an in-memory catalog interface (load all menu products once) to ease category/tag/search filtering. Not required for Classic parity — optional upgrade after DOM client is stable.
