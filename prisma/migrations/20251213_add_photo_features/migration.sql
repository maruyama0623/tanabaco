-- Add feature fields to PhotoRecord for embedding-based search
ALTER TABLE "PhotoRecord"
ADD COLUMN IF NOT EXISTS "featureSummary" TEXT,
ADD COLUMN IF NOT EXISTS "featureEmbedding" JSONB;
