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
  readStatus: (key: string, signal?: AbortSignal) => Promise<GenerationStatus>;
  wait: (milliseconds: number) => Promise<void>;
};

const POLL_INTERVAL_MS = 5_000;
// The server records a generation only after preparing its images, so a key
// stays absent briefly even for a request that did arrive.
const MAX_ABSENT_READS = 6;
const MAX_STATUS_READS = 72;
export class RecoveryAuthenticationError extends Error {}

async function readGenerationStatus(key: string, signal?: AbortSignal): Promise<GenerationStatus> {
  const response = await fetch(`/api/try-on/status?key=${encodeURIComponent(key)}`, { credentials: "same-origin", cache: "no-store", signal });
  if (response.status === 401) throw new RecoveryAuthenticationError("Your session expired. Sign in to recover this generation.");
  if (!response.ok) throw new Error("status_unavailable");
  return await response.json() as GenerationStatus;
}

const DEFAULT_DEPENDENCIES: RecoveryDependencies = {
  readStatus: readGenerationStatus,
  wait: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
};

/** Covers the entire operation, including reading a response body. */
export async function withDeadline<T>(operation: (signal: AbortSignal) => Promise<T>, timeoutMs: number, parent?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abort: (() => void) | undefined;
  try {
    parent?.throwIfAborted();
    const failure = new Promise<never>((_, reject) => {
      abort = () => { controller.abort(); reject(new DOMException("The request was cancelled", "AbortError")); };
      parent?.addEventListener("abort", abort, { once: true });
      timer = setTimeout(() => { controller.abort(); reject(new DOMException("The request timed out", "AbortError")); }, timeoutMs);
    });
    return await Promise.race([operation(controller.signal), failure]);
  } finally { clearTimeout(timer); if (abort) parent?.removeEventListener("abort", abort); }
}

export async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  return fetchUploadWithTimeout(url, init, timeoutMs);
}

/** Control responses are small; consume them inside the request deadline. */
export async function fetchUploadWithTimeout(url: string, init: RequestInit, timeoutMs = 60_000) {
  return withDeadline(async signal => {
    const response = await fetch(url, { ...init, signal });
    const body = await response.arrayBuffer();
    return new Response([204, 205, 304].includes(response.status) ? null : body, { status: response.status, statusText: response.statusText, headers: response.headers });
  }, timeoutMs, init.signal ?? undefined);
}

/** Follows a generation whose response was lost, without starting another paid run. */
export async function recoverGeneration(key: string, dependencies: RecoveryDependencies = DEFAULT_DEPENDENCIES, options: { readTimeoutMs?: number; totalTimeoutMs?: number } = {}): Promise<RecoveredGeneration> {
  const deadline = Date.now() + (options.totalTimeoutMs ?? 360_000);
  const remaining = () => Math.max(0, deadline - Date.now());
  let absentReads = 0;
  for (let read = 0; read < MAX_STATUS_READS; read += 1) {
    if (!remaining()) return { kind: "unknown" };
    if (read > 0) {
      try { await withDeadline(() => dependencies.wait(Math.min(POLL_INTERVAL_MS, remaining())), remaining()); }
      catch { return { kind: "unknown" }; }
    }
    if (!remaining()) return { kind: "unknown" };
    let status: GenerationStatus;
    try {
      status = await withDeadline(signal => dependencies.readStatus(key, signal), Math.min(options.readTimeoutMs ?? 10_000, remaining()));
    } catch (error) {
      if (error instanceof RecoveryAuthenticationError) throw error;
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
