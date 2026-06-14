export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const url = searchParams.get("url")
  const pathname = searchParams.get("pathname")

  if (!url && !pathname) {
    return new Response("Missing url or pathname", { status: 400 })
  }

  const blobUrl = url ?? `https://mr6pdgua5u6qsuec.private.blob.vercel-storage.com/${pathname}`

  const response = await fetch(blobUrl, {
    headers: {
      Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`,
    },
  })

  if (!response.ok) {
    return new Response("Failed to fetch blob", { status: response.status })
  }

  return new Response(response.body, {
    headers: {
      "Content-Type": response.headers.get("Content-Type") ?? "image/png",
      "Cache-Control": "public, max-age=3600, immutable",
    },
  })
}
