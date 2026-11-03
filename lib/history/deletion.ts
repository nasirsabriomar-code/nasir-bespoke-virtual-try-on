import { removeGenerationReplays } from "@/lib/generation-guard";
import "server-only";
import { generationDeletionBacklog, deferGenerationDeletion, expiredGenerations, finishGenerationDeletion, pendingGenerationDeletions, queueGenerationDeletion } from "@/lib/highres/ledger";
import { isGenerationAssetPath } from "@/lib/generation-storage";
import { r2Delete } from "@/lib/r2-storage";
import { getAllUsageHistoryForMigration, removeUsageEvent, type UsageEvent } from "@/lib/usage-history";
import { deleteGenerationReviews } from "./reviews";
import { generationExpired } from "./retention-policy";

export async function eraseGeneration(event: UsageEvent, deadline = Date.now() + 120_000) {
  // Queue first. A storage failure must not make the record visible again.
  await queueGenerationDeletion(event);
  for (const [asset, reference] of Object.entries(event.assets ?? {})) {
    if (!isGenerationAssetPath(reference.pathname, event.id, asset as Parameters<typeof isGenerationAssetPath>[2])) {
      throw new Error("Invalid deletion asset path");
    }
    if (Date.now() >= deadline) throw new Error("Deletion deadline reached");
    await r2Delete(reference.pathname);
  }
  if (Date.now() >= deadline) throw new Error("Deletion deadline reached");
  await removeGenerationReplays(event.username, event.id);
  await deleteGenerationReviews(event.id);
  await removeUsageEvent(event.id);
  await finishGenerationDeletion(event.id);
}

export async function cleanupRetainedGenerations() {
  // Recent Redis records may be the only copy if the original ledger write failed.
  const started = Date.now();
  const deadline = started + 60_000;
  const recent = await getAllUsageHistoryForMigration();
  const expired = [...await expiredGenerations(), ...recent.events.filter(event => generationExpired(event.occurredAt))];
  for (const event of expired) {
    if (Date.now() >= deadline) break;
    await queueGenerationDeletion(event);
  }
  let removed = 0;
  let failed = 0;
  for (const event of await pendingGenerationDeletions(100)) {
    if (Date.now() >= deadline) break;
    try { await eraseGeneration(event, deadline); removed++; }
    catch { failed++; await deferGenerationDeletion(event.id); console.error("generation_deletion_retry_required", { generationId: event.id }); }
  }
  const backlog = await generationDeletionBacklog();
  if (backlog.pending) console.warn("generation_deletion_backlog", backlog);
  return { removed, failed, backlog };
}
