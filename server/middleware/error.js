import multer from 'multer'
import { ZodError } from 'zod'

export function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err)
  }

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: 'Keep the PDF under 4 MB.',
      })
    }

    const invalidMultipartLimit = [
      'LIMIT_FILE_COUNT',
      'LIMIT_FIELD_COUNT',
      'LIMIT_PART_COUNT',
      'LIMIT_UNEXPECTED_FILE',
    ].includes(err.code)
    if (invalidMultipartLimit) {
      return res.status(400).json({
        error: 'Upload one PDF file using the agreement field.',
      })
    }
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'The request contains invalid data.',
    })
  }

  if (err?.type === 'entity.too.large') {
    return res.status(413).json({
      error: 'The request body is too large.',
    })
  }

  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: 'The request body contains invalid JSON.',
    })
  }

  console.error('[Server]', err)

  return res.status(500).json({
    error: 'Something went wrong on our side.',
  })
}
