import { NextRequest } from "next/server"
import { apiSuccess, apiError, handleApiError } from "@/server/api/response"
import { requireAuth } from "@/server/api/auth-context"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"

export async function GET(_req: NextRequest) {
  try {
    const ctx = await requireAuth()

    // Use Better Auth's internal session listing via auth.api
    // listSessions returns the authenticated user's active sessions
    const sessionResult = await auth.api.listSessions({
      headers: await headers(),
    })

    if (!sessionResult || sessionResult instanceof Response) {
      // If listSessions is not supported, return current active session
      const activeSession = await auth.api.getSession({ headers: await headers() })
      if (!activeSession) {
        return apiError(401, "UNAUTHENTICATED", "No active session")
      }
      return apiSuccess({
        sessions: [{
          id: activeSession.session.id,
          createdAt: activeSession.session.createdAt,
          expiresAt: activeSession.session.expiresAt,
          ipAddress: activeSession.session.ipAddress ?? null,
          userAgent: activeSession.session.userAgent ?? null,
          isCurrent: true,
        }],
      })
    }

    return apiSuccess(sessionResult)
  } catch {
    try {
      // Fallback: return current active session DTO
      const activeSession = await auth.api.getSession({ headers: await headers() })
      if (!activeSession) {
        return apiError(401, "UNAUTHENTICATED", "No active session")
      }
      return apiSuccess({
        sessions: [{
          id: activeSession.session.id,
          createdAt: activeSession.session.createdAt,
          expiresAt: activeSession.session.expiresAt,
          ipAddress: activeSession.session.ipAddress ?? null,
          userAgent: activeSession.session.userAgent ?? null,
          isCurrent: true,
        }],
      })
    } catch (e) {
      return handleApiError(e)
    }
  }
}
