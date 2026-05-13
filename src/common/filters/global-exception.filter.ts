import {
  ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { Error as MongooseError } from 'mongoose';
import { MongoServerError } from 'mongodb';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(private readonly configService: ConfigService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    this.logger.error('Exception caught:', exception);

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Something went wrong!';
    let errorSources: { path: string; message: string }[] = [
      { path: '', message: 'Something went wrong' },
    ];

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const res = exception.getResponse() as any;
      if (typeof res === 'string') {
        message = res;
        errorSources = [{ path: '', message }];
      } else {
        message = Array.isArray(res.message) ? 'Validation failed' : (res.message || exception.message);
        errorSources = Array.isArray(res.message)
          ? res.message.map((msg: string) => ({ path: '', message: msg }))
          : [{ path: '', message }];
      }
    } else if (exception instanceof MongooseError.ValidationError) {
      statusCode = HttpStatus.BAD_REQUEST;
      message = 'Validation failed';
      errorSources = Object.values(exception.errors).map((e: any) => ({
        path: e?.path || '', message: e?.message || '',
      }));
    } else if (exception instanceof MongooseError.CastError) {
      statusCode = HttpStatus.BAD_REQUEST;
      message = `Invalid ${exception.path}`;
      errorSources = [{ path: exception.path, message }];
    } else if (exception instanceof MongoServerError && exception.code === 11000) {
      statusCode = HttpStatus.CONFLICT;
      const field = Object.keys((exception as any).keyValue || {})[0] || 'field';
      message = `${field} already exists`;
      errorSources = [{ path: field, message }];
    } else if (exception instanceof Error) {
      message = exception.message;
      errorSources = [{ path: '', message }];
    }

    return response.status(statusCode).json({
      success: false,
      message,
      errorSources,
      ...(this.configService.get('app.env') === 'development' && {
        stack: (exception as any)?.stack,
      }),
    });
  }
}
