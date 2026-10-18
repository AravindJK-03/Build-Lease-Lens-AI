import { useState } from 'react'
import { reviewAgreement } from './lib/api.js'

const MAX_FILE_SIZE = 4 * 1024 * 1024

const sectionTitles = new Set([
  'important details',
  'missing information',
  'potential risks for the tenant',
  'questions the tenant should ask',
])

function formatFileSize(size) {
  return size < 1024 * 1024
    ? `${Math.max(1, Math.round(size / 1024))} KB`
    : `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function renderInlineMarkdown(text) {
  return text.split(/(\*\*.+?\*\*|__.+?__|`[^`]+`|\*[^*\n]+\*)/g).map(
    (part, index) => {
      if (
        (part.startsWith('**') && part.endsWith('**')) ||
        (part.startsWith('__') && part.endsWith('__'))
      ) {
        return <strong key={index}>{part.slice(2, -2)}</strong>
      }

      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code
            key={index}
            className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.9em] text-slate-800"
          >
            {part.slice(1, -1)}
          </code>
        )
      }

      if (part.startsWith('*') && part.endsWith('*')) {
        return <em key={index}>{part.slice(1, -1)}</em>
      }

      return part
    },
  )
}

function renderMarkdown(markdown) {
  const lines = String(markdown).replace(/\r\n?/g, '\n').split('\n')
  const blocks = []
  let paragraph = []
  let index = 0

  function flushParagraph() {
    if (!paragraph.length) return
    blocks.push(
      <p key={`paragraph-${index++}`} className="leading-7 text-slate-600">
        {renderInlineMarkdown(paragraph.join(' '))}
      </p>,
    )
    paragraph = []
  }

  while (index < lines.length) {
    const line = lines[index].trim()
    const plainTitle = line
      .replace(/^#{1,6}\s*/, '')
      .replace(/\*\*/g, '')
      .replace(/__/g, '')
      .replace(/^\d+[.)]\s*/, '')
      .replace(/:$/, '')
      .trim()
      .toLowerCase()

    if (!line) {
      flushParagraph()
      index += 1
      continue
    }

    if (/^([-*_])(?:\s*\1){2,}$/.test(line)) {
      flushParagraph()
      blocks.push(
        <hr key={`rule-${index++}`} className="my-2 border-slate-200" />,
      )
      continue
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/)
    if (heading || sectionTitles.has(plainTitle)) {
      flushParagraph()
      const title = heading ? heading[2] : line.replace(/^\d+[.)]\s*/, '')
      blocks.push(
        <h3
          key={`heading-${index++}`}
          className="pt-3 text-base font-bold tracking-tight text-slate-900 first:pt-0"
        >
          {renderInlineMarkdown(title)}
        </h3>,
      )
      continue
    }

    const unordered = line.match(/^[-*+]\s+(.+)$/)
    const ordered = line.match(/^\d+[.)]\s+(.+)$/)
    if (unordered || ordered) {
      flushParagraph()
      const isOrdered = Boolean(ordered)
      const items = []

      while (index < lines.length) {
        const listLine = lines[index].trim()
        const item = isOrdered
          ? listLine.match(/^\d+[.)]\s+(.+)$/)
          : listLine.match(/^[-*+]\s+(.+)$/)
        if (!item) break

        items.push(
          <li key={`item-${index}`}>
            {renderInlineMarkdown(item[1])}
          </li>,
        )
        index += 1
      }

      const List = isOrdered ? 'ol' : 'ul'
      blocks.push(
        <List
          key={`list-${index}`}
          className={`space-y-2 pl-5 leading-7 text-slate-600 ${
            isOrdered ? 'list-decimal' : 'list-disc marker:text-blue-500'
          }`}
        >
          {items}
        </List>,
      )
      continue
    }

    paragraph.push(line)
    index += 1
  }

  flushParagraph()
  return blocks
}

function App() {
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [isDragging, setIsDragging] = useState(false)

  function selectFile(nextFile) {
    setFile(nextFile)
    setError('')
    setResult(null)
  }

  function handleDrop(event) {
    event.preventDefault()
    setIsDragging(false)
    selectFile(event.dataTransfer.files?.[0] ?? null)
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (!file) {
      setError('Please select a PDF first.')
      return
    }

    if (file.type !== 'application/pdf') {
      setError('Please select a PDF file.')
      return
    }

    if (file.size > MAX_FILE_SIZE) {
      setError('Please select a PDF smaller than 4 MB.')
      return
    }

    setLoading(true)
    setError('')
    setResult(null)

    try {
      const data = await reviewAgreement(file)
      setResult(data)
    } catch (err) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f9fc] text-slate-900">
      <header className="border-b border-slate-200/80 bg-white/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <a href="#" className="flex items-center gap-3" aria-label="Lease Lens AI home">
            <span className="flex size-10 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm">
              <svg viewBox="0 0 24 24" fill="none" className="size-5" aria-hidden="true">
                <path d="M4.5 20V6.5L12 3l7.5 3.5V20M8 20v-5h8v5M9 9h.01M15 9h.01" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span>
              <span className="block text-sm font-bold tracking-tight text-slate-900">Lease Lens <span className="text-blue-600">AI</span></span>
              <span className="hidden text-xs text-slate-500 sm:block">Clarity before you sign</span>
            </span>
          </a>
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600">
            <span className="size-2 rounded-full bg-emerald-500" />
            Private document review
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 pb-12 pt-12 sm:px-8 sm:pt-16">
        <section className="mx-auto max-w-3xl text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3.5 py-1.5 text-xs font-semibold text-blue-800">
            <svg viewBox="0 0 20 20" fill="none" className="size-4" aria-hidden="true">
              <path d="m10 2 1.8 5.2L17 9l-5.2 1.8L10 16l-1.8-5.2L3 9l5.2-1.8L10 2Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
              <path d="m16 13 .8 2.2L19 16l-2.2.8L16 19l-.8-2.2L13 16l2.2-.8L16 13Z" fill="currentColor" />
            </svg>
            A clearer way to review your lease
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
            Know what you&apos;re
            <span className="block bg-gradient-to-r from-blue-700 to-violet-600 bg-clip-text text-transparent">
              signing up for.
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
            Lease Lens helps tenants understand rental agreements by highlighting
            important details, missing information, and terms worth a closer look.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-slate-500">
            <span className="inline-flex items-center gap-2">
              <svg viewBox="0 0 20 20" fill="none" className="size-4 text-blue-600" aria-hidden="true">
                <path d="M5 3.5h6l4 4V16a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                <path d="M11 3.5V8h4M7 11h6M7 14h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              Simple PDF upload
            </span>
            <span className="inline-flex items-center gap-2">
              <svg viewBox="0 0 20 20" fill="none" className="size-4 text-violet-600" aria-hidden="true">
                <path d="M10 2.5 12 8l5.5 2-5.5 2-2 5.5L8 12l-5.5-2L8 8l2-5.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
              </svg>
              Clear AI-powered insights
            </span>
          </div>
        </section>

        <form
          onSubmit={handleSubmit}
          className="mx-auto mt-10 max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_45px_-24px_rgba(15,23,42,0.25)] sm:mt-12 sm:p-8"
        >
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-slate-900">
                Start with your rental agreement
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Upload a PDF to get a plain-language review.
              </p>
            </div>
            <span className="hidden rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 sm:inline-flex">
              PDF · up to 4 MB
            </span>
          </div>

          <label
            htmlFor="agreement"
            onDragEnter={(event) => {
              event.preventDefault()
              setIsDragging(true)
            }}
            onDragOver={(event) => {
              event.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={(event) => {
              event.preventDefault()
              if (!event.currentTarget.contains(event.relatedTarget)) {
                setIsDragging(false)
              }
            }}
            onDrop={handleDrop}
            className={`group relative flex cursor-pointer flex-col items-center rounded-xl border border-dashed px-5 py-8 text-center transition-colors focus-within:ring-4 focus-within:ring-blue-100 sm:py-10 ${
              isDragging
                ? 'border-blue-500 bg-blue-50'
                : 'border-slate-300 bg-slate-50/70 hover:border-blue-400 hover:bg-blue-50/50'
            }`}
          >
            <input
              id="agreement"
              type="file"
              accept="application/pdf,.pdf"
              onChange={(event) => {
                selectFile(event.target.files?.[0] ?? null)
                event.currentTarget.value = ''
              }}
              className="sr-only"
            />
            <span className="mb-4 flex size-12 items-center justify-center rounded-xl bg-white text-blue-700 shadow-sm ring-1 ring-slate-200 transition group-hover:scale-105">
              <svg viewBox="0 0 24 24" fill="none" className="size-6" aria-hidden="true">
                <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14.5v4A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5v-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            {file ? (
              <>
                <span className="max-w-full truncate text-sm font-semibold text-slate-900">
                  {file.name}
                </span>
                <span className="mt-1 text-sm text-slate-500">
                  {formatFileSize(file.size)} <span aria-hidden="true">·</span> Click to choose a different file
                </span>
              </>
            ) : (
              <>
                <span className="text-sm font-semibold text-slate-800">
                  Drop your PDF here, or <span className="text-blue-700">browse files</span>
                </span>
                <span className="mt-2 text-xs text-slate-500">
                  PDF format only <span aria-hidden="true">·</span> Maximum file size 4 MB
                </span>
              </>
            )}
          </label>

          <div className="mt-5 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <button
              type="submit"
              disabled={!file || loading}
              className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none"
            >
              {loading ? (
                <>
                  <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-90" />
                  </svg>
                  Analyzing agreement…
                </>
              ) : (
                <>
                  Analyze Agreement
                  <svg viewBox="0 0 20 20" fill="none" className="size-4" aria-hidden="true">
                    <path d="M4 10h12m-5-5 5 5-5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </>
              )}
            </button>
            <p className="text-center text-xs leading-5 text-slate-500 sm:max-w-44 sm:text-left">
              Your document is used to generate this review.
            </p>
          </div>

          {loading && (
            <div
              className="mt-5 flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 text-blue-950"
              role="status"
              aria-live="polite"
            >
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-white text-blue-700">
                <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                  <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
              </span>
              <span>
                <span className="block text-sm font-semibold">Review in progress</span>
                <span className="mt-1 block text-sm leading-6 text-blue-900/80">
                  Text extraction and AI analysis may take a little while. Please keep this page open.
                </span>
              </span>
            </div>
          )}

          {error && (
            <div
              className="mt-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-900"
              role="alert"
            >
              <svg viewBox="0 0 20 20" fill="none" className="mt-0.5 size-5 shrink-0" aria-hidden="true">
                <path d="M10 2.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15Z" stroke="currentColor" strokeWidth="1.5" />
                <path d="M10 6.5v4m0 3h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              <p className="text-sm font-medium leading-6">{error}</p>
            </div>
          )}
        </form>

        {result && (
          <section className="mx-auto mt-8 max-w-3xl space-y-5" aria-live="polite">
            <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 sm:p-5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-emerald-700 ring-1 ring-emerald-200">
                <svg viewBox="0 0 20 20" fill="none" className="size-5" aria-hidden="true">
                  <path d="m5 10.5 3.2 3.2L15.5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <div>
                <h2 className="font-semibold text-emerald-950">Your agreement review is ready</h2>
                <p className="mt-1 text-sm text-emerald-900/80">
                  {result.characters} characters extracted from your PDF.
                </p>
              </div>
            </div>

            {result.analysis ? (
              <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_12px_45px_-24px_rgba(15,23,42,0.25)]">
                <div className="border-b border-slate-100 px-5 py-5 sm:px-7">
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 text-white shadow-sm">
                      <svg viewBox="0 0 20 20" fill="none" className="size-5" aria-hidden="true">
                        <path d="M10 2.5 12 8l5.5 2-5.5 2-2 5.5L8 12l-5.5-2L8 8l2-5.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <div>
                      <h2 className="text-lg font-semibold tracking-tight text-slate-900">Your lease, made clearer</h2>
                      <p className="mt-0.5 text-sm text-slate-500">AI-generated insights from your agreement</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-5 px-5 py-6 text-sm sm:px-7 sm:py-7">
                  {renderMarkdown(result.analysis)}
                </div>
              </article>
            ) : (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
                PDF text was extracted, but no AI analysis was returned. Please check the backend response.
              </div>
            )}

            <details className="group overflow-hidden rounded-xl border border-slate-200 bg-white">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-semibold text-slate-800 marker:hidden focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-blue-100">
                <span className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                    <svg viewBox="0 0 20 20" fill="none" className="size-4" aria-hidden="true">
                      <path d="M3 5h14M3 10h14M3 15h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </span>
                  View extracted text preview
                </span>
                <svg viewBox="0 0 20 20" fill="none" className="size-4 shrink-0 text-slate-400 transition group-open:rotate-180" aria-hidden="true">
                  <path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </summary>
              <div className="border-t border-slate-100 px-5 py-4">
                <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-4 font-sans text-xs leading-6 text-slate-600">
                  {result.preview}
                </pre>
              </div>
            </details>

            <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/70 p-4">
              <svg viewBox="0 0 20 20" fill="none" className="mt-0.5 size-5 shrink-0 text-blue-700" aria-hidden="true">
                <path d="M10 2.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15Z" stroke="currentColor" strokeWidth="1.5" />
                <path d="M10 9v4m0-7h.01" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
              <p className="text-xs leading-5 text-slate-700">
                <span className="font-semibold text-slate-900">Informational disclaimer:</span> Lease Lens provides general information to help you review rental agreements. This AI-generated analysis is not legal advice and does not replace guidance from a qualified professional.
              </p>
            </div>
          </section>
        )}

        {!result && (
          <p className="mx-auto mt-6 max-w-3xl text-center text-xs leading-5 text-slate-500">
            Lease Lens provides general information to help you review rental agreements. It does not replace professional legal advice.
          </p>
        )}

        <footer className="mx-auto mt-12 flex max-w-6xl flex-col items-center justify-between gap-3 border-t border-slate-200 pt-5 text-xs text-slate-500 sm:flex-row">
          <span>© {new Date().getFullYear()} Lease Lens AI</span>
          <span>Clarity and confidence, one lease at a time.</span>
        </footer>
      </div>
    </main>
  )
}

export default App
