import { applyDecorators, Type } from '@nestjs/common';
import { ApiResponse, ApiExtraModels, getSchemaPath } from '@nestjs/swagger';

/**
 * Swagger decorator that wraps the response in the standard ApiResponse envelope.
 */
export function ApiResponseWrapper<T extends Type>(model: T, isArray = false) {
  return applyDecorators(
    ApiExtraModels(model),
    ApiResponse({
      schema: {
        properties: {
          success: { type: 'boolean' },
          data: isArray
            ? { type: 'array', items: { $ref: getSchemaPath(model) } }
            : { $ref: getSchemaPath(model) },
          error: { nullable: true },
          meta: {
            properties: {
              correlationId: { type: 'string' },
              page: { type: 'number', nullable: true },
              limit: { type: 'number', nullable: true },
              total: { type: 'number', nullable: true },
            },
          },
        },
      },
    }),
  );
}
