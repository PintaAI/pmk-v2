import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { nextCookies } from 'better-auth/next-js'
import { prisma } from './prisma'

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  emailAndPassword: {
    enabled: true,
  },
  baseURL: {
    allowedHosts: ['localhost:3000', '*.vercel.app', 'jennie-linux.tail2268a1.ts.net'],
    protocol: 'auto',
    fallback: process.env.BETTER_AUTH_URL,
  },
  trustedOrigins: [
    'https://jennie-linux.tail2268a1.ts.net',
    'http://localhost:3000',
    'https://*.vercel.app',
  ],
  experimental: {
    joins: true,
  },
  plugins: [nextCookies()],
})
