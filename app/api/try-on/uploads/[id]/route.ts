import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { AuthConfigurationError } from "@/lib/auth/config";
import { requireRequestUser } from "@/lib/auth/session";
import { getUploadSlot } from "@/lib/highres/ledger";
import { HighResolutionUploadError } from "@/lib/highres/uploads";
import { isSameOriginRequest } from "@/lib/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function token() {
  const value = process.env.NASIR_BLOB_READ_WRITE_TOKEN?.trim();
  if (!value) throw new HighResolutionUploadError("Private image storage is not configured.", 503);
  return value;
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json() as HandleUploadBody;
    // Blob invokes this same route after upload completion. Its signature is
    // verified by handleUpload; browser requests must additionally be staff-authenticated.
    if (body.type === "blob.generate-client-token") {
      if (!isSameOriginRequest(request)) return Response.json({ error: "This request was blocked." }, { status: 403 });
      const user = await requireRequestUser(request);
      const slot = await getUploadSlot(id);
      if (!user || !slot || slot.username !== user.username || slot.status !== "authorized" || new Date(slot.expiresAt).getTime() < Date.now()) {
        return Response.json({ error: "Upload session is unavailable." }, { status: 401 });
      }
      const result = await handleUpload({
        token: token(), request, body,
        onBeforeGenerateToken: async (pathname) => {
          if (pathname !== slot.pathname) throw new HighResolutionUploadError("Upload path was rejected.", 403);
          return {
            allowedContentTypes: [slot.contentType], maximumSizeInBytes: slot.bytes,
            validUntil: new Date(slot.expiresAt).getTime(), addRandomSuffix: false, allowOverwrite: false,
          };
        },
      });
      return Response.json(result);
    }
    const result = await handleUpload({ token: token(), request, body, onBeforeGenerateToken: async () => { throw new HighResolutionUploadError("Unexpected upload request.", 400); } });
    return Response.json(result);
  } catch (error) {
    if (error instanceof AuthConfigurationError) return Response.json({ error: "Authentication is not configured." }, { status: 503 });
    if (error instanceof HighResolutionUploadError) return Response.json({ error: error.message }, { status: error.status });
    console.error("highres_upload_token_failed", { errorName: error instanceof Error ? error.name : "UnknownError" });
    return Response.json({ error: "We couldn't authorize this upload." }, { status: 400 });
  }
}
