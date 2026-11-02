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
  try {
    const permanent = await readers.permanent(id);
    if (permanent) return permanent;
  } catch (error) {
    console.error("history_ledger_read_failed", { errorName: error instanceof Error ? error.name : "UnknownError" });
  }
  return readers.recent(id);
}
