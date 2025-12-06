/**
 * Input Validation Middleware
 * 
 * Zod-based validation utilities for client-side input validation.
 */

import { z, ZodError, ZodSchema } from 'zod';

/**
 * Validation error with structured details
 */
export class ValidationError extends Error {
  public errors: z.ZodIssue[];
  public fieldErrors: Record<string, string[]>;
  
  constructor(zodError: ZodError) {
    super('Validation failed');
    this.name = 'ValidationError';
    this.errors = zodError.errors;
    this.fieldErrors = zodError.flatten().fieldErrors as Record<string, string[]>;
  }
  
  /**
   * Get first error for a specific field
   */
  getFieldError(field: string): string | undefined {
    return this.fieldErrors[field]?.[0];
  }
  
  /**
   * Get all field errors as a flat list
   */
  getAllErrors(): string[] {
    return this.errors.map(e => `${e.path.join('.')}: ${e.message}`);
  }
}

/**
 * Validate data against a Zod schema
 */
export function validate<T>(schema: ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  
  if (!result.success) {
    throw new ValidationError(result.error);
  }
  
  return result.data;
}

/**
 * Safe validation that returns result object
 */
export function safeValidate<T>(
  schema: ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: ValidationError } {
  const result = schema.safeParse(data);
  
  if (!result.success) {
    return { success: false, error: new ValidationError(result.error) };
  }
  
  return { success: true, data: result.data };
}

/**
 * Validate form data with field-level error mapping
 */
export function validateForm<T>(
  schema: ZodSchema<T>,
  data: unknown
): { data: T | null; errors: Record<string, string> } {
  const result = schema.safeParse(data);
  
  if (!result.success) {
    const fieldErrors: Record<string, string> = {};
    
    for (const error of result.error.errors) {
      const field = error.path.join('.');
      if (!fieldErrors[field]) {
        fieldErrors[field] = error.message;
      }
    }
    
    return { data: null, errors: fieldErrors };
  }
  
  return { data: result.data, errors: {} };
}

// ==================== Common Validation Schemas ====================

/**
 * UUID validation
 */
export const uuidSchema = z.string().uuid('Invalid UUID format');

/**
 * Email validation
 */
export const emailSchema = z.string().email('Invalid email address');

/**
 * Password validation with strength requirements
 */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(100, 'Password must be less than 100 characters')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[0-9]/, 'Password must contain a number');

/**
 * URL validation
 */
export const urlSchema = z.string().url('Invalid URL');

/**
 * Slug validation (lowercase letters, numbers, hyphens)
 */
export const slugSchema = z
  .string()
  .min(1, 'Slug is required')
  .max(100, 'Slug must be less than 100 characters')
  .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens');

/**
 * ISO date string validation
 */
export const isoDateSchema = z.string().datetime('Invalid date format');

/**
 * Positive integer validation
 */
export const positiveIntSchema = z.number().int().positive();

/**
 * Percentage validation (0-100)
 */
export const percentageSchema = z.number().min(0).max(100);

/**
 * JSON object validation
 */
export const jsonObjectSchema = z.record(z.unknown());

// ==================== Form Field Helpers ====================

/**
 * Create optional field that transforms empty strings to undefined
 */
export function optionalString<T extends ZodSchema<string>>(schema: T) {
  return schema.optional().or(z.literal('').transform(() => undefined));
}

/**
 * Coerce string to number
 */
export function stringToNumber() {
  return z.string().transform((val, ctx) => {
    const num = parseFloat(val);
    if (isNaN(num)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid number',
      });
      return z.NEVER;
    }
    return num;
  });
}

/**
 * Coerce string to boolean
 */
export function stringToBoolean() {
  return z.string().transform(val => val === 'true' || val === '1');
}

/**
 * Trim and normalize whitespace in strings
 */
export function normalizedString() {
  return z.string().transform(val => val.trim().replace(/\s+/g, ' '));
}

// ==================== Request Validation ====================

/**
 * Pagination params schema
 */
export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

/**
 * Time range params schema
 */
export const timeRangeSchema = z.object({
  start_time: isoDateSchema,
  end_time: isoDateSchema,
}).refine(
  data => new Date(data.start_time) < new Date(data.end_time),
  { message: 'start_time must be before end_time' }
);

/**
 * Sort params schema
 */
export const sortSchema = z.object({
  sort_by: z.string().optional(),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
});

export type PaginationParams = z.infer<typeof paginationSchema>;
export type TimeRangeParams = z.infer<typeof timeRangeSchema>;
export type SortParams = z.infer<typeof sortSchema>;
