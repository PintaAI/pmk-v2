export class ValidationError extends Error {
  constructor(message: string, public readonly details?: Record<string, unknown>) {
    super(message)
    this.name = "ValidationError"
  }
}

export class UnauthenticatedError extends Error {
  constructor(message = "Authentication required") {
    super(message)
    this.name = "UnauthenticatedError"
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message)
    this.name = "ForbiddenError"
  }
}

export class NotFoundError extends Error {
  constructor(message = "Not found") {
    super(message)
    this.name = "NotFoundError"
  }
}

export class ConflictError extends Error {
  constructor(message = "Conflict") {
    super(message)
    this.name = "ConflictError"
  }
}

export class InsufficientStockError extends Error {
  constructor(itemName: string, requested: string, available: string) {
    super(`Insufficient stock for ${itemName}: requested ${requested}, available ${available}`)
    this.name = "InsufficientStockError"
  }
}

export class IdempotencyConflictError extends Error {
  constructor(message = "Idempotency key conflict: different request payload") {
    super(message)
    this.name = "IdempotencyConflictError"
  }
}

export class MaintenanceError extends Error {
  constructor(message = "MIGRATION_IN_PROGRESS") {
    super(message)
    this.name = "MaintenanceError"
  }
}

export class InternalError extends Error {
  constructor(message = "Internal server error") {
    super(message)
    this.name = "InternalError"
  }
}
