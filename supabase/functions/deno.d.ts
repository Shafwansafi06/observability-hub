/**
 * Deno Runtime Type Declarations for Supabase Edge Functions
 * 
 * This file provides TypeScript declarations for the Deno runtime
 * so that VS Code can understand the code without errors.
 * 
 * Note: These are simplified declarations. The actual Deno runtime
 * provides more functionality. These declarations are for IDE support only.
 */

declare namespace Deno {
  export interface Env {
    get(key: string): string | undefined;
    set(key: string, value: string): void;
    delete(key: string): void;
    toObject(): Record<string, string>;
  }

  export const env: Env;

  export interface Reader {
    read(p: Uint8Array): Promise<number | null>;
  }

  export interface Writer {
    write(p: Uint8Array): Promise<number>;
  }

  export interface Closer {
    close(): void;
  }

  export interface Seeker {
    seek(offset: number, whence: number): Promise<number>;
  }

  export interface ReadCloser extends Reader, Closer {}
  export interface WriteCloser extends Writer, Closer {}
  export interface ReadWriteCloser extends Reader, Writer, Closer {}
  export interface ReadSeeker extends Reader, Seeker {}

  export interface ConnectOptions {
    port: number;
    hostname?: string;
    transport?: "tcp";
  }

  export interface Conn extends Reader, Writer, Closer {
    readonly localAddr: Addr;
    readonly remoteAddr: Addr;
    readonly rid: number;
    closeWrite(): Promise<void>;
  }

  export interface Addr {
    transport: "tcp" | "udp";
    hostname: string;
    port: number;
  }

  export function connect(options: ConnectOptions): Promise<Conn>;

  export interface ListenOptions {
    port: number;
    hostname?: string;
  }

  export interface Listener extends AsyncIterable<Conn> {
    readonly addr: Addr;
    readonly rid: number;
    accept(): Promise<Conn>;
    close(): void;
  }

  export function listen(options: ListenOptions): Listener;

  export interface ServeOptions {
    port?: number;
    hostname?: string;
    signal?: AbortSignal;
    onListen?: (params: { hostname: string; port: number }) => void;
    onError?: (error: unknown) => Response | Promise<Response>;
  }

  export function serve(
    handler: (request: Request) => Response | Promise<Response>,
    options?: ServeOptions
  ): void;

  export function exit(code?: number): never;

  export const args: string[];
  export const build: {
    target: string;
    arch: string;
    os: string;
    vendor: string;
    env?: string;
  };

  export const version: {
    deno: string;
    v8: string;
    typescript: string;
  };
}

// Declare serve function from std/http/server.ts
declare module "https://deno.land/std@0.177.0/http/server.ts" {
  export interface ServeInit {
    port?: number;
    hostname?: string;
    handler?: (request: Request) => Response | Promise<Response>;
    onError?: (error: unknown) => Response | Promise<Response>;
    onListen?: (params: { hostname: string; port: number }) => void;
    signal?: AbortSignal;
  }

  export function serve(
    handler: (request: Request) => Response | Promise<Response>,
    options?: ServeInit
  ): Promise<void>;
}

// Declare Supabase client from esm.sh
declare module "https://esm.sh/@supabase/supabase-js@2" {
  export * from "@supabase/supabase-js";
}

declare module "https://esm.sh/@supabase/supabase-js@2.39.0" {
  export * from "@supabase/supabase-js";
}

// Declare Zod from deno.land
declare module "https://deno.land/x/zod@v3.22.4/mod.ts" {
  import { z, ZodError, ZodSchema, ZodType, ZodTypeDef } from "zod";
  export { z, ZodError, ZodSchema, ZodType, ZodTypeDef };
  export default z;
}

// Make sure global crypto is available
declare const crypto: Crypto;

// Relative imports for shared modules from _shared folder
declare module "../_shared/auth.ts" {
  import type { SupabaseClient } from "@supabase/supabase-js";
  export function createAdminClient(): SupabaseClient;
  export function createUserClient(accessToken: string): SupabaseClient;
  export interface AuthResult {
    authenticated: boolean;
    userId?: string;
    email?: string;
    organizationId?: string;
    projectId?: string;
    scopes?: string[];
    rateLimits?: {
      perMinute: number;
      perDay: number;
    };
    authType: 'jwt' | 'api_key' | 'none';
    error?: string;
  }
  export function authenticate(request: Request): Promise<AuthResult>;
  export function requireAuth(request: Request): Promise<AuthResult | Response>;
  export function requireScopes(auth: AuthResult, requiredScopes: string[]): Response | null;
}

// Relative imports from cron subdirectories (../../_shared/)
declare module "../../_shared/auth.ts" {
  import type { SupabaseClient } from "@supabase/supabase-js";
  export function createAdminClient(): SupabaseClient;
  export function createUserClient(accessToken: string): SupabaseClient;
  export interface AuthResult {
    authenticated: boolean;
    userId?: string;
    email?: string;
    organizationId?: string;
    projectId?: string;
    scopes?: string[];
    rateLimits?: {
      perMinute: number;
      perDay: number;
    };
    authType: 'jwt' | 'api_key' | 'none';
    error?: string;
  }
  export function authenticate(request: Request): Promise<AuthResult>;
  export function requireAuth(request: Request): Promise<AuthResult | Response>;
  export function requireScopes(auth: AuthResult, requiredScopes: string[]): Response | null;
}

declare module "../_shared/cors.ts" {
  export function handleCorsPreFlight(): Response;
  export function createSuccessResponse<T>(data: T, status?: number): Response;
  export function createErrorResponse(code: string, message: string, status?: number, details?: unknown): Response;
}

declare module "../../_shared/cors.ts" {
  export function handleCorsPreFlight(): Response;
  export function createSuccessResponse<T>(data: T, status?: number): Response;
  export function createErrorResponse(code: string, message: string, status?: number, details?: unknown): Response;
}

declare module "../_shared/validation.ts" {
  export function validateBody<T>(request: Request, schema: unknown): Promise<{ data: T; error: null } | { data: null; error: Response }>;
}

declare module "../../_shared/validation.ts" {
  export function validateBody<T>(request: Request, schema: unknown): Promise<{ data: T; error: null } | { data: null; error: Response }>;
}

declare module "../_shared/cache.ts" {
  export function getCached<T>(key: string): Promise<T | null>;
  export function setCached<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  export function deleteCached(key: string): Promise<void>;
}

declare module "../../_shared/cache.ts" {
  export function getCached<T>(key: string): Promise<T | null>;
  export function setCached<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  export function deleteCached(key: string): Promise<void>;
}
