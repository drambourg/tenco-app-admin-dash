import HTTP_CODES from './http-codes';

interface AppErrorArgs {
  name?: string;
  statusCode: HTTP_CODES;
  message: string;
  level?: string;
  isOperational?: boolean;
  errors?: unknown;
}

class AppError extends Error {
  public readonly name: string;
  public readonly statusCode: HTTP_CODES;
  public readonly isOperational: boolean = true;
  public readonly errors: unknown;

  constructor(args: AppErrorArgs) {
    super(args.message);
    this.statusCode = args.statusCode;
    if (args.isOperational !== undefined) {
      this.isOperational = args.isOperational;
    }
    this.name = args.name || 'error';
    if (args.errors !== undefined) {
      this.errors = args.errors;
    }
  }
}
export { AppErrorArgs };
export default AppError;
