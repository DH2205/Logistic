import { NextRequest } from 'next/server';
import { verifyToken } from './auth';
import { db } from '@/lib/database';
import type { AppRole } from '@/lib/roles';
import { normalizeRole } from '@/lib/roles';

export type AuthResult =
  | { userId: string; role: AppRole }
  | { error: string; status: number };

// Authentication middleware for API routes (includes role)
export async function authenticateToken(request: NextRequest): Promise<AuthResult> {
  const authHeader = request.headers.get('authorization');
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return { error: 'Access token required', status: 401 };
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return { error: 'Invalid or expired token', status: 403 };
  }

  let role = normalizeRole(decoded.role);
  if (!decoded.role) {
    const user = await db.get('users').find({ id: decoded.userId }).value();
    role = normalizeRole(user?.role);
  }

  return { userId: decoded.userId, role };
}
