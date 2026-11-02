export type GenerationStatus =
  | { state: "absent" }
  | { state: "in_progress" }
  | { state: "complete"; resultUrl: string; originalUrl: string }
  | { state: "failed"; error: string };

export type RecoveredGeneration =
  | { kind: "complete"; resultUrl: string; originalUrl: string }
  | { kind: "failed"; error: string }
  | { kind: "unknown" };

type RecoveryDependencies = {
  readStatus: (key: string) => Promise<GenerationStatus>;
  wait: (milliseconds: number) => Promise<void>;
};

const POLL_INTERVAL_MS = 5_000;
// The server records a generation only after preparing its images, so a key
// stays absent briefly even for a request that did arrive.
const MAX_ABSENT_READS = 6;
const MAX_STATUS_READS = 72;

async function readGenerationStatus(key: string): Promise<GenerationStatus> {
  const response = await fetch(`/api/try-on/status?key=${encodeURIComponent(key)}`, { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) throw new Error("status_unavailable");
  return await response.json() as GenerationStatus;
}

const DEFAULT_DEPENDENCIES: RecoveryDependencies = {
  readStatus: readGenerationStatus,
  wait: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
};

/** Starts the timer when the request starts, so slow uploads beforehand cannot use it up. */
export async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

/** Follows a generation whose response was lost, without starting another paid run. */
export async function recoverGeneration(key: string, dependencies: RecoveryDependencies = DEFAULT_DEPENDENCIES): Promise<RecoveredGeneration> {
  let absentReads = 0;
  for (let read = 0; read < MAX_STATUS_READS; read += 1) {
    if (read > 0) await dependencies.wait(POLL_INTERVAL_MS);
    let status: GenerationStatus;
    try {
      status = await dependencies.readStatus(key);
    } catch {
      continue;
    }
    if (status.state === "complete") return { kind: "complete", resultUrl: status.resultUrl, originalUrl: status.originalUrl };
    if (status.state === "failed") return { kind: "failed", error: status.error };
    if (status.state === "absent") {
      absentReads += 1;
      if (absentReads >= MAX_ABSENT_READS) return { kind: "unknown" };
    }
  }
  return { kind: "unknown" };
}
