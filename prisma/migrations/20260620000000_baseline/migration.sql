-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StatusPengiriman" AS ENUM ('BELUM', 'DIKIRIM');

-- CreateEnum
CREATE TYPE "StatusPembayaran" AS ENUM ('BELUM', 'DIBAYAR');

-- CreateEnum
CREATE TYPE "SaleChannel" AS ENUM ('CASHIER', 'RESELLER', 'ONLINE');

-- CreateEnum
CREATE TYPE "InventoryItemType" AS ENUM ('BAHAN', 'PRODUCT');

-- CreateEnum
CREATE TYPE "UnitKind" AS ENUM ('MASS', 'VOLUME', 'COUNT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "MovementDirection" AS ENUM ('IN', 'OUT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('BAHAN_PURCHASE', 'BAHAN_PRODUCTION_USAGE', 'PRODUCT_PRODUCTION_OUTPUT', 'PRODUCT_SALE', 'STOCK_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "TokoRole" AS ENUM ('OWNER', 'STAFF');

-- CreateEnum
CREATE TYPE "OperationalMode" AS ENUM ('CASHIER_ONLY', 'WITH_INVENTORY');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "toko" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT,
    "receiptLogoUrl" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "operationalMode" "OperationalMode" NOT NULL DEFAULT 'WITH_INVENTORY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "toko_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "toko_user" (
    "id" TEXT NOT NULL,
    "tokoId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "TokoRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "toko_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bahan" (
    "id" TEXT NOT NULL,
    "tokoId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "unitKind" "UnitKind" NOT NULL DEFAULT 'CUSTOM',
    "baseUnit" TEXT NOT NULL DEFAULT '',
    "currentQty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "averageCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bahan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "tokoId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT,
    "currentQty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceTier" (
    "id" TEXT NOT NULL,
    "tokoId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductPrice" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "priceTierId" TEXT NOT NULL,
    "price" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "ProductPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Belanja" (
    "id" TEXT NOT NULL,
    "tokoId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supplier" TEXT,
    "note" TEXT,
    "status" "DocumentStatus" NOT NULL DEFAULT 'COMPLETED',
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Belanja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BelanjaItem" (
    "id" TEXT NOT NULL,
    "belanjaId" TEXT NOT NULL,
    "bahanId" TEXT NOT NULL,
    "qty" DECIMAL(14,3) NOT NULL,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "subtotal" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "BelanjaItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Production" (
    "id" TEXT NOT NULL,
    "tokoId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "status" "DocumentStatus" NOT NULL DEFAULT 'COMPLETED',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Production_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionBahan" (
    "id" TEXT NOT NULL,
    "productionId" TEXT NOT NULL,
    "bahanId" TEXT NOT NULL,
    "qtyUsed" DECIMAL(14,3) NOT NULL,

    CONSTRAINT "ProductionBahan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionProduct" (
    "id" TEXT NOT NULL,
    "productionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "qtyProduced" DECIMAL(14,3) NOT NULL,

    CONSTRAINT "ProductionProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL,
    "tokoId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "channel" "SaleChannel" NOT NULL,
    "customerName" TEXT,
    "note" TEXT,
    "status" "DocumentStatus" NOT NULL DEFAULT 'COMPLETED',
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "paidAmount" DECIMAL(14,2),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleItem" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "priceTierId" TEXT,
    "priceTierCode" TEXT,
    "priceTierName" TEXT,
    "qty" DECIMAL(14,3) NOT NULL,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "subtotal" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "SaleItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryMovement" (
    "id" TEXT NOT NULL,
    "tokoId" TEXT NOT NULL,
    "itemType" "InventoryItemType" NOT NULL,
    "bahanId" TEXT,
    "productId" TEXT,
    "movementType" "MovementType" NOT NULL,
    "direction" "MovementDirection" NOT NULL,
    "qty" DECIMAL(14,3) NOT NULL,
    "unitCost" DECIMAL(14,2),
    "unitPrice" DECIMAL(14,2),
    "referenceType" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BahanUnitConversion" (
    "id" TEXT NOT NULL,
    "bahanId" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "factor" DECIMAL(14,3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BahanUnitConversion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "tokoId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pesanan" (
    "id" TEXT NOT NULL,
    "tokoId" TEXT NOT NULL,
    "kode" TEXT NOT NULL,
    "tanggal" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "namaPelanggan" TEXT,
    "kontak" TEXT,
    "catatan" TEXT,
    "statusPengiriman" "StatusPengiriman" NOT NULL DEFAULT 'BELUM',
    "statusPembayaran" "StatusPembayaran" NOT NULL DEFAULT 'BELUM',
    "total" DECIMAL(14,2) NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pesanan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemPesanan" (
    "id" TEXT NOT NULL,
    "pesananId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "qty" DECIMAL(14,3) NOT NULL,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "subtotal" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "ItemPesanan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "toko_name_idx" ON "toko"("name");

-- CreateIndex
CREATE INDEX "toko_user_userId_idx" ON "toko_user"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "toko_user_tokoId_userId_key" ON "toko_user"("tokoId", "userId");

-- CreateIndex
CREATE INDEX "Bahan_tokoId_name_idx" ON "Bahan"("tokoId", "name");

-- CreateIndex
CREATE INDEX "Product_tokoId_name_idx" ON "Product"("tokoId", "name");

-- CreateIndex
CREATE INDEX "PriceTier_tokoId_isActive_sortOrder_idx" ON "PriceTier"("tokoId", "isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "PriceTier_tokoId_code_key" ON "PriceTier"("tokoId", "code");

-- CreateIndex
CREATE INDEX "ProductPrice_priceTierId_idx" ON "ProductPrice"("priceTierId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductPrice_productId_priceTierId_key" ON "ProductPrice"("productId", "priceTierId");

-- CreateIndex
CREATE INDEX "Belanja_tokoId_date_idx" ON "Belanja"("tokoId", "date");

-- CreateIndex
CREATE INDEX "Belanja_createdById_idx" ON "Belanja"("createdById");

-- CreateIndex
CREATE INDEX "BelanjaItem_belanjaId_idx" ON "BelanjaItem"("belanjaId");

-- CreateIndex
CREATE INDEX "BelanjaItem_bahanId_idx" ON "BelanjaItem"("bahanId");

-- CreateIndex
CREATE INDEX "Production_tokoId_date_idx" ON "Production"("tokoId", "date");

-- CreateIndex
CREATE INDEX "Production_createdById_idx" ON "Production"("createdById");

-- CreateIndex
CREATE INDEX "ProductionBahan_productionId_idx" ON "ProductionBahan"("productionId");

-- CreateIndex
CREATE INDEX "ProductionBahan_bahanId_idx" ON "ProductionBahan"("bahanId");

-- CreateIndex
CREATE INDEX "ProductionProduct_productionId_idx" ON "ProductionProduct"("productionId");

-- CreateIndex
CREATE INDEX "ProductionProduct_productId_idx" ON "ProductionProduct"("productId");

-- CreateIndex
CREATE INDEX "Sale_tokoId_date_idx" ON "Sale"("tokoId", "date");

-- CreateIndex
CREATE INDEX "Sale_channel_idx" ON "Sale"("channel");

-- CreateIndex
CREATE INDEX "Sale_createdById_idx" ON "Sale"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_tokoId_invoiceNumber_key" ON "Sale"("tokoId", "invoiceNumber");

-- CreateIndex
CREATE INDEX "SaleItem_saleId_idx" ON "SaleItem"("saleId");

-- CreateIndex
CREATE INDEX "SaleItem_productId_idx" ON "SaleItem"("productId");

-- CreateIndex
CREATE INDEX "SaleItem_priceTierId_idx" ON "SaleItem"("priceTierId");

-- CreateIndex
CREATE INDEX "InventoryMovement_tokoId_itemType_createdAt_idx" ON "InventoryMovement"("tokoId", "itemType", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryMovement_tokoId_bahanId_createdAt_idx" ON "InventoryMovement"("tokoId", "bahanId", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryMovement_tokoId_productId_createdAt_idx" ON "InventoryMovement"("tokoId", "productId", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryMovement_referenceType_referenceId_idx" ON "InventoryMovement"("referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "InventoryMovement_createdById_idx" ON "InventoryMovement"("createdById");

-- CreateIndex
CREATE INDEX "BahanUnitConversion_bahanId_idx" ON "BahanUnitConversion"("bahanId");

-- CreateIndex
CREATE UNIQUE INDEX "BahanUnitConversion_bahanId_unit_key" ON "BahanUnitConversion"("bahanId", "unit");

-- CreateIndex
CREATE INDEX "ActivityLog_tokoId_actorId_createdAt_idx" ON "ActivityLog"("tokoId", "actorId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_entityType_entityId_idx" ON "ActivityLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "ActivityLog_action_idx" ON "ActivityLog"("action");

-- CreateIndex
CREATE INDEX "Pesanan_tokoId_statusPengiriman_statusPembayaran_idx" ON "Pesanan"("tokoId", "statusPengiriman", "statusPembayaran");

-- CreateIndex
CREATE INDEX "Pesanan_tokoId_tanggal_idx" ON "Pesanan"("tokoId", "tanggal");

-- CreateIndex
CREATE INDEX "Pesanan_createdById_idx" ON "Pesanan"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "Pesanan_tokoId_kode_key" ON "Pesanan"("tokoId", "kode");

-- CreateIndex
CREATE INDEX "ItemPesanan_pesananId_idx" ON "ItemPesanan"("pesananId");

-- CreateIndex
CREATE INDEX "ItemPesanan_productId_idx" ON "ItemPesanan"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- AddForeignKey
ALTER TABLE "toko_user" ADD CONSTRAINT "toko_user_tokoId_fkey" FOREIGN KEY ("tokoId") REFERENCES "toko"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "toko_user" ADD CONSTRAINT "toko_user_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bahan" ADD CONSTRAINT "Bahan_tokoId_fkey" FOREIGN KEY ("tokoId") REFERENCES "toko"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_tokoId_fkey" FOREIGN KEY ("tokoId") REFERENCES "toko"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceTier" ADD CONSTRAINT "PriceTier_tokoId_fkey" FOREIGN KEY ("tokoId") REFERENCES "toko"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductPrice" ADD CONSTRAINT "ProductPrice_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductPrice" ADD CONSTRAINT "ProductPrice_priceTierId_fkey" FOREIGN KEY ("priceTierId") REFERENCES "PriceTier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Belanja" ADD CONSTRAINT "Belanja_tokoId_fkey" FOREIGN KEY ("tokoId") REFERENCES "toko"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BelanjaItem" ADD CONSTRAINT "BelanjaItem_belanjaId_fkey" FOREIGN KEY ("belanjaId") REFERENCES "Belanja"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BelanjaItem" ADD CONSTRAINT "BelanjaItem_bahanId_fkey" FOREIGN KEY ("bahanId") REFERENCES "Bahan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Production" ADD CONSTRAINT "Production_tokoId_fkey" FOREIGN KEY ("tokoId") REFERENCES "toko"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionBahan" ADD CONSTRAINT "ProductionBahan_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionBahan" ADD CONSTRAINT "ProductionBahan_bahanId_fkey" FOREIGN KEY ("bahanId") REFERENCES "Bahan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionProduct" ADD CONSTRAINT "ProductionProduct_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "Production"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionProduct" ADD CONSTRAINT "ProductionProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_tokoId_fkey" FOREIGN KEY ("tokoId") REFERENCES "toko"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_priceTierId_fkey" FOREIGN KEY ("priceTierId") REFERENCES "PriceTier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_tokoId_fkey" FOREIGN KEY ("tokoId") REFERENCES "toko"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_bahanId_fkey" FOREIGN KEY ("bahanId") REFERENCES "Bahan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BahanUnitConversion" ADD CONSTRAINT "BahanUnitConversion_bahanId_fkey" FOREIGN KEY ("bahanId") REFERENCES "Bahan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pesanan" ADD CONSTRAINT "Pesanan_tokoId_fkey" FOREIGN KEY ("tokoId") REFERENCES "toko"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemPesanan" ADD CONSTRAINT "ItemPesanan_pesananId_fkey" FOREIGN KEY ("pesananId") REFERENCES "Pesanan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemPesanan" ADD CONSTRAINT "ItemPesanan_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
