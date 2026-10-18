import { z } from 'zod'

export const MAX_PDF_SIZE = 4 * 1024 * 1024
const PDF_SIGNATURE = Buffer.from('%PDF-')

const uploadSchema = z.object({
  mimetype: z.literal('application/pdf'),
  size: z.number().int().positive().max(MAX_PDF_SIZE),
  buffer: z.instanceof(Buffer),
})

export function validatePdfUpload(file) {
  if (!file) {
    return {
      valid: false,
      error: 'Upload the agreement as a PDF.',
    }
  }

  const result = uploadSchema.safeParse(file)
  if (!result.success) {
    return {
      valid: false,
      error: 'Upload the agreement as a PDF under 4 MB.',
    }
  }

  if (!result.data.buffer.subarray(0, PDF_SIGNATURE.length).equals(PDF_SIGNATURE)) {
    return {
      valid: false,
      error: 'The uploaded file is not a valid PDF. Please select a PDF document.',
    }
  }

  return { valid: true, buffer: result.data.buffer }
}
