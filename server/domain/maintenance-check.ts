import { isMaintenanceMode } from "@/server/domain/maintenance"
import { MaintenanceError } from "@/server/domain/errors"

export function checkMaintenance(): void {
  if (isMaintenanceMode()) {
    throw new MaintenanceError("MIGRATION_IN_PROGRESS")
  }
}
