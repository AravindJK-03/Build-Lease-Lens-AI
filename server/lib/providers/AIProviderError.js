export class AIProviderError extends Error {
  constructor(message, statusCode = 502) {
    super(message)
    this.name = 'AIProviderError'
    this.statusCode = statusCode
  }
}

export class AIConfigurationError extends AIProviderError {
  constructor(message) {
    super(message, 503)
    this.name = 'AIConfigurationError'
  }
}
