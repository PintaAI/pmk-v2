// OpenAPI route coverage validator.
// Parses openapi.yaml and verifies every actual contract route/method is represented.
import { test } from "node:test"
import assert from "node:assert"
import fs from "node:fs"
import path from "node:path"
import yaml from "yaml"

const OPENAAPI_PATH = path.join(import.meta.dirname ?? __dirname, "..", "..", "openapi.yaml")

// Routes derived from app/api/v1 directory structure
function collectActualRoutes(): Array<{ method: string; path: string }> {
  const base = path.join(import.meta.dirname ?? __dirname, "..", "..", "app", "api", "v1")
  const routes: Array<{ method: string; path: string }> = []

  function walk(dir: string, prefix: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        // Handle dynamic segments: [xxx] -> {xxx}
        let seg = entry.name
        if (seg.startsWith("[") && seg.endsWith("]")) {
          seg = seg.slice(1, -1)
          if (seg === "...all") continue // Skip catch-all
          seg = `{${seg}}`
        }
        walk(full, prefix + "/" + seg)
      } else if (entry.name === "route.ts") {
        // Parse exported functions to determine methods
        const content = fs.readFileSync(full, "utf-8")
        const methodMap: Record<string, string> = {
          GET: "get", POST: "post", PUT: "put", PATCH: "patch", DELETE: "delete",
        }
        for (const [m, lower] of Object.entries(methodMap)) {
          if (content.includes(`export async function ${m}`)) {
            routes.push({ method: lower, path: prefix || "/" })
          }
        }
      }
    }
  }

  walk(base, "")
  return routes
}

function parseOpenAPI(filePath: string): Record<string, unknown> {
  const content = fs.readFileSync(filePath, "utf-8")
  return yaml.parse(content) as Record<string, unknown>
}

test("OpenAPI file exists", () => {
  assert.ok(fs.existsSync(OPENAAPI_PATH), "openapi.yaml should exist in repository root")
})

test("OpenAPI is valid YAML", () => {
  const content = fs.readFileSync(OPENAAPI_PATH, "utf-8")
  const parsed = yaml.parse(content)
  assert.ok(parsed, "YAML should parse successfully")
  assert.ok(parsed.paths, "Should have paths section")
})

test("OpenAPI covers all non-deferred route/method combinations", () => {
  const actual = collectActualRoutes()
  const spec = parseOpenAPI(OPENAAPI_PATH)
  const specPaths = (spec.paths ?? {}) as Record<string, Record<string, unknown>>

  const missing: string[] = []

  // Only check routes that exist in the codebase but not in the spec
  for (const route of actual) {
    const normalizedPath = route.path.startsWith("/") ? route.path : "/" + route.path
    // Skip Better Auth auth routes and generic catch-all
    if (normalizedPath === "/auth" || normalizedPath.includes("[...all]")) continue

    let found = false
    for (const specPath of Object.keys(specPaths)) {
      // Convert both to comparable forms by replacing params
      const specNorm = specPath.replace(/\{[^}]+\}/g, ":param")
      const routeNorm = normalizedPath.replace(/\{[^}]+\}/g, ":param")
      if (specNorm === routeNorm && specPaths[specPath]?.[route.method]) {
        found = true
        break
      }
    }
    if (!found) {
      missing.push(`${route.method.toUpperCase()} ${normalizedPath}`)
    }
  }

  if (missing.length > 0) {
    console.error("Missing from OpenAPI:", missing.join("\n  "))
  }
  assert.equal(missing.length, 0, `OpenAPI is missing ${missing.length} route/method combinations`)
})

test("OpenAPI 401/403/404/409/422/503 references exist", () => {
  const spec = parseOpenAPI(OPENAAPI_PATH)
  const responses = (spec.components as Record<string, unknown> | undefined)?.responses as Record<string, unknown> ?? {}
  for (const code of ["401", "403", "404", "409", "422", "503"]) {
    assert.ok(responses[code], `OpenAPI should define ${code} response`)
  }
})

test("OpenAPI defines Idempotency-Key parameter", () => {
  const spec = parseOpenAPI(OPENAAPI_PATH)
  const params = (spec.components as Record<string, unknown> | undefined)?.parameters as Record<string, unknown> ?? {}
  assert.ok(params?.idempotencyKey, "Should define Idempotency-Key parameter")
})

test("OpenAPI defines ErrorEnvelope schema", () => {
  const spec = parseOpenAPI(OPENAAPI_PATH)
  const schemas = (spec.components as Record<string, unknown> | undefined)?.schemas as Record<string, unknown> ?? {}
  const err = schemas?.ErrorEnvelope as Record<string, unknown> | undefined
  assert.ok(err, "Should define ErrorEnvelope schema")
  assert.ok((err?.properties as Record<string, unknown>)?.error, "Error envelope should include error")
})

test("OpenAPI defines Decimal schema as string", () => {
  const spec = parseOpenAPI(OPENAAPI_PATH)
  const schemas = (spec.components as Record<string, unknown> | undefined)?.schemas as Record<string, unknown> ?? {}
  const dec = schemas?.Decimal as Record<string, unknown> | undefined
  assert.ok(dec, "Should define Decimal schema")
  assert.equal(dec?.type, "string", "Decimal should be string type")
})
