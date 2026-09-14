# ATHLON Admin Panel Design

## 1. Purpose and scope

Build a Russian-language, protected administration area inside the existing Angular SSR application. One `ADMIN` user manages catalog products, categories, brands, translations, media, prices, availability, publication state, merchandising flags, and display order.

The scope includes login, logout, dashboard, searchable and filterable product management, complete CRUD flows, validation, draft preview, pagination, and destructive-action confirmation. Customer accounts, roles beyond `ADMIN`, inventory transactions, cart, checkout, orders, and payments remain out of scope.

## 2. Architecture decision

The admin UI is a lazy-loaded route tree in `apps/web` under `/admin`. It uses standalone Angular components, signals, reactive forms, and focused SCSS components. No separate admin application and no additional component framework are introduced.

This keeps one deployment while preserving bundle isolation: public routes do not import admin components. NestJS remains the only authorization and persistence boundary. Client guards improve navigation but never replace server guards.

## 3. Routes and navigation

```text
/admin/login                 login screen
/admin                       protected dashboard
/admin/products              protected product list
/admin/products/new          protected product create form
/admin/products/:id/edit     protected product edit form
/admin/categories            protected category CRUD
/admin/brands                protected brand CRUD
/admin/**                    protected admin not-found screen
```

The admin shell contains the ATHLON mark, links to Dashboard, Products, Categories, and Brands, a link to the public catalog, the signed-in email, and logout. On narrow screens navigation collapses into an accessible menu.

## 4. Authentication and request security

- Authentication continues to use server-issued `httpOnly` access and refresh cookies.
- Login posts email and password with `withCredentials`; credentials are never stored in browser storage.
- The readable CSRF cookie is copied into `X-CSRF-Token` only for same-origin state-changing admin requests.
- A functional interceptor handles one access-token expiry by calling refresh once, then retries the original request. It never loops and never retries login or refresh.
- The route guard checks `/admin/auth/me`. Unauthorized users are redirected to `/admin/login` with a safe relative return URL.
- A successful login redirects only to an allowlisted `/admin...` path.
- Logout revokes the refresh session, clears client session state, and returns to login.
- All administrative API endpoints remain protected by `AdminAuthGuard`; all state-changing endpoints additionally require `CsrfGuard`.
- Login throttling, strict DTO validation, Helmet, CORS allowlisting, secure production cookies, and non-disclosure of tokens remain backend responsibilities.

## 5. Backend additions

Existing auth, product, category, brand, and media CRUD endpoints are retained. The backend adds:

```text
GET /api/v1/admin/dashboard
GET /api/v1/admin/products?page=&pageSize=&q=&category=&brand=&availability=&published=&featured=&isNew=&sort=
```

Dashboard returns product, category, brand, published, and unpublished counts. Product list filtering and sorting use DTO allowlists and bounded pagination; unexpected query fields are rejected by global validation.

Admin category and brand responses include translations. Product detail includes translations and ordered images with translated alt text. Mutations return normalized records suitable for refreshing the UI.

## 6. Frontend modules

```text
core/admin-api/       typed admin models and HTTP service
core/auth/            session store, guard, CSRF/refresh interceptor
layout/admin-shell/   protected navigation and logout
features/admin/login/
features/admin/dashboard/
features/admin/products/
features/admin/categories/
features/admin/brands/
shared/admin/         form errors, confirmation dialog, pagination, status UI
```

Files remain small and feature-oriented. Product list, editor, translation fields, image manager, and preview are separate components with explicit inputs and outputs.

## 7. Product list

The product list is URL-driven. It supports text search by SKU, slug, and translated name; category, brand, availability, publication, featured, and new filters; display-order, update-time, and name sorting; and bounded pagination.

Desktop uses a semantic table. Mobile uses the same data rendered as stacked cards. Loading, empty, validation, authorization, and retry states are explicit. Changing a filter resets the page and cancels stale HTTP requests.

Rows expose edit, preview, publish/unpublish, and delete actions. Delete always requires a confirmation dialog naming the product.

## 8. Product editor

The editor contains:

- SKU and unique slug.
- Category and optional brand.
- Nullable non-negative AMD price.
- Availability enum: in stock, out of stock, preorder, or on request.
- Published, featured, and isNew toggles.
- Non-negative integer display order.
- Characteristics as validated JSON object text.
- Fixed HY, RU, and EN translation tabs for name, short description, full description, SEO title, and SEO description.

Russian name is required; HY and EN tabs visibly indicate missing translations but may be saved empty to support staged content entry. Server validation errors are mapped to the corresponding control. Duplicate SKU/slug errors are shown without losing entered data.

Preview is a side panel generated from current unsaved form values and selected image. It resembles the public product card/detail hierarchy and clearly labels the content as a draft. It does not publish, persist, or expose an unpublished item through the public API.

## 9. Media workflow

Images are managed after the product record exists. Upload accepts one JPEG, PNG, or WebP file up to the configured 5 MB limit. The UI validates extension, browser MIME, and size for immediate feedback; the API remains authoritative and validates actual image content with Sharp.

The media manager supports upload progress state, thumbnail preview, translated alt text for HY/RU/EN, primary-image selection, move earlier/later ordering, and deletion confirmation. Reordering sends the complete ordered ID/position list. Media URLs always come from API storage keys; local workstation paths are never persisted.

## 10. Category and brand management

Categories support create, edit, publish state, parent selection, display order, and HY/RU/EN translations. The existing rule limiting top-level categories to two remains enforced by the API. A category cannot select itself as parent in the UI; backend integrity errors are displayed clearly.

Brands support create, edit, publish state, stable slug, internal name, optional logo key, and HY/RU/EN translations. Both screens provide local text search, stable sorting, and confirmation before delete. Referential-integrity conflicts do not cascade silently; the UI explains that linked products or children must be reassigned first.

## 11. Validation and errors

Reactive forms mirror backend constraints without treating client validation as security. Required fields, email format, slug pattern, integer ranges, decimal price, translation lengths, JSON object shape, file type, and file size receive inline messages.

The admin API client normalizes the existing error envelope into authorization, field-validation, conflict, not-found, and retryable transport errors. Forms retain user input on errors. A `401` after failed refresh ends the session. A `403` CSRF failure is never retried automatically.

## 12. Accessibility and responsive behavior

- Every control has an associated label and inline error relation.
- Dialog focus is trapped, starts on the safe action, closes with Escape, and returns to its trigger.
- Tabs, menus, image ordering, filters, and pagination are keyboard-operable.
- Status changes and save results use a polite live region; destructive failures use an assertive alert.
- Color is never the only indication of validation, publication, or missing translation state.
- Touch targets are at least 44 px where practical, and no page introduces horizontal viewport overflow at 390 px.

## 13. Testing and verification

Backend e2e tests cover dashboard authorization, admin product filters and pagination, rejected unknown query values, CSRF enforcement, inactive/invalid sessions, upload authentication, MIME/content mismatch, oversize files, image ownership, and path traversal.

Angular tests cover login, protected redirects, one-time refresh, CSRF headers, dashboard rendering, URL-driven product filters, product validation and payload mapping, draft preview, CRUD success/error states, confirmation before delete, translations, and media validation.

Browser checks cover desktop and 390 px login, dashboard, product list, editor, preview, and keyboard-visible confirmation states. Final verification runs formatting, Prisma validation, TypeScript, lint, Angular tests, NestJS e2e tests, and production builds.

## 14. Acceptance criteria

- Anonymous users cannot access protected admin UI or API records.
- An administrator can log in, refresh a session, log out, and manage the complete catalog.
- Products, categories, and brands support create, read/list, update, and confirmed delete flows.
- Product translations, images, price, availability, publication, featured, isNew, characteristics, and display order are editable.
- Product search, filters, sort, pagination, and draft preview work without exposing drafts publicly.
- File validation and authorization remain server-enforced.
- Admin pages work on desktop and mobile and meet the stated keyboard and labeling requirements.
- Tests, lint, type checks, Prisma validation, and production builds pass with no cart, checkout, orders, or customer-account code added.
