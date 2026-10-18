import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import app from '../../api/[...path].js'
import { loadAIConfig } from '../lib/aiConfig.js'
import {
  AIConfigurationError,
  AIProviderError,
} from '../lib/providers/AIProviderError.js'
import { MAX_PDF_SIZE, validatePdfUpload } from '../lib/pdfUpload.js'
import { askOllama } from '../lib/providers/ollama.js'

test('Ollama configuration uses the documented safe defaults', () => {
  assert.deepEqual(loadAIConfig({}), {
    provider: 'ollama',
    model: 'qwen3:4b',
    baseUrl: 'http://127.0.0.1:11434',
    timeoutMs: 600_000,
  })
})

test('AI_TIMEOUT_MS accepts configured limits and rejects unsafe values', () => {
  assert.equal(
    loadAIConfig({ AI_TIMEOUT_MS: '120000' }).timeoutMs,
    120_000,
  )
  assert.equal(
    loadAIConfig({ AI_TIMEOUT_MS: '900000' }).timeoutMs,
    900_000,
  )

  for (const value of ['119999', '900001', '1.5', 'not-a-number']) {
    assert.throws(
      () => loadAIConfig({ AI_TIMEOUT_MS: value }),
      (error) => error instanceof AIConfigurationError,
    )
  }
})

test('Anthropic defaults below Vercel duration and Vercel rejects local Ollama', () => {
  assert.equal(
    loadAIConfig({
      VERCEL: '1',
      AI_PROVIDER: 'anthropic',
      AI_MODEL: 'account-model',
      ANTHROPIC_API_KEY: 'placeholder-key',
    }).timeoutMs,
    270_000,
  )

  assert.throws(
    () =>
      loadAIConfig({
        VERCEL: '1',
        AI_PROVIDER: 'anthropic',
        AI_MODEL: 'account-model',
        ANTHROPIC_API_KEY: 'placeholder-key',
        AI_TIMEOUT_MS: '300000',
      }),
    (error) =>
      error instanceof AIConfigurationError &&
      error.message.includes('AI_TIMEOUT_MS'),
  )

  assert.throws(
    () => loadAIConfig({ VERCEL: '1', AI_PROVIDER: 'ollama' }),
    (error) =>
      error instanceof AIConfigurationError &&
      error.message.includes('Vercel deployments'),
  )
})

test('AI configuration rejects unsupported providers and invalid model configuration', () => {
  assert.throws(
    () => loadAIConfig({ AI_PROVIDER: 'unknown' }),
    (error) => error instanceof AIConfigurationError,
  )
  assert.throws(
    () => loadAIConfig({ AI_PROVIDER: 'anthropic', AI_MODEL: ' ' }),
    (error) =>
      error instanceof AIConfigurationError &&
      !error.message.includes('ANTHROPIC_API_KEY'),
  )
})

test('Anthropic configuration requires a model and a non-empty API key', () => {
  assert.throws(
    () => loadAIConfig({ AI_PROVIDER: 'anthropic', AI_MODEL: 'claude-model' }),
    (error) =>
      error instanceof AIConfigurationError &&
      error.message.includes('ANTHROPIC_API_KEY'),
  )
  assert.throws(
    () =>
      loadAIConfig({
        AI_PROVIDER: 'anthropic',
        ANTHROPIC_API_KEY: 'placeholder-key',
      }),
    (error) =>
      error instanceof AIConfigurationError &&
      error.message.includes('AI_MODEL'),
  )
})

test('Ollama configuration rejects non-HTTP URLs', () => {
  assert.throws(
    () =>
      loadAIConfig({
        AI_PROVIDER: 'ollama',
        AI_BASE_URL: 'file:///etc/passwd',
      }),
    (error) =>
      error instanceof AIConfigurationError &&
      error.message.includes('AI_BASE_URL'),
  )
})

test('PDF validation checks MIME type, size and the PDF signature', () => {
  const signature = Buffer.from('%PDF-1.7\n')
  assert.equal(
    validatePdfUpload({
      mimetype: 'application/pdf',
      size: signature.length,
      buffer: signature,
    }).valid,
    true,
  )
  assert.equal(
    validatePdfUpload({
      mimetype: 'image/png',
      size: signature.length,
      buffer: signature,
    }).valid,
    false,
  )
  assert.equal(
    validatePdfUpload({
      mimetype: 'application/pdf',
      size: 10,
      buffer: Buffer.from('not a pdf'),
    }).valid,
    false,
  )
  assert.equal(
    validatePdfUpload({
      mimetype: 'application/pdf',
      size: MAX_PDF_SIZE + 1,
      buffer: signature,
    }).valid,
    false,
  )
})

test('provider errors keep provider status separate from configuration errors', () => {
  assert.equal(new AIProviderError('provider unavailable').statusCode, 502)
  assert.equal(new AIConfigurationError('configuration missing').statusCode, 503)
})

test('Ollama adapter uses its configured timeout and maps timeout errors safely', async () => {
  const originalFetch = globalThis.fetch
  const originalTimeout = AbortSignal.timeout
  let observedTimeout

  try {
    AbortSignal.timeout = (timeoutMs) => {
      observedTimeout = timeoutMs
      return new AbortController().signal
    }
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({ message: { content: 'analysis result' } }),
    })

    assert.equal(
      await askOllama('prompt', 'qwen3:4b', 'http://127.0.0.1:11434', 600_000),
      'analysis result',
    )
    assert.equal(observedTimeout, 600_000)

    globalThis.fetch = async () => {
      throw new DOMException('operation timed out', 'TimeoutError')
    }
    await assert.rejects(
      askOllama('prompt', 'qwen3:4b', 'http://127.0.0.1:11434', 600_000),
      (error) =>
        error instanceof AIProviderError &&
        error.message === 'Ollama analysis timed out. Please try again later.',
    )
  } finally {
    globalThis.fetch = originalFetch
    AbortSignal.timeout = originalTimeout
  }
})

let server
let baseUrl

before(async () => {
  server = app.listen(0)
  await new Promise((resolve, reject) => {
    server.once('listening', resolve)
    server.once('error', reject)
  })
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()))
    })
  }
})

async function postFile(file, fieldName = 'agreement') {
  const form = new FormData()
  if (file) {
    form.append(
      fieldName,
      new Blob([file.content], { type: file.type }),
      'upload.pdf',
    )
  }

  return fetch(`${baseUrl}/api/review`, {
    method: 'POST',
    body: form,
  })
}

test('Vercel API handler exposes the existing health endpoint', async () => {
  const response = await fetch(`${baseUrl}/api/health`)
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { ok: true })
})

test('review endpoint safely rejects missing and invalid uploads', async () => {
  const missingFile = await postFile(null)
  assert.equal(missingFile.status, 400)
  assert.deepEqual(await missingFile.json(), {
    error: 'Upload the agreement as a PDF.',
  })

  const invalidMime = await postFile({
    type: 'image/png',
    content: '%PDF-1.7',
  })
  assert.equal(invalidMime.status, 400)
  assert.match((await invalidMime.json()).error, /PDF/)

  const invalidSignature = await postFile({
    type: 'application/pdf',
    content: 'not a PDF document',
  })
  assert.equal(invalidSignature.status, 400)
  assert.match((await invalidSignature.json()).error, /not a valid PDF/)
})

test('review endpoint safely rejects oversized and unexpected multipart uploads', async () => {
  const oversized = await postFile({
    type: 'application/pdf',
    content: Buffer.alloc(MAX_PDF_SIZE + 1),
  })
  assert.equal(oversized.status, 413)
  assert.deepEqual(await oversized.json(), {
    error: 'Keep the PDF under 4 MB.',
  })

  const unexpectedField = await postFile(
    { type: 'application/pdf', content: '%PDF-1.7' },
    'unexpected',
  )
  assert.equal(unexpectedField.status, 400)
  assert.deepEqual(await unexpectedField.json(), {
    error: 'Upload one PDF file using the agreement field.',
  })
})

test('JSON body parser errors return safe client messages', async () => {
  const oversized = await fetch(`${baseUrl}/api/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: 'x'.repeat(17 * 1024) }),
  })
  assert.equal(oversized.status, 413)
  assert.deepEqual(await oversized.json(), {
    error: 'The request body is too large.',
  })

  const invalidJson = await fetch(`${baseUrl}/api/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"broken":',
  })
  assert.equal(invalidJson.status, 400)
  assert.deepEqual(await invalidJson.json(), {
    error: 'The request body contains invalid JSON.',
  })
})
