// Genera el token para que el navegador suba el ZIP del pack DIRECTO a Vercel Blob (client upload),
// sin pasar por el límite de tamaño de las funciones serverless. Lo usa la página /importar.
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json()) as HandleUploadBody;
  try {
    const json = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ["application/zip", "application/x-zip-compressed", "application/octet-stream"],
        maximumSizeInBytes: 1500 * 1024 * 1024, // 1.5 GB
        addRandomSuffix: true,
      }),
      onUploadCompleted: async () => {},
    });
    return Response.json(json);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "error" }, { status: 400 });
  }
}
