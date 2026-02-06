import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { generateToken, comparePassword } from '@/lib/auth';

export async function POST(request: NextRequest) {
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

    // Generate token
    const token = generateToken(user.id);

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
        role: user.role || 'user'
      }
    });
  } catch (error: any) {
    return NextResponse.json(
      { message: 'Server error', error: error.message },
      { status: 500 }
    );
  }
}
