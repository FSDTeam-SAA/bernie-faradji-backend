import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T = any> {
  statusCode: number;
  success: boolean;
  message: string;
  meta?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  data: T;
  responseTime: string;
}

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse> {
    const res = context.switchToHttp().getResponse<Response>();
    const startTime = Date.now();

    return next.handle().pipe(
      map((response) => {
        const responseTime = `${Date.now() - startTime}ms`;
        const statusCode = res.statusCode;

        // Controller returned { message, data, meta? }
        if (
          response &&
          typeof response === 'object' &&
          ('data' in response || 'message' in response)
        ) {
          return {
            statusCode,
            success: true,
            message: response.message ?? 'Request successful',
            ...(response.meta && { meta: response.meta }),
            data: response.data ?? null,
            responseTime,
          };
        }

        // Controller returned a raw value (string, array, primitive)
        return {
          statusCode,
          success: true,
          message: 'Request successful',
          data: response ?? null,
          responseTime,
        };
      }),
    );
  }
}