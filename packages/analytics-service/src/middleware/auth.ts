/**
 * Authentication Middleware for Workspace Isolation
 * 
 * This middleware:
 * 1. Validates JWT tokens from Authorization header
 * 2. Retrieves user's workspace membership
 * 3. Attaches user + workspace info to request
 * 4. Rejects requests without valid auth
 * 
 * Usage:
 *   app.get('/protected', { preHandler: requireAuth }, async (req, reply) => {
 *     const user = getAuthUser(req);
 *     console.log(user.workspace_id); // Safe to use
 *   });
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client for auth verification
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

/**
 * Extended request type with authenticated user info
 */
export interface AuthenticatedRequest extends FastifyRequest {
  user: {
    id: string;
    email: string;
    workspace_id: string;
    role: 'owner' | 'admin' | 'member' | 'viewer';
  };
}

/**
 * Fastify preHandler hook for authentication
 * 
 * This enforces authentication and workspace membership for protected routes.
 * Add to any route using: { preHandler: requireAuth }
 * 
 * @param request - Fastify request object
 * @param reply - Fastify reply object
 */
export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    // Extract Authorization header
    const authHeader = request.headers.authorization;
    
    if (!authHeader) {
      return reply.code(401).send({ 
        ok: false,
        error: 'Unauthorized',
        message: 'Missing authorization header. Include: Authorization: Bearer <token>' 
      });
    }

    if (!authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({ 
        ok: false,
        error: 'Unauthorized',
        message: 'Invalid authorization format. Use: Bearer <token>' 
      });
    }

    const token = authHeader.replace('Bearer ', '');

    if (!token || token.length < 20) {
      return reply.code(401).send({ 
        ok: false,
        error: 'Unauthorized',
        message: 'Invalid or missing token' 
      });
    }

    // Verify token with Supabase Auth
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError) {
      request.log.warn({ error: authError.message }, 'Auth token verification failed');
      return reply.code(401).send({ 
        ok: false,
        error: 'Unauthorized',
        message: 'Invalid or expired token' 
      });
    }

    if (!user) {
      return reply.code(401).send({ 
        ok: false,
        error: 'Unauthorized',
        message: 'User not found' 
      });
    }

    // Get user's workspace membership
    const { data: membership, error: memberError } = await supabase
      .from('workspace_members')
      .select('workspace_id, role')
      .eq('user_id', user.id)
      .single();

    if (memberError) {
      request.log.error({ 
        error: memberError.message, 
        userId: user.id 
      }, 'Failed to get workspace membership');

      return reply.code(403).send({ 
        ok: false,
        error: 'Forbidden',
        message: 'User not associated with any workspace. Please contact support.' 
      });
    }

    if (!membership) {
      request.log.warn({ userId: user.id }, 'User has no workspace membership');
      return reply.code(403).send({ 
        ok: false,
        error: 'Forbidden',
        message: 'No workspace membership found. Please join or create a workspace.' 
      });
    }

    // Attach authenticated user info to request
    (request as AuthenticatedRequest).user = {
      id: user.id,
      email: user.email || 'unknown',
      workspace_id: membership.workspace_id,
      role: membership.role as 'owner' | 'admin' | 'member' | 'viewer'
    };

    request.log.info({ 
      userId: user.id, 
      workspaceId: membership.workspace_id,
      role: membership.role
    }, 'User authenticated');

  } catch (error: any) {
    request.log.error({ error: error.message }, 'Auth middleware error');
    return reply.code(500).send({ 
      ok: false,
      error: 'Internal Server Error',
      message: 'Authentication failed. Please try again.' 
    });
  }
}

/**
 * Type guard helper to safely access authenticated user
 * 
 * Use this after requireAuth middleware to get type-safe user info
 * 
 * @param request - Fastify request object
 * @returns Authenticated user object
 * 
 * @example
 * app.get('/apps', { preHandler: requireAuth }, async (req, reply) => {
 *   const user = getAuthUser(req);
 *   const workspaceId = user.workspace_id; // Type-safe!
 * });
 */
export function getAuthUser(request: FastifyRequest): AuthenticatedRequest['user'] {
  const authReq = request as AuthenticatedRequest;
  
  if (!authReq.user) {
    throw new Error('requireAuth middleware not applied. Add { preHandler: requireAuth } to route.');
  }
  
  return authReq.user;
}

/**
 * Optional authentication middleware
 * 
 * Like requireAuth but doesn't reject unauthenticated requests.
 * Useful for routes that behave differently for auth vs unauth users.
 * 
 * @param request - Fastify request object
 * @param reply - Fastify reply object
 */
export async function optionalAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const authHeader = request.headers.authorization;
    
    if (!authHeader?.startsWith('Bearer ')) {
      return; // No auth, continue without user
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return; // Invalid token, continue without user
    }

    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id, role')
      .eq('user_id', user.id)
      .single();

    if (membership) {
      (request as AuthenticatedRequest).user = {
        id: user.id,
        email: user.email || 'unknown',
        workspace_id: membership.workspace_id,
        role: membership.role as 'owner' | 'admin' | 'member' | 'viewer'
      };
    }
  } catch (error) {
    // Silently fail for optional auth
    request.log.debug({ error }, 'Optional auth failed');
  }
}

/**
 * Role-based authorization middleware
 * 
 * Requires user to have specific role or higher
 * 
 * @param allowedRoles - Roles that can access this route
 * 
 * @example
 * app.delete('/workspace', { 
 *   preHandler: [requireAuth, requireRole(['owner', 'admin'])] 
 * }, handler);
 */
export function requireRole(allowedRoles: Array<'owner' | 'admin' | 'member' | 'viewer'>) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const user = getAuthUser(request);
    
    if (!allowedRoles.includes(user.role)) {
      return reply.code(403).send({
        ok: false,
        error: 'Forbidden',
        message: `This action requires ${allowedRoles.join(' or ')} role. Your role: ${user.role}`
      });
    }
  };
}

