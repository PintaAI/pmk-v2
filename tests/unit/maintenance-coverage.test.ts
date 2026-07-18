// Maintenance coverage test: verifies every business mutation Server Action
// has a maintenance check. Reads must remain available without maintenance.
import { test } from "node:test"
import assert from "node:assert"
import fs from "node:fs"
import path from "node:path"

const actionsDir = path.join(import.meta.dirname ?? __dirname, "..", "..", "app", "actions")

// Read-only actions that should NOT have maintenance checks
const readOnly = new Set([
  "getCashierProducts", "getDailyClosingRecapAction", "listPriceTiersAction",
  "getCurrentTokoAction", "listStaffAction", "changePassword",
])

function getActionFiles(): string[] {
  return fs.readdirSync(actionsDir).filter((f) => f.endsWith(".ts")).map((f) => path.join(actionsDir, f))
}

function findExportedActions(filePath: string): string[] {
  const content = fs.readFileSync(filePath, "utf-8")
  const matches = content.matchAll(/export async function (\w+)/g)
  return Array.from(matches).map((m) => m[1])
}

// Check whether an action has a maintenance call by scanning function body
function actionHasMaintenance(filePath: string, actionName: string): boolean {
  const content = fs.readFileSync(filePath, "utf-8")
  const lines = content.split("\n")
  let inFunc = false

  for (const line of lines) {
    if (line.includes(`export async function ${actionName}`)) {
      inFunc = true
      continue
    }
    if (!inFunc) continue
    if (line.trim().startsWith("export ")) {
      break // next exported function, our function ended
    }
    if (line.includes("checkMaintenance()")) {
      return true
    }
  }
  return false
}

// Actions whose names suggest read-only (get*/list*/find*) and don't contain
// prisma mutation operations are automatically excluded
function isLikelyReadOnly(filePath: string, actionName: string): boolean {
  if (readOnly.has(actionName)) return true
  if (/^(get|list|find)/.test(actionName)) {
    const content = fs.readFileSync(filePath, "utf-8")
    const funcStart = content.indexOf(`export async function ${actionName}`)
    if (funcStart === -1) return true
    // Check if function body contains mutation Prisma calls
    const nextFunc = content.indexOf("export async function", funcStart + 1)
    const body = content.substring(funcStart, nextFunc === -1 ? content.length : nextFunc)
    if (!/\.(create|update|delete|upsert|deleteMany|createMany)\b/.test(body)) {
      return true
    }
  }
  return false
}

test("All mutation Server Actions have maintenance checks", () => {
  const files = getActionFiles()
  const missing: string[] = []

  for (const file of files) {
    const actions = findExportedActions(file)
    const fileName = path.basename(file)

    for (const action of actions) {
      if (isLikelyReadOnly(file, action)) continue

      if (!actionHasMaintenance(file, action)) {
        missing.push(`${fileName}:${action}`)
      }
    }
  }

  if (missing.length > 0) {
    console.error("Actions missing maintenance check:")
    for (const m of missing) console.error(`  ${m}`)
  }
  assert.equal(missing.length, 0, `${missing.length} mutation actions lack maintenance check`)
})
