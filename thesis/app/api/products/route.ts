import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { authenticateToken } from '@/lib/middleware';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const minPrice = searchParams.get('minPrice');
    const maxPrice = searchParams.get('maxPrice');
    const sort = searchParams.get('sort');

    let products = await db.get('products').value();

    // Filter by category
    if (category) {
      products = products.filter((p: any) => 
        p.category.toLowerCase() === category.toLowerCase()
      );
    }

    // Search by name or description
    if (search) {
      const searchLower = search.toLowerCase();
      products = products.filter((p: any) =>
        p.name.toLowerCase().includes(searchLower) ||
        p.description.toLowerCase().includes(searchLower)
      );
    }

    // Filter by price range
    if (minPrice) {
      products = products.filter((p: any) => p.price >= parseFloat(minPrice));
    }
    if (maxPrice) {
      products = products.filter((p: any) => p.price <= parseFloat(maxPrice));
    }

    // Sort
    if (sort === 'price-asc') {
      products.sort((a: any, b: any) => a.price - b.price);
    } else if (sort === 'price-desc') {
      products.sort((a: any, b: any) => b.price - a.price);
    } else if (sort === 'rating') {
      products.sort((a: any, b: any) => b.rating - a.rating);
    }

    return NextResponse.json(products);
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
    const { name, description, price, image, category, stock } = body;

    // Basic validation
    if (!name || !price || !category || stock === undefined) {
      return NextResponse.json(
        { message: 'Name, price, category, and stock are required' },
        { status: 400 }
      );
    }

    const product = {
      id: uuidv4(),
      name,
      description: description || '',
      price: parseFloat(price),
      image: image || 'https://via.placeholder.com/300x300?text=Product',
      category,
      stock: parseInt(stock),
      rating: 0,
      reviews: 0,
      createdAt: new Date().toISOString()
    };

    await db.get('products').push(product);
    return NextResponse.json(product, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { message: 'Server error', error: error.message },
      { status: 500 }
    );
  }
}
