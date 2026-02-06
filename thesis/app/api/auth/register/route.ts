import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { generateToken, hashPassword } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name, phone, address } = body;

    // Basic validation
    if (!email || !password || !name) {
      return NextResponse.json(
        { message: 'Email, password, and name are required' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { message: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await db.get('users').find({ email }).value();
    if (existingUser) {
      return NextResponse.json(
        { message: 'User already exists' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user - match database schema field names
    const userId = uuidv4();
    const userData = {
      id: userId,
      email,
      password: hashedPassword,
      name,
      phone: phone || null,
      address: address || null,
      role: 'user',
      unique_id_user: userId,  // Populate unique_id_user with same value as id
      created_at: new Date().toISOString()
    };

    // Insert user into database
    try {
      console.log('Attempting to create user with data:', { ...userData, password: '[HIDDEN]' });
      
      // Insert user
      const insertResult = await db.get('users').push(userData);
      console.log('Insert result:', insertResult);
      
      // Wait a bit for database to sync
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Verify user was created by fetching it back
      let createdUser = await db.get('users').find({ email }).value();
      console.log('Found user by exact email:', createdUser ? 'Yes' : 'No');
      
      if (!createdUser) {
        // Try case-insensitive search as fallback
        const allUsers = await db.get('users').value();
        console.log('Total users in database:', allUsers?.length || 0);
        const foundUser = allUsers?.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
        
        if (!foundUser) {
          console.error('User not found after insertion. All users:', allUsers);
          return NextResponse.json(
            { message: 'Failed to create user in database. Please check your database connection and try again.' },
            { status: 500 }
          );
        }
        
        createdUser = foundUser;
      }
      
      // Use the created user from database (with proper field names)
      const user = {
        id: createdUser.id,
        email: createdUser.email,
        name: createdUser.name,
        phone: createdUser.phone || '',
        address: createdUser.address || '',
        role: createdUser.role || 'user'
      };

      // Generate token
      const token = generateToken(user.id);

      console.log('User created successfully:', user.email);
      return NextResponse.json({
        message: 'User registered successfully',
        token,
        user
      }, { status: 201 });
    } catch (dbError: any) {
      console.error('Database error during registration:', dbError);
      console.error('Error stack:', dbError.stack);
      console.error('Error details:', {
        message: dbError.message,
        code: dbError.code,
        details: dbError.details,
        hint: dbError.hint
      });
      
      // Check if it's a duplicate email error
      if (dbError.message?.includes('duplicate') || 
          dbError.message?.includes('unique') ||
          dbError.code === '23505') {
        return NextResponse.json(
          { message: 'User with this email already exists' },
          { status: 400 }
        );
      }
      
      // Check for RLS policy errors
      if (dbError.message?.includes('policy') || dbError.message?.includes('permission')) {
        return NextResponse.json(
          { message: 'Database permission error. Please check your Row Level Security policies.' },
          { status: 500 }
        );
      }
      
      return NextResponse.json(
        { message: 'Database error: ' + (dbError.message || 'Failed to create user. Please check your database configuration.') },
        { status: 500 }
      );
    }
  } catch (error: any) {
    return NextResponse.json(
      { message: 'Server error', error: error.message },
      { status: 500 }
    );
  }
}
