/**
 * ObservAI Hub - Shared Edge Function Utilities
 * Request Validation with Zod
 */

import { z, ZodError, ZodSchema } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { createErrorResponse } from './cors.ts';

/**
 * Validation error details
 */
interface ValidationErrorDetail {
  field: string;
  message: string;
  code: string;
}

/**
 * Format Zod errors into a readable structure
 */
function formatZodErrors(error: ZodError): ValidationErrorDetail[] {
  return error.errors.map((err: { path: (string | number)[]; message: string; code: string }) => ({
    field: err.path.join('.'),
    message: err.message,
    code: err.code,
  }));
}

/**
 * Validate request body against a Zod schema
 */
export async function validateBody<T extends ZodSchema>(
  request: Request,
  schema: T
): Promise<{ data: z.infer<T>; error: null } | { data: null; error: Response }> {
  try {
    const body = await request.json();
    const result = schema.safeParse(body);
    
    if (!result.success) {
      return {
        data: null,
        error: createErrorResponse(
          'VALIDATION_ERROR',
          'Request body validation failed',
          400,
          { errors: formatZodErrors(result.error) }
        ),
      };
    }
    
    return { data: result.data, error: null };
  } catch {
    return {
      data: null,
      error: createErrorResponse(
        'INVALID_JSON',
        'Request body must be valid JSON',
        400
      ),
    };
  }
}

/**
 * Validate query parameters against a Zod schema
 */
export function validateQuery<T extends ZodSchema>(
  request: Request,
  schema: T
): { data: z.infer<T>; error: null } | { data: null; error: Response } {
  try {
    const url = new URL(request.url);
    const params: Record<string, string | string[]> = {};
    
    url.searchParams.forEach((value, key) => {
      if (params[key]) {
        if (Array.isArray(params[key])) {
          (params[key] as string[]).push(value);
        } else {
          params[key] = [params[key] as string, value];
        }
      } else {
        params[key] = value;
      }
    });
    
    const result = schema.safeParse(params);
    
    if (!result.success) {
      return {
        data: null,
        error: createErrorResponse(
          'VALIDATION_ERROR',
          'Query parameter validation failed',
          400,
          { errors: formatZodErrors(result.error) }
        ),
      };
    }
    
    return { data: result.data, error: null };
  } catch {
    return {
      data: null,
      error: createErrorResponse(
        'INVALID_QUERY',
        'Failed to parse query parameters',
        400
      ),
    };
  }
}

/**
 * Validate path parameters
 */
export function validateParams<T extends ZodSchema>(
  params: Record<string, string>,
  schema: T
): { data: z.infer<T>; error: null } | { data: null; error: Response } {
  const result = schema.safeParse(params);
  
  if (!result.success) {
    return {
      data: null,
      error: createErrorResponse(
        'VALIDATION_ERROR',
        'Path parameter validation failed',
        400,
        { errors: formatZodErrors(result.error) }
      ),
    };
  }
  
  return { data: result.data, error: null };
}

/**
 * Common validation schemas
 */
export const commonSchemas = {
  uuid: z.string().uuid(),
  
  pagination: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
  
  timeRange: z.object({
    start: z.string().datetime(),
    end: z.string().datetime(),
  }),
  
  orgId: z.object({
    organization_id: z.string().uuid(),
  }),
  
  projectId: z.object({
    project_id: z.string().uuid(),
  }),
};

export { z, ZodError };
export type { ZodSchema };
