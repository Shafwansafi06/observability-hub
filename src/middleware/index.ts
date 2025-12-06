/**
 * Middleware Index
 * 
 * Central export for all middleware utilities.
 */

// Authentication
export {
  getAuthContext,
  hasRole,
  hasOrgAccess,
  meetsRoleLevel,
  requireAuth,
  requireAdmin,
  type AuthContext,
} from './auth';

// Rate Limiting
export {
  isRateLimited,
  createRateLimiter,
  withRateLimit,
  startRateLimitCleanup,
  RATE_LIMITS,
} from './rate-limit';

// Logging
export {
  logger,
  logPerformance,
  measureAsync,
  type LogLevel,
} from './logger';

// Validation
export {
  validate,
  safeValidate,
  validateForm,
  ValidationError,
  // Schemas
  uuidSchema,
  emailSchema,
  passwordSchema,
  urlSchema,
  slugSchema,
  isoDateSchema,
  positiveIntSchema,
  percentageSchema,
  jsonObjectSchema,
  // Helpers
  optionalString,
  stringToNumber,
  stringToBoolean,
  normalizedString,
  // Request schemas
  paginationSchema,
  timeRangeSchema,
  sortSchema,
  type PaginationParams,
  type TimeRangeParams,
  type SortParams,
} from './validation';
