import { z } from 'zod'
import { AIConfigurationError } from './providers/AIProviderError.js'

const providerSchema = z.enum(['anthropic', 'ollama'])
const modelSchema = z.string().trim().min(1).max(200).regex(/^[^\r\n]+$/)
const apiKeySchema = z.string().trim().min(1).max(4096)
const timeoutSchema = z
  .string()
  .trim()
  .regex(/^\d+$/)
  .transform(Number)
  .pipe(z.number().int().min(120_000).max(900_000))
const ollamaUrlSchema = z
  .string()
  .trim()
  .url()
  .refine((value) => ['http:', 'https:'].includes(new URL(value).protocol))

function parseOrThrow(schema, value, message) {
  const result = schema.safeParse(value)
  if (!result.success) {
    throw new AIConfigurationError(message)
  }
  return result.data
}

export function loadAIConfig(env = process.env) {
  const rawProvider = env.AI_PROVIDER?.trim() || 'ollama'
  const provider = parseOrThrow(
    providerSchema,
    rawProvider,
    'AI_PROVIDER must be set to "anthropic" or "ollama".',
  )
  if (env.VERCEL && provider !== 'anthropic') {
    throw new AIConfigurationError(
      'Vercel deployments must use the Anthropic provider. Configure AI_PROVIDER and ANTHROPIC_API_KEY.',
    )
  }

  const maxTimeoutMs = env.VERCEL ? 270_000 : 900_000
  const timeoutMs =
    env.AI_TIMEOUT_MS === undefined
      ? provider === 'anthropic'
        ? 270_000
        : 600_000
      : parseOrThrow(
          timeoutSchema.refine((value) => value <= maxTimeoutMs),
          env.AI_TIMEOUT_MS,
          `AI_TIMEOUT_MS must be an integer between 120000 and ${maxTimeoutMs} milliseconds.`,
        )

  const rawModel = env.AI_MODEL
  const model =
    rawModel === undefined
      ? undefined
      : parseOrThrow(
          modelSchema,
          rawModel,
          'AI_MODEL must be a non-empty model name of at most 200 characters.',
        )

  if (provider === 'anthropic') {
    const apiKey = parseOrThrow(
      apiKeySchema,
      env.ANTHROPIC_API_KEY ?? '',
      'Anthropic is selected, but ANTHROPIC_API_KEY is missing or invalid.',
    )

    if (!model) {
      throw new AIConfigurationError(
        'Anthropic is selected, but AI_MODEL is not configured.',
      )
    }

    return { provider, model, apiKey, timeoutMs }
  }

  const baseUrl = parseOrThrow(
    ollamaUrlSchema,
    env.AI_BASE_URL || 'http://127.0.0.1:11434',
    'AI_BASE_URL must be a valid HTTP or HTTPS URL.',
  )

  return { provider, model: model || 'qwen3:4b', baseUrl, timeoutMs }
}
