import { NextRequest } from 'next/server';
import { verifyToken } from './auth';

// Authentication middleware for API routes
export async function authenticateToken(request: NextRequest): Promise<{ userId: string } | { error: string, status: number }> {
  const authHeader = request.headers.get('authorization');
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return { error: 'Access token required', status: 401 };
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return { error: 'Invalid or expired token', status: 403 };
  }

  return { userId: decoded.userId };
}
