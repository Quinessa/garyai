import { z } from 'zod'

const serverSchema = z.object({
  ENCRYPTION_KEY: z.string(),
  SUPABASE_SERVICE_ROLE_KEY: z.string(),
  TELEGRAM_BOT_TOKEN: z.string(),
  ALCHEMY_API_KEY: z.string(),
})

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string(),
  NEXT_PUBLIC_BOT_USERNAME: z.string().optional(),
  NEXT_PUBLIC_RPC_ENDPOINT: z.string(),
})

export const serverEnv = serverSchema.parse(process.env)
export const clientEnv = clientSchema.parse(process.env)

