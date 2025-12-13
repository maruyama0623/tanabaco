-- Recreate Supplier with code (self-managed number) as primary key and name
DROP TABLE IF EXISTS "Supplier";

CREATE TABLE "Supplier" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("code")
);
