// Funktionskontrakt: lyckas eller kasta. Två baser: TransientError (försök igen) och FatalError (försök inte).
// get* kastar NotFoundError, find* returnerar T | null.

export class TransientError extends Error {
  override name = 'TransientError'
}

export class FatalError extends Error {
  override name = 'FatalError'
  readonly status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

export class NotFoundError extends FatalError {
  override name = 'NotFoundError'
  constructor(message: string) {
    super(message, 404)
  }
}

export class UnauthorizedError extends FatalError {
  override name = 'UnauthorizedError'
  constructor(message = 'unauthorized') {
    super(message, 401)
  }
}
