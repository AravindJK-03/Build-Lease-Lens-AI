import express from 'express'
import reviewRouter from './routes/review.js'
import { errorHandler } from './middleware/error.js'

const app = express()

app.use(express.json({ limit: '16kb' }))

app.get('/api/health', (req, res) => {
  res.json({ ok: true })
})

app.use('/api', reviewRouter)

app.use(errorHandler)

export default app
