import { removeExpiredUploads } from "@/lib/highres/uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Vercel Cron sends CRON_SECRET as a bearer token. Without a configured secret
// this route stays closed.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    return Response.json({ removed: await removeExpiredUploads() });
  } catch (error) {
    console.error("upload_cleanup_failed", { errorName: error instanceof Error ? error.name : "UnknownError" });
    return Response.json({ error: "Cleanup failed." }, { status: 503 });
  }
}
