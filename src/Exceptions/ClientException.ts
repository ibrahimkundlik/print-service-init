import { HttpException, HttpStatus } from '@nestjs/common';

interface ClientExceptionOptions {
  message: string;
  errorCode?: string;
  statusCode?: number;
}

export class ClientException extends HttpException {
  constructor(options: ClientExceptionOptions) {
    const {
      message,
      errorCode = 'ERR_DEFAULT',
      statusCode = HttpStatus.BAD_REQUEST,
    } = options;
    super({ message, errorCode }, statusCode);
  }
}
