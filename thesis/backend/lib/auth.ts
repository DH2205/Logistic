import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Generate JWT token (role embedded for fast authorization; refresh via /api/auth/me)
export function generateToken(userId: string, role?: string): string {
  const payload: { userId: string; role?: string } = { userId };
  if (role) payload.role = role;
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

// Verify JWT token
export function verifyToken(
  token: string
): { userId: string; role?: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: string; role?: string };
  } catch {
    return null;
  }
}

// Hash password
export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 10);
}

// Compare password
export async function comparePassword(password: string, hashedPassword: string): Promise<boolean> {
  return await bcrypt.compare(password, hashedPassword);
}
