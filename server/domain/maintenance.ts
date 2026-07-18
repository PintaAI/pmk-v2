// Write-maintenance switch for migration cutover.
// When enabled, all business mutations return 503 MIGRATION_IN_PROGRESS.
import { MaintenanceError } from "@/server/domain/errors"

const MAINTENANCE_ENV = "MAINTENANCE_MODE"
const MAINTENANCE_TOKEN_ENV = "MAINTENANCE_TOKEN"

export function isMaintenanceMode(): boolean {
  return process.env[MAINTENANCE_ENV] === "1"
}

export function checkMaintenanceToken(token: string | null): boolean {
  if (!process.env[MAINTENANCE_TOKEN_ENV]) return false
  return token === process.env[MAINTENANCE_TOKEN_ENV]
}

export function requireNotMaintenance(): void {
  if (isMaintenanceMode()) {
    throw new MaintenanceError("MIGRATION_IN_PROGRESS")
  }
}
