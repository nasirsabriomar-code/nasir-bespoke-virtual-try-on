import { createSessionToken, getCurrentUserFromToken, revokeSessionToken, getSessionCookieName } from "@/lib/auth/session";
import { POST as logout } from "@/app/api/auth/logout/route";
process.on("message", async (message: { action: string; token?: string }) => {
  const start = Date.now();
  try {
    let result: unknown;
    if (message.action === "create") result = await createSessionToken("assessment");
    else if (message.action === "read") result = Boolean(await getCurrentUserFromToken(message.token));
    else if (message.action === "revoke") { await revokeSessionToken(message.token); result = true; }
    else {
      const response = await logout(new Request("http://localhost/api/auth/logout", { method: "POST", headers: { origin: "http://localhost", cookie: `${getSessionCookieName()}=${message.token}` } }));
      result = { status: response.status, cookie: response.headers.has("set-cookie"), body: await response.text() };
    }
    process.send?.({ result, elapsed: Date.now() - start });
  } catch (error) {
    process.send?.({ error: error instanceof Error ? error.name : "Unknown", message: error instanceof Error ? error.message : "", elapsed: Date.now() - start });
  }
});

process.on("disconnect", () => process.exit(0));
