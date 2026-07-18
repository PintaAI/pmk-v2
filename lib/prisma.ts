import { PrismaClient } from '../generated/prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }

function isNeonDb(url: string): boolean {
  return url.includes("neon.tech") || url.includes("neondb.io") || process.env.PRISMA_ADAPTER === "neon"
}

function createClient() {
  const url = process.env.DATABASE_URL ?? ""

  if (isNeonDb(url)) {
    return new PrismaClient({ adapter: new PrismaNeon({ connectionString: url }) })
  }

  return new PrismaClient({ adapter: new PrismaPg(url) })
}

export const prisma = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
