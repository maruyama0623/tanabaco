-- Add feature summary and embedding columns to Product
ALTER TABLE "Product"
ADD COLUMN "featureSummary" TEXT,
ADD COLUMN "featureEmbedding" JSONB;
