import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { authenticateToken } from '@/lib/middleware';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request: NextRequest) {
  try {
    // Supabase default row limit is 1 000 — fetch in pages of 1 000 to get all rows
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const client = createClient(supabaseUrl, supabaseKey);

    let allLocations: any[] = [];
    let from = 0;
    const PAGE = 1000;

    while (true) {
      const { data, error } = await client
        .from('locations')
        .select('*')
        .range(from, from + PAGE - 1);
      if (error || !data || data.length === 0) break;
      allLocations = allLocations.concat(data);
      if (data.length < PAGE) break;
      from += PAGE;
    }

    return NextResponse.json(allLocations);
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
