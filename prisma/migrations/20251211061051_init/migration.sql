-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "productCd" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cost" INTEGER NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'P',
    "supplierName" TEXT NOT NULL,
    "supplierCd" TEXT,
    "spec" TEXT,
    "storageType" TEXT,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,
    "imageUrls" JSONB NOT NULL,
    "departments" JSONB NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventorySession" (
    "id" TEXT NOT NULL,
    "inventoryDate" TEXT NOT NULL,
    "monthKey" TEXT NOT NULL DEFAULT '',
    "department" TEXT NOT NULL,
    "staff1" TEXT NOT NULL,
    "staff2" TEXT NOT NULL,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "InventorySession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhotoRecord" (
    "id" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "imageUrls" JSONB NOT NULL DEFAULT '[]',
    "quantity" DOUBLE PRECISION,
    "quantityFormula" TEXT,
    "unitCost" DOUBLE PRECISION,
    "unit" TEXT NOT NULL DEFAULT 'P',
    "status" TEXT NOT NULL,
    "productId" TEXT,
    "takenAt" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "department" TEXT NOT NULL DEFAULT '',
    "inventoryDate" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "PhotoRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "name" TEXT NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "StaffMember" (
    "name" TEXT NOT NULL,

    CONSTRAINT "StaffMember_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "name" TEXT NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("name")
);

-- CreateIndex
CREATE UNIQUE INDEX "InventorySession_department_monthKey_key" ON "InventorySession"("department", "monthKey");

-- CreateIndex
CREATE INDEX "PhotoRecord_department_inventoryDate_idx" ON "PhotoRecord"("department", "inventoryDate");

-- AddForeignKey
ALTER TABLE "PhotoRecord" ADD CONSTRAINT "PhotoRecord_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoRecord" ADD CONSTRAINT "PhotoRecord_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "InventorySession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
