import { cleanupRetainedGenerations } from "@/lib/history/deletion";
import { removeExpiredUploads } from "@/lib/highres/uploads";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

// Vercel Cron sends CRON_SECRET as a bearer token. Without a configured secret
// this route stays closed.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    const removed = await removeExpiredUploads();
    const generations = await cleanupRetainedGenerations();
    return Response.json({ removed, generations });
  } catch (error) {
    console.error("upload_cleanup_failed", { errorName: error instanceof Error ? error.name : "UnknownError" });
    return Response.json({ error: "Cleanup failed." }, { status: 503 });
  }
}
