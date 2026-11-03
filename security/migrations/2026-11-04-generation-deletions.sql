-- Additive schema for durable privacy deletion. Safe to apply before rollout.
-- The existing ledger initializer also creates this table when permitted.
CREATE TABLE IF NOT EXISTS nasir_tryon_deletions (
  id UUID PRIMARY KEY,
  payload JSONB,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS nasir_tryon_deletions_pending_idx
  ON nasir_tryon_deletions (requested_at) WHERE payload IS NOT NULL;
CREATE INDEX IF NOT EXISTS nasir_tryon_generations_owner_time_idx
  ON nasir_tryon_generations (username, occurred_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS nasir_tryon_uploads_active_owner_idx
  ON nasir_tryon_uploads (username, expires_at) WHERE status <> 'consumed';

-- Retry scheduling prevents failing records from monopolizing every batch.
ALTER TABLE nasir_tryon_deletions ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE nasir_tryon_deletions ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS nasir_tryon_deletions_due_idx
  ON nasir_tryon_deletions (next_attempt_at, requested_at) WHERE payload IS NOT NULL;
