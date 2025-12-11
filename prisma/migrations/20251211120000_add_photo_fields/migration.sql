-- The database already has base tables. Add new optional fields to PhotoRecord.
ALTER TABLE "PhotoRecord"
    ADD COLUMN IF NOT EXISTS "productName" TEXT,
    ADD COLUMN IF NOT EXISTS "productCd" TEXT,
    ADD COLUMN IF NOT EXISTS "productSupplierName" TEXT,
    ADD COLUMN IF NOT EXISTS "productStorageType" TEXT;
