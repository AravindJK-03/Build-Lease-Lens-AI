import { AIProviderError } from './AIProviderError.js'

function getProviderError(status) {
  if (status === 404) {
    return 'The configured Ollama model was not found. Check AI_MODEL and ensure the model is available locally.'
  }

  if (status >= 500) {
    return 'Ollama could not complete the analysis. Check that the service is running and try again.'
  }

  return 'Ollama rejected the request. Check the provider configuration and try again.'
}

export async function askOllama(
  prompt,
  model,
  baseUrl,
  timeoutMs,
  options = {},
) {
  try {
    const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        ...options,
        model,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
        num_predict: options.num_predict ?? 4096,
      }),
    })

    if (!response.ok) {
      throw new AIProviderError(getProviderError(response.status))
    }

    const data = await response.json()

    if (
      typeof data?.message?.content !== 'string' ||
      !data.message.content.trim()
    ) {
      throw new AIProviderError('Ollama returned no analysis text.')
    }

    return data.message.content
  } catch (error) {
    if (error instanceof AIProviderError) {
      throw error
    }

    if (error?.name === 'TimeoutError') {
      throw new AIProviderError(
        'Ollama analysis timed out. Please try again later.',
      )
    }

    if (error instanceof SyntaxError) {
      throw new AIProviderError('Ollama returned an invalid response.')
    }

    throw new AIProviderError(
      'Could not reach Ollama. Check AI_BASE_URL and ensure Ollama is running.',
    )
  }
}
