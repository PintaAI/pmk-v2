import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { getStoredMediaPath, toAuthorizedMediaUrl } from "../../lib/media-url"

describe("authorized media URLs", () => {
  it("encodes a stored path into one route segment", () => {
    assert.equal(
      toAuthorizedMediaUrl("product/store_1/photo.webp"),
      "/api/v1/media/product%2Fstore_1%2Fphoto.webp",
    )
  })

  it("extracts paths from private blob URLs", () => {
    assert.equal(
      getStoredMediaPath("https://mr6pdgua5u6qsuec.private.blob.vercel-storage.com/toko/store_1/logo.png"),
      "toko/store_1/logo.png",
    )
  })

  it("does not proxy unrelated URLs", () => {
    assert.equal(toAuthorizedMediaUrl("https://example.com/image.png"), null)
  })
})
