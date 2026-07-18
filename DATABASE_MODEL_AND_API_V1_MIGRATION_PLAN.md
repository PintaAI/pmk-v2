# Database Model and API v1 Migration Plan

## 1. Purpose

This document is the implementation plan for:

1. Migrating the current Prisma schema to a balanced, scalable domain model.
2. Preserving all production data and existing application behavior.
3. Consolidating duplicated catalog, order, production, and inventory concepts.
4. Introducing `/api/v1` Route Handlers that expose all current application capabilities.
5. Making Server Components, Server Actions, and API handlers reuse the same domain services.

This is a migration plan, not approval to run destructive production migrations. Every contract/drop step requires a verified backup and explicit production approval.

## 2. Decisions

These decisions are treated as the implementation baseline:

- Keep `User`, `Session`, `Account`, and `Verification` under Better Auth.
- Keep `Toko` and `TokoUser` names in the database for now. API resources use `stores` and `members`.
- Merge `Bahan` and `Product` into `Item`, distinguished by `ItemType.MATERIAL` and `ItemType.PRODUCT`.
- Move mutable quantity and average cost into a one-to-one `StockBalance` row.
- Rename `BahanUnitConversion` to `ItemUnitConversion` and retain unit conversion support.
- Keep `PriceTier`; replace `ProductPrice` with `ItemPrice`, restricted by service validation to product items.
- Keep purchases as a dedicated `Purchase`/`PurchaseLine` aggregate.
- Merge `Sale` and `Pesanan` into `Order`/`OrderLine`.
- A cashier checkout creates and posts an order immediately. A saved customer order is posted only when completed.
- Merge production input/output tables into `ProductionLine` with `INPUT` or `OUTPUT` direction.
- Keep one immutable `StockMovement` ledger with signed quantities.
- Keep `StockBalance` as the fast read model and update it atomically with the ledger.
- Never edit or delete posted movements. Cancellation creates reversal movements.
- Preserve the three operational modes and their current behavior.
- Keep browser Better Auth endpoints under `/api/auth/*`; do not duplicate password/session protocols in `/api/v1`.
- Server Components must call query/domain services directly, not make HTTP calls to the application's own API.
- Use explicit Route Handler files under `app/api/v1`; do not create one catch-all business router.

## 3. Current Capability Inventory

### Application surfaces

| Surface | Current capabilities | Primary files |
|---|---|---|
| Authentication | Sign up, sign in, session, sign out, password change | `app/api/auth/[...all]/route.ts`, `lib/auth.ts`, `components/auth-card.tsx`, `app/actions/profile.ts` |
| Store | Create store, view/update profile, logos, address, phone, operational mode, reset operational data | `app/actions/toko-actions.ts`, `components/settings/toko-section.tsx`, `components/providers/toko-provider.tsx` |
| Staff | List, add by existing email, remove staff; owner protection | `app/actions/toko-actions.ts`, `components/settings/staff-section.tsx` |
| Materials | Create/update/delete material, stock/cost initialization, custom units | `app/actions/bahan-actions.ts`, `components/inventory/create-bahan-drawer.tsx` |
| Products | Create/update/archive products, private image upload, multi-tier prices | `app/actions/product-actions.ts`, `components/production/create-product-drawer.tsx`, `components/production/edit-product-drawer.tsx` |
| Price tiers | List/create/remove tiers and bulk percentage adjustment | `app/actions/price-tier-actions.ts`, `components/settings/price-tier-section.tsx` |
| Purchases | Simple total-only purchase or detailed material purchase; weighted average cost and stock receipt | `app/actions/belanja-actions.ts`, `server/services/belanja-service.ts`, `components/inventory/create-belanja-drawer.tsx` |
| Production | Simple product output or full material-input/product-output production | `app/actions/production-actions.ts`, `server/services/production-service.ts`, `components/production/create-production-drawer.tsx` |
| Cashier | Product catalog, price tiers, local cart/cache, checkout, customer, delivery fee, payment method, receipt | `app/(retail)/cashier/page.tsx`, `app/actions/cashier-actions.ts`, `server/services/sales-service.ts` |
| Customer orders | Create/save cart, payment and delivery statuses, cancel, convert to sale | `app/actions/pesanan-actions.ts`, `server/services/pesanan-service.ts`, `components/pesanan/*` |
| Inventory | Current material/product balances, recent movements, stock validation | `server/services/inventory-service.ts`, inventory and production pages |
| Closing | Daily Jakarta recap, payment/channel breakdown, top items, audit print | `app/actions/closing-actions.ts`, `components/closing/*`, `lib/escpos-print.ts` |
| Reports | Revenue, expense, profit, channel, product, monthly and daily analytics | `lib/analytics.ts`, `app/(retail)/reports/page.tsx` |
| Dashboard | 30-day metrics, pending orders, recent activity, mode-aware shortcuts | `app/(retail)/page.tsx`, `components/home/*` |
| Images | Private Blob uploads and image proxying | product/store actions, `app/api/product-image/route.ts`, `app/api/toko-image/route.ts`, image hooks |
| Super admin | Global/store metrics, password reset, force-delete user/store | `app/super-admin/page.tsx`, `app/actions/super-admin-actions.ts`, `components/super-admin/*` |
| Printing | Browser and native Bluetooth sales/closing receipts | `components/checkout/*`, `components/closing/*`, `components/printer/*`, `lib/escpos-print.ts` |

### Operational mode behavior that must not regress

| Mode | Required behavior |
|---|---|
| `CASHIER_ONLY` | Product/menu and prices are available; checkout does not validate or mutate stock; inventory-heavy shortcuts are hidden. |
| `SIMPLE_INVENTORY` | Purchases may be total-only; production records product outputs without material inputs; sales and product balances remain tracked. |
| `WITH_INVENTORY` | Detailed material purchases, material consumption, product production, sales stock deductions, and insufficient-stock validation are active. |

## 4. Target Data Model

### Tenant and authentication

- `User`, `Session`, `Account`, `Verification`: unchanged and owned by Better Auth.
- `Toko`: retain profile, logo, receipt logo, address, phone, and `operationalMode`.
- `TokoUser`: retain `OWNER`/`STAFF`, unique `(tokoId, userId)`, and user lookup index.

### Catalog and inventory

#### `Item`

| Field | Notes |
|---|---|
| `id` | CUID; preserve old material/product IDs. |
| `tokoId` | Required tenant root. |
| `type` | `MATERIAL` or `PRODUCT`. |
| `name` | Required. |
| `unit`, `unitKind`, `baseUnit` | Retain current material unit behavior; products default to count/`pcs`. |
| `imageUrl` | Primarily products, nullable for materials. |
| `isActive` | Soft-delete/archive switch for both types. |
| timestamps | `createdAt`, `updatedAt`. |

Constraints and indexes:

- Index `(tokoId, type, isActive, name)`.
- Do not require globally unique names.
- Never cascade-delete an item referenced by historical documents.

#### `StockBalance`

- `itemId` primary key and one-to-one FK to `Item`.
- `quantity Decimal(14,3)`.
- `averageCost Decimal(14,2)`.
- `version Int` for optimistic concurrency/diagnostics.
- `updatedAt`.
- Balance changes only through inventory posting services.

#### `ItemUnitConversion`

- `id`, `itemId`, `unit`, `factor`, `createdAt`.
- Unique `(itemId, unit)`.
- Service validation prevents conversion to incompatible unit dimensions.

#### `PriceTier` and `ItemPrice`

- Retain store-scoped tier code, ordering, default, and active status.
- `ItemPrice(itemId, priceTierId, price)` with unique `(itemId, priceTierId)`.
- Service validation allows prices only for `Item.type = PRODUCT` and ensures both records belong to the same store.
- `OrderLine` retains price-tier and price snapshots so historical orders survive tier edits/deletion.

### Purchases

#### `Purchase`

- `id`, `tokoId`, `number`, `date`, `supplier`, `note`, `status`, `totalAmount`, `createdById`, timestamps.
- Unique `(tokoId, number)` and index `(tokoId, date, status)`.
- Preserve total-only records for simple inventory mode.

#### `PurchaseLine`

- `id`, `purchaseId`, `itemId`, `itemName`, `quantity`, `unit`, `unitCost`, `subtotal`.
- Item name/unit are snapshots.
- Only material items are accepted in detailed purchase posting.

### Production

#### `Production`

- Retain `id`, `tokoId`, `date`, `note`, `status`, `createdById`, timestamps.
- Add `postedAt` and `reversedAt` to make inventory effects explicit.
- Index `(tokoId, date, status)`.

#### `ProductionLine`

- `id`, `productionId`, `itemId`, `itemName`, `lineType`, `quantity`, `unit`, optional `unitCost`.
- `lineType`: `INPUT` or `OUTPUT`; quantity remains positive.
- Full mode requires at least one input and one output.
- Simple mode requires output and permits no input.

### Orders

#### `Order`

- `id`, `tokoId`, `number`, `source`, optional `channel`, `status`, `paymentStatus`, `fulfillmentStatus`.
- Customer name/contact, note, payment method, subtotal, discount, delivery fee, total, paid amount.
- `tracksInventory` snapshots operational behavior at posting time.
- `postedAt` indicates that financial/inventory effects were committed.
- `cancelledAt`, `createdById`, timestamps.
- Unique `(tokoId, number)`.
- Indexes `(tokoId, createdAt)`, `(tokoId, status, createdAt)`, `(tokoId, paymentStatus, fulfillmentStatus)` and `(tokoId, channel, createdAt)`.

Enums:

- `OrderSource`: `CASHIER`, `MANUAL`.
- `SaleChannel`: retain `CASHIER`, `RESELLER`, `ONLINE`; nullable until a manual order is completed.
- `OrderStatus`: `DRAFT`, `CONFIRMED`, `COMPLETED`, `CANCELLED`.
- `PaymentStatus`: `UNPAID`, `PARTIALLY_PAID`, `PAID`, `REFUNDED`.
- `FulfillmentStatus`: `UNFULFILLED`, `PROCESSING`, `READY`, `SHIPPED`, `FULFILLED`, `CANCELLED`.
- `PaymentMethod`: `CASH`, `QRIS`, `TRANSFER`, `EWALLET`, `OTHER`.

#### `OrderLine`

- `id`, `orderId`, `itemId`.
- Snapshot `itemName`, `priceTierId`, `priceTierCode`, `priceTierName`.
- `quantity`, `unit`, `unitPrice`, `subtotal`.
- Only product items can be ordered.

State rules:

- Cashier checkout creates `COMPLETED` + `PAID` + `FULFILLED` and posts once.
- Saving a cart creates `CONFIRMED` + `UNPAID` + `UNFULFILLED` without stock effects.
- Completing a manual order sets channel/payment/fulfillment data and posts the same order. It must not create a second sale record.
- A posted order cannot be edited. Cancellation posts reversal movements and changes statuses.

### Stock ledger

#### `StockMovement`

- `id`, `tokoId`, `itemId`, signed `quantity`, `movementType`, optional `unitCost`/`unitPrice`.
- `sourceType`, `sourceId`, optional `sourceLineId`, `dedupeKey` unique.
- `reversalOfId` self-reference for reversals.
- `createdById`, `note`, `createdAt`.
- Index `(tokoId, itemId, createdAt, id)` for cursor pagination.
- Index `(sourceType, sourceId)` for document traceability.
- Movement types include opening balance, purchase, production input/output, sale, adjustment, and reversal.

The signed quantity is authoritative for direction. API responses may also expose computed `direction` for readability.

### Audit

- Retain `ActivityLog` with store, actor, action, entity type/id, metadata, and timestamp.
- Add `(tokoId, createdAt, id)` for cursor pagination.
- Do not use activity logs as the only source of business state.

## 5. Domain and Code Architecture

Introduce transport-independent modules:

```text
server/domain/
  stores/
  items/
  pricing/
  purchases/
  production/
  orders/
  inventory/
  reports/
  closing/
  admin/
server/api/
  auth-context.ts
  errors.ts
  response.ts
  pagination.ts
  idempotency.ts
  validation.ts
```

Rules:

- Domain services receive explicit `{ actorId, tokoId, role }`; they never infer tenancy from request globals.
- Route handlers and Server Actions resolve auth/tenant context and call the same domain service.
- Query services return DTOs with numbers/dates serialized intentionally, never raw Prisma records.
- Prisma enums/types must not be imported into client components. Define UI/API DTO enums in shared application types.
- All mutations validate item/store ownership inside the transaction.
- Posting functions own document creation/update, ledger rows, balance updates, and audit logs in one transaction.
- Use a common error taxonomy: validation, unauthenticated, forbidden, not found, conflict, insufficient stock, idempotency conflict, and internal.

## 6. API v1 Contract

### Conventions

- Base path: `/api/v1`.
- Keep Better Auth at `/api/auth/*` for sign-up, sign-in, sign-out, session, and password operations.
- Authentication: Better Auth session cookie for v1. Bearer/API-token support is deferred until a token model and revocation policy are designed.
- Tenant path: store-scoped resources live under `/api/v1/stores/{storeId}`. Every request verifies membership.
- OWNER-only: store update/reset, member management, destructive catalog actions, pricing administration.
- STAFF: operational reads and transaction creation/status transitions unless noted otherwise.
- Super admin: email allowlist plus authenticated session, matching existing behavior.
- JSON decimals are strings; timestamps are ISO-8601 UTC; UI applies Jakarta presentation timezone.
- List endpoints use `limit` (default 50, max 100) and opaque `cursor`; responses include `meta.nextCursor`.
- Mutating/posting endpoints accept `Idempotency-Key`; the same key and payload returns the original result, while a changed payload returns `409`.
- Success envelope: `{ "data": ..., "meta": { ... } }`.
- Error envelope: `{ "error": { "code", "message", "details?", "requestId" } }`.
- Database-backed GET handlers remain dynamic and private; no shared HTTP cache.
- Dynamic route handlers use the Next.js 16 async `RouteContext` params convention.

### Session and profile

| Method | Path | Access | Capability |
|---|---|---|---|
| GET | `/api/v1/me` | Authenticated | Current profile, memberships, selected/default store. |
| PATCH | `/api/v1/me` | Authenticated | Update name and profile image. |
| GET | `/api/v1/me/sessions` | Authenticated | Delegate/use Better Auth session capability where supported. |

Password change, sign-in/out, and registration remain Better Auth operations under `/api/auth/*`.

### Stores and members

| Method | Path | Access | Capability |
|---|---|---|---|
| GET/POST | `/api/v1/stores` | Authenticated | List memberships; create one owned store subject to current ownership rule. |
| GET/PATCH | `/api/v1/stores/{storeId}` | Member / OWNER mutate | Read/update profile and operational mode. |
| POST | `/api/v1/stores/{storeId}/reset` | OWNER | Reset operational data after explicit confirmation. |
| GET/POST | `/api/v1/stores/{storeId}/members` | OWNER | List/add an existing account by email. |
| DELETE | `/api/v1/stores/{storeId}/members/{memberId}` | OWNER | Remove non-owner staff. |
| POST | `/api/v1/stores/{storeId}/images` | OWNER | Upload `logo` or `receiptLogo`, validated to 2 MB JPG/PNG/WebP. |

### Items, units, and prices

| Method | Path | Access | Capability |
|---|---|---|---|
| GET/POST | `/api/v1/stores/{storeId}/items` | Member / OWNER or STAFF create | Filter by type, active state, search; create material/product. |
| GET/PATCH | `/api/v1/stores/{storeId}/items/{itemId}` | Member / OWNER or STAFF mutate | Read/update catalog metadata without direct balance edits. |
| DELETE | `/api/v1/stores/{storeId}/items/{itemId}` | OWNER | Hard-delete only if never referenced; otherwise return `409` and require archive. |
| POST | `/api/v1/stores/{storeId}/items/{itemId}/archive` | OWNER | Set inactive while preserving history. |
| PUT | `/api/v1/stores/{storeId}/items/{itemId}/unit-conversions` | OWNER/STAFF | Replace validated conversion set atomically. |
| POST | `/api/v1/stores/{storeId}/items/{itemId}/image` | OWNER/STAFF | Upload/replace product image. |
| GET/POST | `/api/v1/stores/{storeId}/price-tiers` | Member / OWNER mutate | List/create tiers. |
| DELETE | `/api/v1/stores/{storeId}/price-tiers/{tierId}` | OWNER | Remove tier while preserving line snapshots. |
| POST | `/api/v1/stores/{storeId}/price-tiers/{tierId}/adjustment` | OWNER | Apply percentage price adjustment. |
| PUT | `/api/v1/stores/{storeId}/items/{itemId}/prices` | OWNER/STAFF | Replace/upsert item prices by tier. |

### Purchases and production

| Method | Path | Access | Capability |
|---|---|---|---|
| GET/POST | `/api/v1/stores/{storeId}/purchases` | Member | Cursor list/filter; create and post simple or detailed purchase. |
| GET | `/api/v1/stores/{storeId}/purchases/{purchaseId}` | Member | Detail with line snapshots and movement references. |
| GET/POST | `/api/v1/stores/{storeId}/productions` | Member | Cursor list/filter; create and post production. |
| GET | `/api/v1/stores/{storeId}/productions/{productionId}` | Member | Detail with unified input/output lines. |
| POST | `/api/v1/stores/{storeId}/productions/{productionId}/cancel` | OWNER | Future-safe reversal operation; implement only when matching UI is approved. |

The production cancellation endpoint is documented as deferred because the current UI does not expose cancellation.

### Orders and cashier

| Method | Path | Access | Capability |
|---|---|---|---|
| GET/POST | `/api/v1/stores/{storeId}/orders` | Member | List/filter and create manual customer order. |
| GET | `/api/v1/stores/{storeId}/orders/{orderId}` | Member | Full order and line snapshots. |
| POST | `/api/v1/stores/{storeId}/orders/checkout` | Member | Immediate idempotent cashier checkout/posting. |
| PATCH | `/api/v1/stores/{storeId}/orders/{orderId}/payment` | Member | Transition payment status/amount with state validation. |
| PATCH | `/api/v1/stores/{storeId}/orders/{orderId}/fulfillment` | Member | Transition fulfillment status. |
| POST | `/api/v1/stores/{storeId}/orders/{orderId}/complete` | Member | Complete/post the existing manual order exactly once. |
| POST | `/api/v1/stores/{storeId}/orders/{orderId}/cancel` | Member; OWNER if posted | Cancel unposted order or reverse posted order. |

Filters include status, payment status, fulfillment status, source, channel, date range, and customer search.

### Inventory, dashboard, reports, and closing

| Method | Path | Access | Capability |
|---|---|---|---|
| GET | `/api/v1/stores/{storeId}/inventory/balances` | Member | Item balances filtered by item type/search/active state. |
| GET | `/api/v1/stores/{storeId}/inventory/movements` | Member | Cursor ledger by item, movement/source type, and date range. |
| POST | `/api/v1/stores/{storeId}/inventory/adjustments` | OWNER | Idempotent signed adjustment with mandatory reason. |
| GET | `/api/v1/stores/{storeId}/dashboard` | Member | Current 30-day summary, pending orders, and recent activity. |
| GET | `/api/v1/stores/{storeId}/reports/analytics` | Member | Summary/month/day/channel/product analytics with date filters. |
| GET | `/api/v1/stores/{storeId}/closing/daily` | Member | Jakarta daily closing recap; accepts an explicit date. |
| POST | `/api/v1/stores/{storeId}/closing/daily/print-events` | Member | Record closing print activity. |
| GET | `/api/v1/stores/{storeId}/activity` | OWNER | Cursor-paginated audit log. |

Inventory adjustment is a target-model capability and should be implemented together with its API test even though no current UI exists.

### Media

| Method | Path | Access | Capability |
|---|---|---|---|
| GET | `/api/v1/media/{mediaId}` | Authorized member or signed URL | Stream a known stored object. |

Replace arbitrary `?url=` proxying. Never fetch a caller-provided URL, because the existing image proxy pattern can become an SSRF/data-exposure boundary. Resolve media only from a stored item/store reference or signed identifier.

### Super admin

| Method | Path | Access | Capability |
|---|---|---|---|
| GET | `/api/v1/admin/summary` | Super admin | Global and per-store performance summary. |
| GET | `/api/v1/admin/users` | Super admin | Users and store memberships. |
| GET | `/api/v1/admin/stores` | Super admin | Stores, modes, member/product counts, performance. |
| POST | `/api/v1/admin/users/{userId}/password-reset` | Super admin | Reset credential password and revoke sessions. |
| DELETE | `/api/v1/admin/users/{userId}` | Super admin | Force-delete non-protected user and owned stores. |
| DELETE | `/api/v1/admin/stores/{storeId}` | Super admin | Force-delete store after typed confirmation. |

## 7. UI and File Impact Plan

### Direct data-query pages

| File | Required change |
|---|---|
| `app/(retail)/page.tsx` | Replace Sale/Belanja/Pesanan aggregates with dashboard query DTO based on posted orders, purchases, and unified order status. |
| `app/(retail)/inventory/page.tsx` | Query material `Item` + `StockBalance`, `StockMovement`, and `Purchase`; map unified DTOs. |
| `app/(retail)/production/page.tsx` | Query product/material items and balances; map unified `ProductionLine` input/output data. |
| `app/(retail)/pesanan/page.tsx` | Query unposted/manual orders and product item DTOs; rename internal types away from Prisma/Pesanan coupling. Public route label may remain `/pesanan`. |
| `app/(retail)/reports/page.tsx` | Call the new reports query service. |
| `app/super-admin/page.tsx` | Replace Sale/Product/Belanja queries with admin query DTOs. |

### Server Actions

- `bahan-actions.ts`: become thin material-item adapters; initial quantity must post an opening/adjustment movement rather than write balance directly.
- `product-actions.ts`: become product-item adapters and use shared image/catalog services.
- `price-tier-actions.ts`: use pricing service and `ItemPrice`; remove direct raw table update from transport.
- `belanja-actions.ts`: call purchase posting service.
- `production-actions.ts`: translate current form payload into unified lines.
- `cashier-actions.ts`: query product item DTOs and call order checkout service.
- `sale-actions.ts`: remove after all callers use order service, or retain temporarily as a compatibility adapter during cutover.
- `pesanan-actions.ts`: map statuses and completion to one order; `convertToSaleAction` becomes `completeOrder` compatibility behavior.
- `closing-actions.ts`: move recap query and print audit to closing domain service; use explicit payment method.
- `toko-actions.ts`: use store/member/reset services and new deletion order.
- `super-admin-actions.ts`: use admin services and new aggregate deletion policy.
- `profile.ts`: share profile service/validation with `/api/v1/me` while password remains Better Auth.

### Client components requiring DTO/name changes

- Inventory: `components/inventory/create-bahan-drawer.tsx`, `create-belanja-drawer.tsx`, `belanja-history-tab.tsx`, `inventory-tabs.tsx`.
- Production/catalog: `components/production/create-product-drawer.tsx`, `edit-product-drawer.tsx`, `create-production-drawer.tsx`, `production-tabs.tsx`.
- Orders: `components/pesanan/create-pesanan-drawer.tsx`, `pesanan-detail-drawer.tsx`, `pesanan-tabs.tsx`, `components/pesanan/types.ts`.
- Cashier: `app/(retail)/cashier/page.tsx`, `components/cashier/types.ts`, `cashier-card.tsx`, `cart-drawer.tsx`, `components/checkout/checkout-dialog.tsx`, `thermal-receipt.tsx`.
- Closing: `components/closing/closing-dialog.tsx`, `closing-receipt.tsx`, `lib/escpos-print.ts`; use persisted order number and payment method instead of client-generated receipt identity/note parsing.
- Dashboard/navigation: `components/home/home-dashboard.tsx`, `quick-action-drawer.tsx`, `components/layout/bottom-nav.tsx`, `sidebar-content.tsx` only where names/counts change.
- Store/settings: `components/providers/toko-provider.tsx`, `components/settings/toko-section.tsx`, `staff-section.tsx`, `price-tier-section.tsx`.
- Reports/admin: `components/reports/analytics-charts.tsx`, `components/super-admin/store-summary.tsx`, `danger-zone.tsx`, `password-reset-panel.tsx` DTO imports.
- Images: `hooks/use-product-image.ts`, `hooks/use-toko-image.ts` and image-rendering components must switch to restricted media identifiers/URLs.

### Expected unchanged areas

- `components/ui/*` visual primitives.
- Theme/appearance components and local theme storage.
- Bluetooth transport/provider/dialog implementation; only receipt input DTOs change.
- QRIS rendering/settings and bank settings unless payment settings are later persisted server-side.
- Capacitor configuration and native Bluetooth patch script.

## 8. Data Migration Strategy

Use expand, backfill, verify, cut over, and contract. Do not perform a direct rename/drop migration.

### Non-negotiable data-safety rules

- Never run `prisma db push`, `prisma migrate reset`, the destructive seed, or ad-hoc `DROP`/`TRUNCATE` against production.
- Every production migration must use `DIRECT_URL`, identify the expected database/schema before writing, and stop if it does not match the approved environment.
- A Neon branch/restore point is required but is not the only backup. Produce a logical `pg_dump` and prove it can be restored into a scratch database.
- The old tables remain unchanged and queryable during expand/backfill. No old table or column is renamed, made required, or dropped before the rollback window closes.
- Backfill writes use upsert/insert-on-conflict with deterministic keys and can be rerun safely from the beginning.
- No ambiguous legacy record is guessed. Ambiguities are written to a migration report, resolved explicitly, and block cutover.
- Verification has zero tolerance for unexplained missing rows, duplicate business documents, tenant mismatches, or balance differences.

### Current migration-history risk

The repository currently contains only `prisma/migrations/20260621000000_add_simple_inventory_mode/migration.sql`, which adds one enum value. The live database contains the full schema, so the repository does not yet provide a reproducible baseline for an empty database. Fix this before adding the new model:

1. Create a temporary `schema.pre-simple-baseline.prisma` representing the current schema except that `OperationalMode` does not yet contain `SIMPLE_INVENTORY`.
2. Generate `prisma/migrations/20260620000000_baseline/migration.sql` with `npx prisma migrate diff --from-empty --to-schema prisma/schema.pre-simple-baseline.prisma --script --output prisma/migrations/20260620000000_baseline/migration.sql`.
3. Review the generated SQL against the live schema. The baseline must create the full old model and must not contain `SIMPLE_INVENTORY`, because the already-committed `20260621000000_add_simple_inventory_mode` migration adds that value next.
4. Verify an empty scratch PostgreSQL database can be created using `npx prisma migrate deploy`; both migrations must apply in timestamp order and produce a schema matching the current `schema.prisma`.
5. Compare migration output with the rehearsal database using `npx prisma migrate diff --from-migrations prisma/migrations --to-config-datasource --exit-code`; expected result is no difference/exit code `0`.
6. On each existing database, run `npx prisma migrate resolve --applied 20260620000000_baseline` only after confirming the baseline SQL matches objects already present. This records the baseline; it must not execute its create statements.
7. Run `npx prisma migrate status` on scratch, staging/Neon branch, and production and save the output in the migration evidence.
8. Remove the temporary pre-simple schema after the reviewed baseline SQL is committed, or retain it under migration fixtures if CI uses it for reproducibility tests.
9. Do not create the expand migration until this baseline is committed and reproducibility is proven in CI.

The exact Prisma commands must be tested against the pinned Prisma 7 CLI on the Neon rehearsal branch before they are placed in the production runbook.

### Phase 0: preparation

1. Repair and verify the migration baseline described above.
2. Add automated tests and domain DTOs before changing reads.
3. Capture a signed pre-migration manifest containing database identity, schema version, migration status, timestamp, row counts, per-store financial totals, per-item balances, min/max dates, orphan counts, and deterministic row-level checksums.
4. Create a Neon restore point/branch and test the complete migration there using a copy of production data.
5. Create a logical custom-format `pg_dump` through `DIRECT_URL`, record its checksum, restore it into a scratch database, and run the manifest queries against the restored copy.
6. Add a write-maintenance switch. Reads can remain available; all operational mutations return `503 MIGRATION_IN_PROGRESS` during final backfill/cutover.
7. Confirm maintenance mode covers Server Actions, `/api/v1`, Better Auth operations that mutate business ownership, scheduled jobs, scripts, and any old deployed application instance.
8. Document expected migration duration, operator, reviewer, rollback owner, backup locations, and the exact go/no-go checklist.

The manifest and migration report must not contain credentials or customer secrets. Store them as protected deployment artifacts, not in the public repository.

### Phase 1: expand

1. Add new enums and tables without dropping old tables.
2. Add nullable/new foreign keys and indexes using PostgreSQL-safe sequencing.
3. Generate Prisma client and keep old services compiling.
4. Add `_DataMigrationRun`, `_DataMigrationCheckpoint`, and `_LegacyRecordMap` operational tables. Record migration version, source type/ID, target type/ID, status, source checksum, error, and timestamps.
5. Add an idempotent migration command under `scripts/` that checkpoints by store and phase but can also perform a full reconciliation rerun.
6. Make the script acquire a PostgreSQL advisory lock so two backfills cannot run concurrently.
7. Make the script reject an unknown schema version or an unapproved database identity before it writes.

### Phase 2: backfill catalog

1. Copy every `Bahan` to `Item(type=MATERIAL)` preserving ID, tenant, names, units, and timestamps.
2. Copy every `Product` to `Item(type=PRODUCT)` preserving ID, image, active state, and timestamps; assign count unit defaults.
3. Copy current quantities and average costs into `StockBalance` preserving item IDs.
4. Copy unit conversions to `ItemUnitConversion`.
5. Copy product prices to `ItemPrice` preserving IDs where practical.
6. Fail on any old ID collision between material and product tables before inserting.
7. Record one source-to-target mapping and source checksum for every migrated row; anti-join queries must show no unmapped catalog row.

### Phase 3: backfill documents

1. Copy `Belanja`/items to purchases/lines, preserving IDs and totals. Keep simple-mode purchases with zero lines.
2. Copy each production and convert material records to `INPUT` lines and product records to `OUTPUT` lines, preserving line IDs.
3. Copy sales to posted cashier/manual orders with line price snapshots.
4. Copy unconverted customer orders to unposted manual orders.
5. Detect converted orders using `ActivityLog.action = 'pesanan_converted'` and its `saleInvoiceNumber` metadata. Merge each Pesanan/Sale pair into one canonical order rather than counting both.
6. For a converted pair, retain the Sale ID as canonical because stock movements and revenue point to it; rewrite old Pesanan activity references to the canonical ID during migration.
7. Detect cancelled legacy orders through `cancelled_pesanan` activity because the current cancellation implementation stores the same two statuses as completion.
8. Treat unmatched legacy sales as posted orders and unmatched Pesanan records according to their payment/delivery states.
9. Parse payment method from legacy sale notes once, persist the explicit enum, and preserve original note text.
10. Before treating a completed Pesanan as independent, check conversion activity, sale invoice metadata, conversion notes, actor/store, line fingerprint, total, and timestamp proximity. Use these signals only to propose a match; uncertain or conflicting matches enter an ambiguity report and block cutover.
11. Store all accepted Sale/Pesanan-to-Order mappings in `_LegacyRecordMap`, including both source IDs for converted pairs. Never rely on parsing activity metadata again after backfill.
12. Use the current item name/unit as the line snapshot because historical names were not stored previously. Record this as known source-data limitation rather than claiming to reconstruct an unavailable historical value.
13. Anti-join every legacy document and line table against the mapping table. Expected unmapped count is zero.

### Phase 4: backfill and reconcile ledger

1. Convert each old movement to one signed movement and map material/product FK to `itemId`.
2. Normalize source type casing and remap merged Sale/Pesanan references.
3. Copy current old balances as the authoritative migration snapshot.
4. For every item, calculate `opening = StockBalance.quantity - SUM(converted movement quantities)`.
5. Insert one `MIGRATION_OPENING_BALANCE` movement for a non-zero opening amount. This is required because existing initial stock was not consistently represented in the ledger.
6. Generate deterministic dedupe keys for every migrated and opening movement.
7. Verify ledger sum equals `StockBalance.quantity` for every item.
8. Timestamp each opening movement immediately before that item's earliest known legacy movement; if none exists, use the item's creation time. This keeps stock-card ordering deterministic.
9. Preserve the original movement ID and `createdAt` wherever possible and record every source movement mapping.
10. Reject malformed legacy movements where both/neither of `bahanId` and `productId` are set, where the item belongs to another store, or where the quantity is invalid. Do not silently skip them.

### Phase 5: shadow verification

- Compare per-store item counts by type.
- Compare purchase counts/totals and production counts/line quantities.
- Compare posted-order counts and revenue totals against old `Sale`, excluding deduplicated converted Pesanan records.
- Compare pending/cancelled/completed manual order classification against activity logs.
- Compare old and new balances item by item.
- Compare movement counts plus generated opening movements.
- Compare daily closing and analytics output for representative dates/stores.
- Run orphan checks for every FK and cross-store ownership check for every line.
- Produce a machine-readable migration report and abort cutover on any unexplained delta.

Required machine-verifiable gates:

| Invariant | Required result |
|---|---|
| Every legacy catalog/document/line/movement row has a mapping | `0` unmapped rows |
| Every mapped target exists and has the same tenant | `0` missing/mismatched rows |
| No source maps to multiple unintended targets | `0` duplicate mappings |
| Material count equals material item count | Exact equality per store |
| Product count equals product item count | Exact equality per store |
| Purchase count and total | Exact equality per store and currency precision |
| Standalone Sale plus deduplicated converted Sale count/revenue | Exact equality per store/day/channel |
| Pending/cancelled manual order classification | Exact equality after approved ambiguity resolutions |
| Production input/output quantities | Exact equality per production/item |
| Old item balance vs `StockBalance` | Exact equality for every item |
| Sum of signed ledger vs `StockBalance` | Exact equality for every item |
| Cross-tenant references and FK orphans | `0` rows |
| Duplicate order numbers/dedupe keys | `0` rows |
| Unresolved ambiguity/error report entries | `0` rows |

Counts and aggregate sums are not sufficient by themselves. For each mapped row, compare a canonical checksum of business fields after documented transformations. Any checksum mismatch must be explained by an approved transform in the migration report.

### Phase 6: cutover

1. Enable write maintenance.
2. Confirm all old application instances and background writers observe maintenance mode, then record the final old-table transaction watermark and manifest.
3. Take final Neon restore point and logical backup; verify backup completion and checksums before continuing.
4. Rerun the complete idempotent upsert/backfill and reconciliation, not only `createdAt`-new rows. Existing rows may have been updated or deleted since rehearsal.
5. Run all row-level and aggregate verification gates and have a second operator review the signed report.
6. Deploy services and UI that read/write only the new model while maintenance remains enabled.
7. Run read-only smoke tests, then controlled write tests in a designated migration test store and verify ledger/balance effects.
8. Disable maintenance only after explicit go approval; monitor errors, stock conflicts, revenue, and latency.
9. Capture a post-cutover manifest and compare it to the final pre-cutover manifest plus the controlled test transactions.

### Phase 7: contract

After at least one stable release window:

1. Remove compatibility actions/services and old Prisma model references.
2. Revoke application write privileges to old tables or move them to a read-only archive schema first; do not immediately drop them in the cutover release.
3. Keep `_LegacyRecordMap`, manifests, and migration reports through the full audit/rollback retention period.
4. After retention approval and one final backup/restore test, drop old tables/enums and temporary migration checkpoint tables in a separate reviewed release.
5. Remove old image proxy routes after all stored URLs and clients use the new media route.
6. Re-index the codebase graph and update architecture documentation.

### Rollback

- Before any accepted new-model business write, rollback means keep write maintenance enabled, deploy the previous application, restore the verified pre-cutover Neon branch/backup, validate the pre-migration manifest, and repoint connection variables.
- Do not attempt reverse synchronization after the new model has accepted writes unless a tested reverse migration exists.
- If post-cutover writes must be retained, pause and export those new documents before restoring; this is an incident procedure, not an automatic rollback.
- Reopening the old application without restoring/reconciling writes is prohibited because it would create two diverging sources of truth.

### Production cutover runbook

The implementation must turn this sequence into an operator checklist with timestamps and evidence links:

1. **T-24 hours:** confirm successful rehearsal on a production copy, zero unresolved migration report entries, tested backup restore, approved release commit, and rollback owners available.
2. **T-30 minutes:** stop nonessential jobs, verify database identity and `prisma migrate status`, confirm no unexpected schema drift, and announce the write window.
3. **Freeze:** enable maintenance mode and verify a write attempt through every transport returns `503`; terminate or wait for pre-freeze business transactions to finish.
4. **Snapshot:** record transaction watermark and pre-cutover manifest; create final Neon restore point and logical dump; verify both completed.
5. **Expand:** run only reviewed Prisma expand migrations with `npx prisma migrate deploy`; immediately verify migration status and that old application reads still work.
6. **Backfill:** run the versioned migration script with one migration-run ID and advisory lock. A rerun with the same version must be safe.
7. **Verify:** generate row mappings, canonical checksums, financial comparisons, balance/ledger reconciliation, orphan checks, and ambiguity report. Any non-zero unexplained result is an automatic no-go.
8. **Deploy:** deploy new-model code while maintenance remains enabled. Confirm all instances run the approved commit and old instances are drained.
9. **Smoke:** perform read-only checks and controlled writes in the designated migration test store; verify document, movement, balance, audit, dashboard, and API results.
10. **Open:** obtain reviewer approval, disable maintenance, and start heightened monitoring.
11. **T+15/T+60/T+24h:** rerun reconciliation and compare post-cutover manifests. Any ledger/balance or revenue discrepancy triggers write freeze and incident review.
12. **Rollback window:** keep old tables and backups untouched/read-only until retention approval. Contract cleanup is a separate release.

At each numbered step record `startedAt`, `completedAt`, operator, command/script version, result, and artifact checksum. Operators must not continue past a failed gate by manually editing the report.

## 9. Concurrency, Idempotency, and Security

- Use serializable or guarded transactions for stock-affecting operations where practical.
- Decrement balances with a conditional atomic statement (`quantity >= requested`) and verify affected row count; do not read-then-update without a guard.
- Increment `StockBalance.version` on every mutation.
- Store idempotency key, actor, route/operation, request hash, status, and response reference. Scope keys by store and operation.
- Add unique posting/dedupe constraints so retries cannot create duplicate movements.
- Verify membership and role in every Route Handler. Never trust `storeId`, `itemId`, or nested IDs independently.
- Rate-limit authentication, password reset, image uploads, destructive admin operations, and checkout bursts.
- Restrict uploaded MIME type, size, generated path, and authorization; delete replaced blobs asynchronously after database commit.
- Never expose private Blob URLs or arbitrary proxy targets.
- Redact internal errors and log a request ID server-side.
- Add audit events for store/member/catalog/pricing changes, posting, cancellation/reversal, adjustment, closing print, reset, and super-admin actions.
- Keep secrets only in environment variables and rotate any credential suspected to have escaped local storage.

## 10. Implementation Sequence and Commit Gates

### Milestone A: foundations

- Add shared DTOs, domain errors, auth context, validation, response, and pagination helpers.
- Add test infrastructure and baseline tests for current behavior.
- Gate: build, lint, unit tests, and current critical-flow smoke tests pass.

### Milestone B: schema expand and migration tooling

- Add target models and migration checkpoint/report scripts.
- Rehearse on a restored Neon branch.
- Gate: idempotent backfill twice produces no duplicate rows and zero verification deltas.

### Milestone C: catalog and inventory services

- Implement item, pricing, balance, ledger, adjustment, and media services.
- Adapt material/product/price actions and inventory/production catalog reads.
- Gate: all three operational modes pass stock behavior tests.

### Milestone D: purchases and production

- Implement purchase and production aggregates/posting.
- Adapt pages, forms, histories, and seed.
- Gate: weighted average cost, unit conversion, input/output posting, insufficient stock, and retry tests pass.

### Milestone E: unified orders

- Implement order lifecycle, checkout, completion, cancellation, and reversal.
- Adapt cashier, Pesanan UI, receipts, closing, dashboard, analytics, and admin summaries.
- Gate: no duplicate posting under concurrent/retried checkout; converted legacy orders are not double-counted.

### Milestone F: API v1

- Add explicit Route Handlers and OpenAPI document for all non-deferred endpoints.
- Keep Server Components on direct domain/query calls.
- Gate: endpoint auth matrix, validation, pagination, idempotency, tenant isolation, and error contract tests pass.

### Milestone G: production cutover

- Execute write freeze, final backfill, verification, deploy, and smoke tests.
- Gate: migration report approved and monitoring stable before reopening writes.

### Milestone H: contract cleanup

- Remove old models/adapters/routes only after the rollback window.
- Gate: repository search finds no old Prisma model usage and archived tables are no longer read.

## 11. Testing and Acceptance Matrix

### Unit/domain tests

- Unit conversion and monetary/quantity validation.
- Weighted average cost.
- Order and fulfillment/payment transition table.
- Operational mode policy.
- Price-tier selection and custom-price snapshots.
- Signed movement and reversal generation.
- Legacy payment-note parsing and converted-order matching.

### Database integration tests

- Tenant ownership rejection for every nested ID.
- Atomic purchase, production, checkout, completion, adjustment, and reversal.
- Concurrent checkout cannot oversell tracked inventory.
- Same idempotency key produces one document and one movement set.
- Different payload with same key returns conflict.
- Ledger/balance reconciliation invariant.
- Historical documents remain readable after item/tier archive.

### API contract tests

- `401` unauthenticated, `403` wrong role/store, `404` hidden foreign resource, `409` state/stock/idempotency conflict, `422` validation.
- Cursor stability with identical timestamps using `(createdAt,id)` ordering.
- Decimal string and ISO date serialization.
- Upload limits and prohibited media proxy targets.
- Super-admin protection against self/protected-account deletion.

### UI acceptance tests

1. Owner creates/updates a store and switches each operational mode.
2. Owner adds/removes staff; staff cannot execute owner-only operations.
3. Full mode: create material with alternate units, purchase it, consume it, produce product, sell product, and reconcile balances/ledger.
4. Simple mode: record total-only purchase and output-only production.
5. Cashier-only mode: sell an item with zero stock without changing balance.
6. Create/edit/archive product and verify multi-tier prices and image display.
7. Save cashier cart as customer order; update payment/delivery; complete it once; verify no duplicate sale/order.
8. Cancel unposted order and reverse a posted order with correct stock restoration.
9. Print browser and Bluetooth sale receipts using persisted order number/payment data.
10. Print Jakarta daily closing and verify totals/payment/channel/top products.
11. Reports/dashboard/admin summaries match posted orders and purchases.
12. Existing migrated transaction history remains visible with correct snapshots.
13. Reset store data removes operational aggregates in FK-safe order but retains store/members/profile.

## 12. Observability and Rollout

- Add structured logs for request ID, actor, store, operation, document ID, idempotency key, duration, and outcome.
- Record metrics for API latency/error rate, checkout conflicts, insufficient stock, idempotency reuse, posting/reversal failures, and ledger reconciliation failures.
- Add a scheduled reconciliation job/report that compares ledger sums and balances; alert on any delta.
- Run the migration rehearsal with production-sized data and record duration.
- Roll out first to a non-production Neon branch, then one pilot store if environment separation permits, then all stores.
- Keep old tables archived/read-only through the rollback window.

## 13. Open Product Decisions Before Implementation

The following require confirmation but do not block schema expansion:

1. Whether staff may create/archive catalog items and adjust prices, or those should become owner-only.
2. Whether posted order cancellation is owner-only and whether refunds require a separate explicit workflow.
3. Whether one user will remain limited to one owned store and the first membership as the active store.
4. Whether payment and bank/QRIS settings should remain local-device settings or become store data exposed by API.
5. Whether production/purchase cancellation should be added to the UI; it is not currently available.
6. The retention period before old tables are dropped.

Recommended defaults are: catalog creation allowed for staff, archive/price adjustment/stock adjustment/posting reversal owner-only; retain one owned store for this migration; keep device payment settings local; defer purchase/production cancellation UI; retain archived tables for at least one release cycle and 30 days.

## 14. Definition of Done

- New schema is the only active read/write model.
- Every current application capability works in all applicable operational modes.
- All non-deferred capabilities are available under authenticated `/api/v1` endpoints.
- Server Actions and API handlers share domain services and validation.
- No client component imports generated Prisma types.
- Migrated catalog, documents, revenue, balances, ledger, and statuses pass reconciliation with no unexplained delta.
- Posting is atomic, idempotent, tenant-safe, and concurrency-tested.
- OpenAPI, migration runbook/report, rollback procedure, and operational monitoring exist.
- Production build, lint, unit, integration, API contract, and critical UI acceptance suites pass.
