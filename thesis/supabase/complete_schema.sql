-- ============================================
-- COMPLETE SUPABASE SCHEMA
-- Ready to run in SQL Editor
-- ============================================

-- ============================================
-- DROP EXISTING TABLES (Clean slate)
-- ============================================
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS locations CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ============================================
-- CREATE TABLES
-- ============================================

-- Users table
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password text NOT NULL,
  name text NOT NULL,
  phone text,
  address text,
  role text DEFAULT 'user',
  created_at timestamp with time zone DEFAULT now()
);

-- Products table
CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price decimal(10,2) NOT NULL,
  image text,
  category text NOT NULL,
  stock integer NOT NULL DEFAULT 0,
  rating decimal(3,2) DEFAULT 0,
  reviews integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

-- Locations table (airports, seaports, storage)
CREATE TABLE locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('storage', 'airport', 'seaport')),
  latitude decimal(10,8) NOT NULL,
  longitude decimal(11,8) NOT NULL,
  address text,
  city text,
  country text,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Orders table (comprehensive structure)
CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text UNIQUE NOT NULL,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  
  -- Sender information
  sender_name text,
  sender_phone text,
  sender_email text,
  sender_address text,
  
  -- Receiver information
  receiver_name text NOT NULL,
  receiver_address text,
  
  -- Package dimensions (individual columns)
  length decimal(10,2),
  width decimal(10,2),
  height decimal(10,2),
  weight decimal(10,2) NOT NULL,
  gross_weight decimal(10,2),
  
  -- Shipping information
  from_location text,
  to_location text,
  
  -- Status and tracking
  status text DEFAULT 'pending',
  delivery_status text DEFAULT 'processing',
  tracking_number text,
  submission_time timestamp with time zone DEFAULT now(),
  
  -- Timestamps
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  -- Legacy fields for backwards compatibility
  package_name text,
  measurements jsonb,
  customer_name text,
  sender jsonb,
  origin jsonb,
  destination jsonb
);

-- ============================================
-- CREATE INDEXES
-- ============================================

-- Users indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- Products indexes
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_name ON products(name);

-- Locations indexes
CREATE INDEX idx_locations_type ON locations(type);
CREATE INDEX idx_locations_country ON locations(country);

-- Orders indexes
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_order_id ON orders(order_id);
CREATE INDEX idx_orders_tracking_number ON orders(tracking_number);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at);

-- ============================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- ============================================
-- CREATE SECURITY POLICIES
-- ============================================

-- Users Policies
-- Allow anyone to register (insert)
DROP POLICY IF EXISTS "users_insert_policy" ON users;
CREATE POLICY "users_insert_policy"
  ON users FOR INSERT
  WITH CHECK (true);

-- Allow users to view all users (for app functionality)
DROP POLICY IF EXISTS "users_select_policy" ON users;
CREATE POLICY "users_select_policy"
  ON users FOR SELECT
  USING (true);

-- Allow users to update their own data
DROP POLICY IF EXISTS "users_update_policy" ON users;
CREATE POLICY "users_update_policy"
  ON users FOR UPDATE
  USING (auth.uid() = id);

-- Products Policies
-- Everyone can view products
DROP POLICY IF EXISTS "products_select_policy" ON products;
CREATE POLICY "products_select_policy"
  ON products FOR SELECT
  USING (true);

-- Admins can insert products (simplified - allow authenticated users)
DROP POLICY IF EXISTS "products_insert_policy" ON products;
CREATE POLICY "products_insert_policy"
  ON products FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Locations Policies
-- Everyone can view locations
DROP POLICY IF EXISTS "locations_select_policy" ON locations;
CREATE POLICY "locations_select_policy"
  ON locations FOR SELECT
  USING (true);

-- Authenticated users can add locations
DROP POLICY IF EXISTS "locations_insert_policy" ON locations;
CREATE POLICY "locations_insert_policy"
  ON locations FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Orders Policies
-- Authenticated users can create orders
DROP POLICY IF EXISTS "orders_insert_policy" ON orders;
CREATE POLICY "orders_insert_policy"
  ON orders FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Authenticated users can view orders (simplified for development)
DROP POLICY IF EXISTS "orders_select_policy" ON orders;
CREATE POLICY "orders_select_policy"
  ON orders FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated users can update orders
DROP POLICY IF EXISTS "orders_update_policy" ON orders;
CREATE POLICY "orders_update_policy"
  ON orders FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================
-- INSERT SAMPLE DATA
-- ============================================

-- Sample Products
INSERT INTO products (name, description, price, image, category, stock, rating, reviews)
VALUES
  ('Wireless Headphones', 'High-quality wireless headphones with noise cancellation', 79.99, 'https://via.placeholder.com/300x300?text=Headphones', 'Electronics', 50, 4.5, 120),
  ('Smartphone Case', 'Durable smartphone case with shock protection', 19.99, 'https://via.placeholder.com/300x300?text=Phone+Case', 'Accessories', 100, 4.2, 85),
  ('Laptop Stand', 'Adjustable aluminum laptop stand for better ergonomics', 49.99, 'https://via.placeholder.com/300x300?text=Laptop+Stand', 'Accessories', 30, 4.7, 200),
  ('Wireless Mouse', 'Ergonomic wireless mouse with long battery life', 29.99, 'https://via.placeholder.com/300x300?text=Mouse', 'Electronics', 75, 4.4, 150),
  ('USB-C Cable', 'Fast charging USB-C cable 2m length', 12.99, 'https://via.placeholder.com/300x300?text=USB+Cable', 'Accessories', 200, 4.3, 300),
  ('Desk Organizer', 'Modern desk organizer with multiple compartments', 24.99, 'https://via.placeholder.com/300x300?text=Desk+Organizer', 'Office', 60, 4.6, 90)
ON CONFLICT DO NOTHING;

-- Sample Locations (Major airports and ports)
INSERT INTO locations (name, type, latitude, longitude, city, country, description)
VALUES
  ('Los Angeles International Airport', 'airport', 33.942536, -118.408075, 'Los Angeles', 'USA', 'Major international airport in California'),
  ('John F. Kennedy International Airport', 'airport', 40.641766, -73.780968, 'New York', 'USA', 'Major international airport in New York'),
  ('Heathrow Airport', 'airport', 51.470020, -0.454295, 'London', 'UK', 'Major international airport in London'),
  ('Tokyo Haneda Airport', 'airport', 35.549393, 139.779839, 'Tokyo', 'Japan', 'Major international airport in Tokyo'),
  ('Singapore Changi Airport', 'airport', 1.350189, 103.994433, 'Singapore', 'Singapore', 'Major international airport hub'),
  ('Dubai International Airport', 'airport', 25.252778, 55.364444, 'Dubai', 'UAE', 'Major international airport hub'),
  ('Port of Los Angeles', 'seaport', 33.739533, -118.270071, 'Los Angeles', 'USA', 'Major seaport in California'),
  ('Port of Singapore', 'seaport', 1.264730, 103.822945, 'Singapore', 'Singapore', 'Major container port'),
  ('Port of Shanghai', 'seaport', 31.230416, 121.473701, 'Shanghai', 'China', 'Worlds busiest container port'),
  ('Port of Rotterdam', 'seaport', 51.922517, 4.479156, 'Rotterdam', 'Netherlands', 'Major European port')
ON CONFLICT DO NOTHING;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

DO $$ 
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ ============================================';
  RAISE NOTICE '✅ SCHEMA SETUP COMPLETE!';
  RAISE NOTICE '✅ ============================================';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Tables Created:';
  RAISE NOTICE '   • users (with authentication support)';
  RAISE NOTICE '   • products (with sample data)';
  RAISE NOTICE '   • locations (airports & seaports)';
  RAISE NOTICE '   • orders (complete structure with snake_case)';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 Security:';
  RAISE NOTICE '   • Row Level Security enabled on all tables';
  RAISE NOTICE '   • Policies configured for authenticated users';
  RAISE NOTICE '   • Users can register and create orders';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Sample Data:';
  RAISE NOTICE '   • 6 sample products inserted';
  RAISE NOTICE '   • 10 major airports/seaports inserted';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 You can now:';
  RAISE NOTICE '   • Register new users';
  RAISE NOTICE '   • Create orders';
  RAISE NOTICE '   • View products and locations';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Ready to test your app!';
  RAISE NOTICE '';
END $$;
