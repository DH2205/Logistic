import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { authenticateToken } from '@/lib/middleware';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request: NextRequest) {
  try {
    const locations = await db.get('locations').value();
    return NextResponse.json(locations || []);
  } catch (error: any) {
    return NextResponse.json(
      { message: 'Server error', error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateToken(request);
    
    if ('error' in authResult) {
      return NextResponse.json(
        { message: authResult.error },
        { status: authResult.status }
      );
    }

    const body = await request.json();
    const {
      name,
      type,
      latitude,
      longitude,
      address,
      city,
      country,
      description
    } = body;

    // Basic validation
    if (!name || !type || latitude === undefined || longitude === undefined) {
      return NextResponse.json(
        { message: 'Name, type, latitude, and longitude are required' },
        { status: 400 }
      );
    }

    const validTypes = ['storage', 'airport', 'seaport'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { message: 'Type must be storage, airport, or seaport' },
        { status: 400 }
      );
    }

    // Check if location with same coordinates already exists
    const existingLocation = await db.get('locations').find({
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude)
    }).value();

    if (existingLocation) {
      return NextResponse.json(
        { message: 'Location with these coordinates already exists' },
        { status: 400 }
      );
    }

    const location = {
      id: uuidv4(),
      name,
      type,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      address: address || '',
      city: city || '',
      country: country || '',
      description: description || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await db.get('locations').push(location);

    return NextResponse.json(location, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { message: 'Server error', error: error.message },
      { status: 500 }
    );
  }
}
