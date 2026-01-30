import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';

export async function GET(
  request: NextRequest,
  { params }: { params: { type: string } }
) {
  try {
    const { type } = params;
    const validTypes = ['storage', 'airport', 'seaport'];
    
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { message: 'Invalid location type' },
        { status: 400 }
      );
    }
    
    const locations = await db.get('locations').filter({ type }).value();
    return NextResponse.json(locations || []);
  } catch (error: any) {
    return NextResponse.json(
      { message: 'Server error', error: error.message },
      { status: 500 }
    );
  }
}
