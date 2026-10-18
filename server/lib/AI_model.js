import { askAnthropic } from './providers/anthropic.js'
import { askOllama } from './providers/ollama.js'
import { loadAIConfig } from './aiConfig.js'
import {
  AIConfigurationError,
  AIProviderError,
} from './providers/AIProviderError.js'

export { AIConfigurationError, AIProviderError }

export async function askAI(prompt, options = {}) {
  const config = loadAIConfig()
  if (config.provider === 'anthropic') {
    return askAnthropic(
      prompt,
      config.model,
      config.apiKey,
      config.timeoutMs,
      options,
    )
  }

  return askOllama(
    prompt,
    config.model,
    config.baseUrl,
    config.timeoutMs,
    options,
  )
}
