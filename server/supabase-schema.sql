-- Supabase Database Schema for Logistics Web App
-- Run this SQL in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  role TEXT DEFAULT 'user',
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  image TEXT,
  category TEXT,
  stock INTEGER DEFAULT 0,
  rating DECIMAL(3, 2) DEFAULT 0,
  reviews INTEGER DEFAULT 0,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Carts table
CREATE TABLE IF NOT EXISTS carts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  items JSONB DEFAULT '[]'::jsonb,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE("userId")
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "orderID" TEXT UNIQUE NOT NULL,
  "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "packageName" TEXT,
  measurements JSONB,
  weight DECIMAL(10, 2),
  "customerName" TEXT,
  "receiverName" TEXT,
  sender JSONB,
  origin JSONB,
  destination JSONB,
  "submissionTime" TIMESTAMPTZ,
  status TEXT DEFAULT 'pending',
  "deliveryStatus" TEXT DEFAULT 'processing',
  "trackingNumber" TEXT,
  route JSONB,
  "currentLocation" UUID,
  "intermediateStops" JSONB,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Locations table
CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('storage', 'airport', 'seaport')),
  latitude DECIMAL(10, 7) NOT NULL,
  longitude DECIMAL(10, 7) NOT NULL,
  city TEXT,
  country TEXT,
  address TEXT,
  description TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_orders_userId ON orders("userId");
CREATE INDEX IF NOT EXISTS idx_orders_orderID ON orders("orderID");
CREATE INDEX IF NOT EXISTS idx_carts_userId ON carts("userId");
CREATE INDEX IF NOT EXISTS idx_locations_type ON locations(type);
CREATE INDEX IF NOT EXISTS idx_locations_country ON locations(country);

-- Enable Row Level Security (RLS) - Optional, adjust based on your needs
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

-- Create policies (adjust based on your security requirements)
-- For now, allow all operations (you should restrict these in production)

-- Users: Users can read their own data
CREATE POLICY "Users can read own data" ON users
  FOR SELECT USING (true);

-- Products: Public read access
CREATE POLICY "Products are viewable by everyone" ON products
  FOR SELECT USING (true);

-- Carts: Users can manage their own cart
CREATE POLICY "Users can manage own cart" ON carts
  FOR ALL USING (true);

-- Orders: Users can manage their own orders
CREATE POLICY "Users can manage own orders" ON orders
  FOR ALL USING (true);

-- Locations: Public read access
CREATE POLICY "Locations are viewable by everyone" ON locations
  FOR SELECT USING (true);
