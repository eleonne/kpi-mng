/**
 * Business-rule failure with an HTTP-appropriate status code, thrown by the
 * service layer (src/lib/services/*) and shared by both Server Actions and
 * API route handlers. Actions surface `.message` as a form error; route
 * handlers map `.status` to the HTTP response.
 */
export class AppError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AppError";
    this.status = status;
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found.") {
    super(message, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409);
  }
}

export class BusinessRuleError extends AppError {
  constructor(message: string) {
    super(message, 422);
  }
}
