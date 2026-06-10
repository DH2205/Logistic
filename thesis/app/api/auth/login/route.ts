import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { generateToken, comparePassword } from '@/lib/auth';
import { normalizeRole } from '@/lib/roles';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  // ── Rate Limit: 5 attempts per 60 seconds per IP ──────────
  const ip = getClientIp(request);
  const limit = checkRateLimit(ip, 5, 60_000);

  if (!limit.allowed) {
    const retryAfter = Math.ceil((limit.resetAt - Date.now()) / 1000);
    return NextResponse.json(
      { message: `Too many login attempts. Try again in ${retryAfter} seconds.` },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit': '5',
          'X-RateLimit-Remaining': '0',
        },
      }
    );
  }
  // ──────────────────────────────────────────────────────────

  try {
    const body = await request.json();
    const { email, password } = body;

    // Basic validation
    if (!email || !password) {
      return NextResponse.json(
        { message: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Find user - handle both email and email field variations
    let user = await db.get('users').find({ email }).value();
    
    // If not found, try case-insensitive search
    if (!user) {
      const allUsers = await db.get('users').value();
      user = allUsers.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
    }
    
    if (!user) {
      return NextResponse.json(
        { message: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Compare password
    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
      return NextResponse.json(
        { message: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const role = normalizeRole(user.role);

    // Generate token
    const token = generateToken(user.id, role);

    // Return user data (exclude password)
    return NextResponse.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone || '',
        address: user.address || '',
        role,
      }
    });
  } catch {
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
