import { deletedGenerationIds } from "@/lib/highres/ledger";
import { generationExpired } from "./retention-policy";
import type { UsageEvent } from "@/lib/usage-history";

type GenerationReaders = {
  permanent: (id: string) => Promise<UsageEvent | null>;
  recent: (id: string) => Promise<UsageEvent | null>;
};

/**
 * The ledger is authoritative, but a generation whose ledger write failed must
 * stay reachable through recent history: its image already exists and was paid for.
 */
export async function lookupGenerationEvent(id: string, readers: GenerationReaders) {
  if ((await deletedGenerationIds([id])).has(id)) return null;
  try {
    const permanent = await readers.permanent(id);
    if (permanent) return generationExpired(permanent.occurredAt) ? null : permanent;
  } catch (error) {
    console.error("history_ledger_read_failed", { errorName: error instanceof Error ? error.name : "UnknownError" });
  }
  const recent = await readers.recent(id);
  return recent && !generationExpired(recent.occurredAt) ? recent : null;
}
