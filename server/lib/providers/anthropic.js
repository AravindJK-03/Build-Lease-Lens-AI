import Anthropic from '@anthropic-ai/sdk'
import { AIProviderError } from './AIProviderError.js'

function getProviderError(status) {
  if (status === 401 || status === 403) {
    return 'Anthropic authentication failed. Check ANTHROPIC_API_KEY.'
  }

  if (status === 429) {
    return 'Anthropic is rate limiting requests. Please try again later.'
  }

  if (status === 400) {
    return 'Anthropic rejected the request. Check that AI_MODEL is available to your account.'
  }

  if (status >= 500) {
    return 'Anthropic is temporarily unavailable. Please try again later.'
  }

  return 'Anthropic could not complete the analysis. Check the provider configuration and try again.'
}

export async function askAnthropic(
  prompt,
  model,
  apiKey,
  timeoutMs,
  options = {},
) {
  const client = new Anthropic({
    apiKey,
    timeout: timeoutMs,
  })
  const { max_tokens = 4096, ...requestOptions } = options

  let response
  try {
    response = await client.messages.create({
      ...requestOptions,
      model,
      max_tokens,
      messages: [{ role: 'user', content: prompt }],
    })
  } catch (error) {
    if (typeof error?.status === 'number') {
      throw new AIProviderError(getProviderError(error.status))
    }

    if (error?.name === 'APIConnectionTimeoutError') {
      throw new AIProviderError(
        'Anthropic analysis timed out. Please try again later.',
      )
    }

    throw new AIProviderError(
      'Could not reach Anthropic. Check the network connection and try again.',
    )
  }

  const text = response.content
    ?.filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('')

  if (!text) {
    throw new AIProviderError('Anthropic returned no analysis text.')
  }

  return text
}
