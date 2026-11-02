export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 400,
    public readonly code = 'APP_ERROR',
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'AppError';
  }
}
