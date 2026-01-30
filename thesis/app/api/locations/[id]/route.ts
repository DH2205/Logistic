import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { authenticateToken } from '@/lib/middleware';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const location = await db.get('locations').find({ id: params.id }).value();
    if (!location) {
      return NextResponse.json(
        { message: 'Location not found' },
        { status: 404 }
      );
    }
    return NextResponse.json(location);
  } catch (error: any) {
    return NextResponse.json(
      { message: 'Server error', error: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await authenticateToken(request);
    
    if ('error' in authResult) {
      return NextResponse.json(
        { message: authResult.error },
        { status: authResult.status }
      );
    }

    const location = await db.get('locations').find({ id: params.id }).value();
    if (!location) {
      return NextResponse.json(
        { message: 'Location not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const updates = {
      ...body,
      updatedAt: new Date().toISOString()
    };

    // Convert latitude/longitude to numbers if provided
    if (updates.latitude) updates.latitude = parseFloat(updates.latitude);
    if (updates.longitude) updates.longitude = parseFloat(updates.longitude);

    await db.get('locations').find({ id: params.id }).assign(updates);

    const updatedLocation = await db.get('locations').find({ id: params.id }).value();
    return NextResponse.json(updatedLocation);
  } catch (error: any) {
    return NextResponse.json(
      { message: 'Server error', error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await authenticateToken(request);
    
    if ('error' in authResult) {
      return NextResponse.json(
        { message: authResult.error },
        { status: authResult.status }
      );
    }

    const location = await db.get('locations').find({ id: params.id }).value();
    if (!location) {
      return NextResponse.json(
        { message: 'Location not found' },
        { status: 404 }
      );
    }

    await db.get('locations').find({ id: params.id }).remove();

    return NextResponse.json({ message: 'Location deleted successfully' });
  } catch (error: any) {
    return NextResponse.json(
      { message: 'Server error', error: error.message },
      { status: 500 }
    );
  }
}
