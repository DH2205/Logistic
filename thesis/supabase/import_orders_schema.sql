-- ============================================
-- IMPORT ORDERS SCHEMA
-- Matches existing orders table structure
-- Additional CSV fields stored in extended_data JSONB
-- ============================================

-- Add extended_data column to existing orders table (if not exists)
-- This will store additional CSV fields that don't map to main columns
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS extended_data jsonb DEFAULT '{}'::jsonb;

-- Add carrier column for tracking
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS carrier text;

-- Add unique_id_user column if not exists (for compatibility)
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS unique_id_user uuid;

-- ============================================
-- CREATE INDEXES for new columns
-- ============================================

CREATE INDEX IF NOT EXISTS idx_orders_carrier ON orders(carrier);
CREATE INDEX IF NOT EXISTS idx_orders_unique_id_user ON orders(unique_id_user);
CREATE INDEX IF NOT EXISTS idx_orders_extended_data ON orders USING gin(extended_data);

-- ============================================
-- COMMENTS for documentation
-- ============================================

COMMENT ON COLUMN orders.extended_data IS 'Additional CSV data fields stored as JSON (house_bill_no, account, classification, brand, commodities, etc.)';
COMMENT ON COLUMN orders.carrier IS 'Shipping carrier (UPS, FedEx, DHL, etc.)';
COMMENT ON COLUMN orders.unique_id_user IS 'Legacy unique user identifier';

-- ============================================
-- EXAMPLE extended_data structure
-- ============================================

/*
extended_data will contain:
{
  "house_bill_no": "100001",
  "account": "UPS- VNEX- KHOA KHANG (S)",
  "classification": "VNEX",
  "hub": "SGN",
  "brand": "UPS",
  "brand_service": "UPS Freight",
  "vnex_service": "Priority",
  "salesperson": "Mr. Vincent",
  "pic": "Mr. Vincent",
  "commodities": "Đồ cá nhân",
  "package_type": "Parcel",
  "packages_quantity": 3,
  "reference_no": "",
  "declaration_type": "Phi mậu dịch",
  "vat": true,
  "mode": "B2B",
  "pick_up_drop_off": "Drop Off",
  "postal_code_sender": "590000",
  "country_sender": "VN-Vietnam",
  "postal_code_receiver": "8700",
  "country_receiver": "DK-Denmark",
  "pickup_date": "2025-11-13",
  "terminal_entry_date": null,
  "origin_scan_date": "2023-07-04",
  "export_date": "2023-07-04",
  "arrival_date": "2023-07-11",
  "vnex_internal_cost": 0.00,
  "vnex_additional_service_fee": 0.00,
  ... other CSV fields
}
*/

-- ============================================
-- VIEW for easy querying with extended data
-- ============================================

CREATE OR REPLACE VIEW orders_with_csv_data AS
SELECT 
  o.id,
  o.order_id,
  o.user_id,
  
  -- Sender
  o.sender_name,
  o.sender_phone,
  o.sender_email,
  o.sender_address,
  
  -- Receiver
  o.receiver_name,
  o.receiver_address,
  
  -- Package
  o.length,
  o.width,
  o.height,
  o.weight,
  o.gross_weight,
  o.package_name,
  
  -- Shipping
  o.from_location,
  o.to_location,
  o.status,
  o.delivery_status,
  o.tracking_number,
  o.carrier,
  
  -- Extended CSV data
  o.extended_data->>'house_bill_no' as house_bill_no,
  o.extended_data->>'account' as account,
  o.extended_data->>'classification' as classification,
  o.extended_data->>'brand' as brand,
  o.extended_data->>'brand_service' as brand_service,
  o.extended_data->>'commodities' as commodities,
  o.extended_data->>'package_type' as package_type,
  (o.extended_data->>'packages_quantity')::integer as packages_quantity,
  o.extended_data->>'salesperson' as salesperson,
  o.extended_data->>'pic' as pic,
  o.extended_data->>'mode' as mode,
  (o.extended_data->>'pickup_date')::date as pickup_date,
  (o.extended_data->>'export_date')::date as export_date,
  (o.extended_data->>'arrival_date')::date as arrival_date,
  
  -- Timestamps
  o.submission_time,
  o.created_at,
  o.updated_at
FROM orders o
WHERE o.extended_data IS NOT NULL
ORDER BY o.created_at DESC;

-- ============================================
-- HELPER FUNCTION: Insert CSV order
-- ============================================

CREATE OR REPLACE FUNCTION insert_csv_order(
  p_house_bill_no text,
  p_tracking_number text,
  p_sender_name text,
  p_sender_phone text,
  p_sender_email text,
  p_sender_address text,
  p_receiver_name text,
  p_receiver_address text,
  p_length decimal,
  p_width decimal,
  p_height decimal,
  p_weight decimal,
  p_gross_weight decimal,
  p_from_location text,
  p_to_location text,
  p_status text,
  p_tracking_data jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_order_id text;
  v_new_id uuid;
BEGIN
  -- Generate order_id from house_bill_no or use default
  v_order_id := COALESCE(p_house_bill_no, 'ORD-' || upper(substring(md5(random()::text) from 1 for 20)));
  
  -- Insert order
  INSERT INTO orders (
    order_id,
    sender_name,
    sender_phone,
    sender_email,
    sender_address,
    receiver_name,
    receiver_address,
    length,
    width,
    height,
    weight,
    gross_weight,
    from_location,
    to_location,
    status,
    delivery_status,
    tracking_number,
    package_name,
    extended_data
  ) VALUES (
    v_order_id,
    p_sender_name,
    p_sender_phone,
    p_sender_email,
    p_sender_address,
    p_receiver_name,
    p_receiver_address,
    p_length,
    p_width,
    p_height,
    p_weight,
    p_gross_weight,
    p_from_location,
    p_to_location,
    p_status,
    p_status, -- delivery_status same as status
    p_tracking_number,
    'Package for ' || p_receiver_name,
    p_tracking_data
  )
  RETURNING id INTO v_new_id;
  
  RETURN v_new_id;
END;
$$;

-- ============================================
-- EXAMPLE: How to query combined data
-- ============================================

/*
-- Get all orders with extended CSV data
SELECT * FROM orders_with_csv_data 
WHERE house_bill_no IS NOT NULL
LIMIT 10;

-- Search by house bill number
SELECT * FROM orders
WHERE extended_data->>'house_bill_no' = '100001';

-- Filter by brand
SELECT * FROM orders
WHERE extended_data->>'brand' = 'UPS'
ORDER BY created_at DESC;

-- Orders by salesperson
SELECT 
  extended_data->>'salesperson' as salesperson,
  COUNT(*) as order_count,
  SUM(weight) as total_weight
FROM orders
WHERE extended_data->>'salesperson' IS NOT NULL
GROUP BY extended_data->>'salesperson'
ORDER BY order_count DESC;

-- Monthly statistics with CSV data
SELECT 
  DATE_TRUNC('month', (extended_data->>'pickup_date')::date) as month,
  extended_data->>'brand' as brand,
  COUNT(*) as orders,
  SUM(weight) as total_weight
FROM orders
WHERE extended_data->>'pickup_date' IS NOT NULL
GROUP BY month, brand
ORDER BY month DESC;
*/

-- ============================================
-- PERMISSIONS
-- ============================================

-- Grant appropriate permissions
GRANT SELECT ON orders_with_csv_data TO authenticated;

COMMENT ON VIEW orders_with_csv_data IS 'Orders with extended CSV data fields extracted from JSONB column for easy querying';
