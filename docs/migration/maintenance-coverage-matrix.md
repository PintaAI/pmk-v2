# Maintenance Coverage Matrix

When `MAINTENANCE_MODE=1`, the following surfaces MUST return 503 with `MIGRATION_IN_PROGRESS` for all mutation endpoints.
Read operations SHOULD remain available.

## Server Actions

| File | Action | Type | Maintenance Check | Verified |
|------|--------|------|-------------------|----------|
| bahan-actions.ts | createBahanAction | Mutation | Yes | |
| bahan-actions.ts | updateBahanAction | Mutation | Yes | |
| bahan-actions.ts | deleteBahanAction | Mutation | Yes | |
| bahan-actions.ts | getBahanList | Read | No (allowed) | |
| belanja-actions.ts | createBelanjaAction | Mutation | Yes | |
| belanja-actions.ts | createDetailedBelanjaAction | Mutation | Yes | |
| cashier-actions.ts | checkoutAction | Mutation | Yes | |
| cashier-actions.ts | getCashierProducts | Read | No (allowed) | |
| closing-actions.ts | printClosingReceiptAction | Mutation | Yes | |
| closing-actions.ts | getDailyClosingRecapAction | Read | No (allowed) | |
| pesanan-actions.ts | createPesananAction | Mutation | Yes | |
| pesanan-actions.ts | updatePesananAction | Mutation | Yes | |
| pesanan-actions.ts | cancelPesananAction | Mutation | Yes | |
| pesanan-actions.ts | convertToSaleAction | Mutation | Yes | |
| price-tier-actions.ts | createPriceTierAction | Mutation | Yes | |
| price-tier-actions.ts | deletePriceTierAction | Mutation | Yes | |
| price-tier-actions.ts | bulkAdjustAction | Mutation | Yes | |
| price-tier-actions.ts | listPriceTiersAction | Read | No (allowed) | |
| product-actions.ts | createProductAction | Mutation | Yes | |
| product-actions.ts | updateProductAction | Mutation | Yes | |
| product-actions.ts | archiveProductAction | Mutation | Yes | |
| production-actions.ts | createProductionAction | Mutation | Yes | |
| production-actions.ts | createSimpleProductionAction | Mutation | Yes | |
| profile.ts | updateProfileAction | Mutation | Yes | |
| profile.ts | changePassword | Read | No (allowed) | |
| toko-actions.ts | createTokoAction | Mutation | Yes | |
| toko-actions.ts | updateTokoAction | Mutation | Yes | |
| toko-actions.ts | addStaffAction | Mutation | Yes | |
| toko-actions.ts | removeStaffAction | Mutation | Yes | |
| toko-actions.ts | resetTokoDataAction | Mutation | Yes | |
| toko-actions.ts | getCurrentTokoAction | Read | No (allowed) | |
| toko-actions.ts | listStaffAction | Read | No (allowed) | |
| super-admin-actions.ts | resetUserPasswordAction | Mutation | Yes | |
| super-admin-actions.ts | forceDeleteUserAction | Mutation | Yes | |
| super-admin-actions.ts | forceDeleteStoreAction | Mutation | Yes | |

## API v1 Endpoints

| Method | Path | Type | Maintenance Check |
|--------|------|------|-------------------|
| GET | /api/v1/me | Read | No |
| PATCH | /api/v1/me | Mutation | Yes |
| GET | /api/v1/stores | Read | No |
| POST | /api/v1/stores | Mutation | Yes |
| GET | /api/v1/stores/{storeId} | Read | No |
| PATCH | /api/v1/stores/{storeId} | Mutation | Yes |
| POST | /api/v1/stores/{storeId}/reset | Mutation | Yes |
| GET | /api/v1/stores/{storeId}/members | Read | No |
| POST | /api/v1/stores/{storeId}/members | Mutation | Yes |
| DELETE | /api/v1/stores/{storeId}/members/{id} | Mutation | Yes |
| GET | /api/v1/stores/{storeId}/items | Read | No |
| POST | /api/v1/stores/{storeId}/items | Mutation | Yes |
| PATCH | /api/v1/stores/{storeId}/items/{id} | Mutation | Yes |
| DELETE | /api/v1/stores/{storeId}/items/{id} | Mutation | Yes |
| POST | /api/v1/stores/{storeId}/items/{id}/archive | Mutation | Yes |
| PUT | /api/v1/stores/{storeId}/items/{id}/unit-conversions | Mutation | Yes |
| PUT | /api/v1/stores/{storeId}/items/{id}/prices | Mutation | Yes |
| POST | /api/v1/stores/{storeId}/items/{id}/image | Mutation | Yes |
| GET/POST | /api/v1/stores/{storeId}/price-tiers | Read/Mutation | Mutation: Yes |
| DELETE | /api/v1/stores/{storeId}/price-tiers/{id} | Mutation | Yes |
| POST | /api/v1/stores/{storeId}/price-tiers/{id}/adjustment | Mutation | Yes |
| GET | /api/v1/stores/{storeId}/purchases | Read | No |
| POST | /api/v1/stores/{storeId}/purchases | Mutation | Yes |
| GET/POST | /api/v1/stores/{storeId}/productions | Read/Mutation | Mutation: Yes |
| GET | /api/v1/stores/{storeId}/orders | Read | No |
| POST | /api/v1/stores/{storeId}/orders | Mutation | Yes |
| POST | /api/v1/stores/{storeId}/orders/checkout | Mutation | Yes |
| PATCH | /api/v1/stores/{storeId}/orders/{id}/payment | Mutation | Yes |
| PATCH | /api/v1/stores/{storeId}/orders/{id}/fulfillment | Mutation | Yes |
| POST | /api/v1/stores/{storeId}/orders/{id}/complete | Mutation | Yes |
| POST | /api/v1/stores/{storeId}/orders/{id}/cancel | Mutation | Yes |
| GET | /api/v1/stores/{storeId}/inventory/balances | Read | No |
| GET | /api/v1/stores/{storeId}/inventory/movements | Read | No |
| POST | /api/v1/stores/{storeId}/inventory/adjustments | Mutation | Yes |
| GET | /api/v1/stores/{storeId}/dashboard | Read | No |
| GET | /api/v1/stores/{storeId}/reports/analytics | Read | No |
| GET | /api/v1/stores/{storeId}/closing/daily | Read | No |
| POST | /api/v1/stores/{storeId}/closing/daily/print-events | Mutation | Yes |
| GET | /api/v1/stores/{storeId}/activity | Read | No |
| POST | /api/v1/stores/{storeId}/images | Mutation | Yes |
| GET | /api/v1/admin/summary | Read | No |
| GET | /api/v1/admin/users | Read | No |
| GET | /api/v1/admin/stores | Read | No |
| POST | /api/v1/admin/users/{id}/password-reset | Mutation | Yes |
| DELETE | /api/v1/admin/users/{id} | Mutation | Yes |
| DELETE | /api/v1/admin/stores/{id} | Mutation | Yes |

## Better Auth Mutations

| Operation | Type | Maintenance Check |
|-----------|------|-------------------|
| Sign up | Mutation | Yes |
| Store creation through auth | Mutation | Yes |
| Session management | Read | No |
| Password reset through auth | Mutation | Yes |

## Jobs / Scripts / Old Instances

| Component | Status During Maintenance |
|-----------|--------------------------|
| Cron reconciliation job | Paused |
| Background image processing | Paused |
| Old application instances | Drained (all traffic to new) |
| Database backup scripts | Allowed (read-only) |
| Monitoring agents | Allowed (read-only) |
