-- ============================================
-- CREATE order_UPS TABLE
-- Same structure as orders table
-- ============================================

CREATE TABLE order_UPS (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text UNIQUE NOT NULL,
  user_id uuid,
  
  -- Sender information
  sender_name text,
  sender_phone text,
  sender_email text,
  sender_address text,
  
  -- Receiver information
  receiver_name text NOT NULL,
  receiver_address text,
  
  -- Package dimensions
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
  
  -- Legacy fields
  package_name text,
  measurements text,
  customer_name text,
  sender text,
  origin text,
  destination text,
  unique_id_user uuid,
  
  -- Additional UPS-specific fields (optional)
  carrier text DEFAULT 'UPS',
  extended_data jsonb DEFAULT '{}'::jsonb
);

-- ============================================
-- CREATE INDEXES
-- ============================================

CREATE INDEX idx_order_ups_order_id ON order_UPS(order_id);
CREATE INDEX idx_order_ups_user_id ON order_UPS(user_id);
CREATE INDEX idx_order_ups_tracking_number ON order_UPS(tracking_number);
CREATE INDEX idx_order_ups_status ON order_UPS(status);
CREATE INDEX idx_order_ups_delivery_status ON order_UPS(delivery_status);
CREATE INDEX idx_order_ups_created_at ON order_UPS(created_at);
CREATE INDEX idx_order_ups_from_location ON order_UPS(from_location);
CREATE INDEX idx_order_ups_to_location ON order_UPS(to_location);
CREATE INDEX idx_order_ups_unique_id_user ON order_UPS(unique_id_user);
CREATE INDEX idx_order_ups_carrier ON order_UPS(carrier);

-- ============================================
-- CREATE VIEW (optional - for easy querying)
-- ============================================

CREATE OR REPLACE VIEW order_ups_summary AS
SELECT 
  id,
  order_id,
  user_id,
  sender_name,
  receiver_name,
  tracking_number,
  status,
  delivery_status,
  weight,
  from_location,
  to_location,
  created_at
FROM order_UPS
ORDER BY created_at DESC;

-- ============================================
-- GRANT PERMISSIONS (adjust as needed)
-- ============================================

-- GRANT SELECT, INSERT, UPDATE ON order_UPS TO authenticated;
-- GRANT SELECT ON order_ups_summary TO authenticated;

-- ============================================
-- DONE! Table order_UPS is ready.
-- ============================================
