-- Create users table
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password text not null,
  name text not null,
  phone text,
  address text,
  role text default 'user',
  created_at timestamp with time zone default now()
);

-- Create products table
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price decimal(10,2) not null,
  image text,
  category text not null,
  stock integer not null default 0,
  rating decimal(3,2) default 0,
  reviews integer default 0,
  created_at timestamp with time zone default now()
);

-- Create locations table
create table if not exists locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('storage', 'airport', 'seaport')),
  latitude decimal(10,8) not null,
  longitude decimal(11,8) not null,
  address text,
  city text,
  country text,
  description text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Create orders table
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  order_id text unique not null,
  user_id uuid references users(id) on delete cascade,
  package_name text not null,
  measurements jsonb not null,
  weight decimal(10,2) not null,
  customer_name text not null,
  receiver_name text not null,
  sender jsonb not null,
  origin jsonb not null,
  destination jsonb not null,
  submission_time timestamp with time zone default now(),
  status text default 'pending',
  delivery_status text default 'processing',
  tracking_number text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Create indexes for better performance
create index if not exists idx_users_email on users(email);
create index if not exists idx_orders_user_id on orders(user_id);
create index if not exists idx_orders_order_id on orders(order_id);
create index if not exists idx_locations_type on locations(type);
create index if not exists idx_products_category on products(category);

-- Enable Row Level Security
alter table users enable row level security;
alter table products enable row level security;
alter table locations enable row level security;
alter table orders enable row level security;

-- RLS Policies for products (public read)
create policy "Public can read products"
  on products for select
  to anon, authenticated
  using (true);

create policy "Authenticated users can insert products"
  on products for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update products"
  on products for update
  to authenticated
  using (true);

create policy "Authenticated users can delete products"
  on products for delete
  to authenticated
  using (true);

-- RLS Policies for locations (public read)
create policy "Public can read locations"
  on locations for select
  to anon, authenticated
  using (true);

create policy "Authenticated users can manage locations"
  on locations for all
  to authenticated
  using (true);

-- RLS Policies for orders (user-specific)
create policy "Users can read their own orders"
  on orders for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can create their own orders"
  on orders for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own orders"
  on orders for update
  to authenticated
  using (auth.uid() = user_id);

-- RLS Policies for users
create policy "Users can read their own profile"
  on users for select
  to authenticated
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on users for update
  to authenticated
  using (auth.uid() = id);

-- Insert some sample products
insert into products (name, description, price, image, category, stock, rating, reviews)
values
  ('Wireless Headphones', 'High-quality wireless headphones with noise cancellation', 79.99, 'https://via.placeholder.com/300x300?text=Headphones', 'Electronics', 50, 4.5, 120),
  ('Smartphone Case', 'Durable smartphone case with shock protection', 19.99, 'https://via.placeholder.com/300x300?text=Phone+Case', 'Accessories', 100, 4.2, 85),
  ('Laptop Stand', 'Adjustable aluminum laptop stand for better ergonomics', 49.99, 'https://via.placeholder.com/300x300?text=Laptop+Stand', 'Accessories', 30, 4.7, 200),
  ('Wireless Mouse', 'Ergonomic wireless mouse with long battery life', 29.99, 'https://via.placeholder.com/300x300?text=Mouse', 'Electronics', 75, 4.4, 150),
  ('USB-C Cable', 'Fast charging USB-C cable 2m length', 12.99, 'https://via.placeholder.com/300x300?text=USB+Cable', 'Accessories', 200, 4.3, 300),
  ('Desk Organizer', 'Modern desk organizer with multiple compartments', 24.99, 'https://via.placeholder.com/300x300?text=Desk+Organizer', 'Office', 60, 4.6, 90)
on conflict do nothing;
