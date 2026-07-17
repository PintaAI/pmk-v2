import { requireUser } from '@/lib/auth-required'

function getSuperAdminEmails() {
  return new Set(
    (process.env.SUPER_ADMIN_EMAILS ?? '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  )
}

export function isSuperAdminEmail(email: string) {
  return getSuperAdminEmails().has(email.trim().toLowerCase())
}

export async function requireSuperAdmin() {
  const user = await requireUser()

  if (!isSuperAdminEmail(user.email)) {
    throw new Error('Forbidden')
  }

  return user
}
