import { Router } from 'express'
import multer from 'multer'
import { readPdf } from '../lib/readPdf.js'
import { AIProviderError, askAI } from '../lib/AI_model.js'
import { MAX_PDF_SIZE, validatePdfUpload } from '../lib/pdfUpload.js'

const router = Router()
const MAX_CONCURRENT_ANALYSES = 2
let activeAnalyses = 0

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_PDF_SIZE,
    files: 1,
    fields: 0,
    parts: 1,
  },
})

router.post(
  '/review',
  upload.single('agreement'),
  async (req, res) => {
    const uploadResult = validatePdfUpload(req.file)
    if (!uploadResult.valid) {
      return res.status(400).json({ error: uploadResult.error })
    }

    // 2. Extract text from PDF
    let text

    try {
      text = await readPdf(uploadResult.buffer)
    } catch (error) {
      console.error('[PDF Extraction]', error.message)

      return res.status(400).json({
        error: 'This PDF could not be read. Try exporting it again.',
      })
    }

    // 3. Validate extracted text
    if (text.length < 200) {
      return res.status(422).json({
        error: 'We could not find enough text in this PDF. Is it a scanned photo?',
      })
    }

    if (text.length > 60000) {
      return res.status(413).json({
        error: 'This agreement is too long for version one. Keep it under 20 pages.',
      })
    }

    if (activeAnalyses >= MAX_CONCURRENT_ANALYSES) {
      return res.status(503).json({
        error: 'The analysis service is busy. Please try again shortly.',
      })
    }

    // 4. Analyze the agreement using the configured AI provider
    let analysis
    activeAnalyses += 1

    try {
      analysis = await askAI(`
You are Lease Lens, a rental agreement analysis assistant.

Analyze the rental agreement below.

Return these sections:

1. Important Details
- Identify the landlord and tenant if mentioned.
- Identify the property, rent, deposit, lease duration, and notice period if mentioned.

2. Missing Information
- List important details that are not stated clearly in the agreement.

3. Potential Risks for the Tenant
- Highlight unclear, unusual, or potentially unfavorable terms.
- Explain why each term may need attention.
- Do not claim that a term is illegal unless the agreement provides enough evidence.

4. Questions the Tenant Should Ask
- Suggest practical questions to clarify the agreement before signing.

Rules:
- Use only information supported by the agreement.
- Never invent names, amounts, dates, or clauses.
- If information is missing, explicitly say so.
- Missing information alone does not prove a legal violation.
- Use simple English.
- This is general information, not legal advice.

AGREEMENT TEXT:
${text}
`)
    } catch (error) {
      const message =
        error instanceof AIProviderError
          ? error.message
          : 'AI analysis failed. Please try again later.'
      console.error('[AI Analysis]', message)

      return res.status(
        error instanceof AIProviderError ? error.statusCode : 502,
      ).json({
        error: message,
      })
    } finally {
      activeAnalyses -= 1
    }

    // 5. Send the extracted text preview and AI analysis to the frontend
    return res.json({
      characters: text.length,
      preview: text.slice(0, 300),
      analysis,
    })
  },
)

export default router
