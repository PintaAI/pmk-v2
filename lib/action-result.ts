export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string }

export function success<T>(data: T): ActionResult<T> {
  return { success: true, data }
}

export function failure(error: string): ActionResult<never> {
  return { success: false, error }
}

export async function toActionResult<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return success(await fn())
  } catch (error) {
    return failure(error instanceof Error ? error.message : 'Terjadi kesalahan. Silakan coba lagi.')
  }
}
