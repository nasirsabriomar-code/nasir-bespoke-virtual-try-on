import "server-only";
import type { AuthorizedUser } from "@/lib/auth/config";
import type { UsageEvent } from "@/lib/usage-history";

export function historyOwner(user: AuthorizedUser): string | undefined {
  return user.role === "admin" ? undefined : user.username;
}

export function canAccessGeneration(user: AuthorizedUser, event: UsageEvent | null): event is UsageEvent {
  return Boolean(event && (user.role === "admin" || event.username === user.username));
}
