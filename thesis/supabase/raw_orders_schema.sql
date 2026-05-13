-- ============================================
-- RAW ORDERS TABLE
-- Table to hold imported CSV data from ORDER - Order.csv
-- Created: 2026-02-10
-- ============================================

-- Drop existing table if needed (CAUTION: This will delete all data)
-- DROP TABLE IF EXISTS raw_orders CASCADE;

CREATE TABLE IF NOT EXISTS raw_orders (
  -- Primary Key
  id SERIAL PRIMARY KEY,
  
  -- Core Identification
  house_bill_no VARCHAR(50) UNIQUE NOT NULL,
  tracking_number VARCHAR(100),
  account VARCHAR(255),
  classification VARCHAR(100),
  status VARCHAR(100),
  method VARCHAR(50), -- Export/Import
  country VARCHAR(100),
  hub VARCHAR(50),
  brand VARCHAR(100),
  brand_service VARCHAR(255),
  vnex_service VARCHAR(255),
  
  -- Dates and Times
  time_fpu VARCHAR(50),
  date_fpu DATE,
  pickup_date DATE,
  terminal_entry_date DATE,
  origin_scan_date DATE,
  export_date DATE,
  arrival_date DATE,
  
  -- Personnel
  salesperson VARCHAR(255),
  pic VARCHAR(255),
  
  -- Parties
  sender TEXT,
  receiver TEXT,
  pickup_address TEXT,
  
  -- Package Information
  commodities TEXT,
  package_type VARCHAR(100),
  packages_quantity INTEGER,
  length_cm DECIMAL(10,2),
  width_cm DECIMAL(10,2),
  height_cm DECIMAL(10,2),
  total_dimensional_weight_kgs DECIMAL(10,2),
  total_gross_weight_kgs DECIMAL(10,2),
  total_billable_weight_kgs DECIMAL(10,2),
  total_billable_reweight_kgs DECIMAL(10,2),
  
  -- Reference and Declaration
  reference_no VARCHAR(255),
  declaration_type VARCHAR(100),
  vat BOOLEAN,
  
  -- Status Tracking
  case_status VARCHAR(50),
  label_status VARCHAR(50),
  package_status VARCHAR(50),
  delivered VARCHAR(50),
  status_location TEXT,
  status_delivery TEXT,
  
  -- Scan Information
  origin_scan_arrived_at_facility TEXT,
  export_date_export_scan TEXT,
  check_error TEXT,
  origin_scan_date_copy DATE,
  export_date_copy DATE,
  
  -- QR Codes and Files
  qr_appsheet TEXT,
  qr_folder TEXT,
  qr_order TEXT,
  file_path TEXT,
  time_stamp TIMESTAMP,
  
  -- Surcharges
  ups_surcharge_list TEXT,
  dimension_surcharge TEXT,
  dhl_surcharge_list TEXT,
  fdx_surcharge_list TEXT,
  
  -- Additional Information
  cost_check TEXT,
  full_address TEXT,
  phone_number VARCHAR(50),
  contact_name VARCHAR(255),
  province_city VARCHAR(255),
  ward VARCHAR(255),
  care_of TEXT,
  
  -- Links
  folderlink_inv TEXT,
  folderlink_bill TEXT,
  folderlink TEXT,
  
  -- Checks and Statuses
  sales_check TEXT,
  hab_tracking_number VARCHAR(100),
  careof_sender_receiver TEXT,
  terminal_entry_status_ops_x VARCHAR(50),
  goods_update TEXT,
  
  -- Detailed Address Fields
  address_line1 TEXT,
  address_line2 TEXT,
  address_line3 TEXT,
  city VARCHAR(255),
  state_province_code VARCHAR(50),
  postal_code VARCHAR(20),
  country_code VARCHAR(10),
  residential_indicator VARCHAR(50),
  
  -- Charges
  itemized_charges TEXT,
  res_surcharges TEXT,
  ups_address_surcharge TEXT,
  address_checking_start TEXT,
  update_field TEXT,
  fdx_address_surcharge TEXT,
  
  -- Document Links
  documents_header TEXT,
  invoice_file TEXT,
  label_awb_file TEXT,
  additional_file TEXT,
  documents_file TEXT,
  
  -- Code and Receiver
  code VARCHAR(50),
  receiver_for_ghnn TEXT,
  documents_footer TEXT,
  record_id VARCHAR(50),
  show_address_infor BOOLEAN,
  
  -- Sender Details
  company_sender TEXT,
  contact_name_sender VARCHAR(255),
  phone_sender VARCHAR(50),
  email_sender TEXT,
  address_sender TEXT,
  province_sender VARCHAR(255),
  city_sender VARCHAR(255),
  postal_code_sender VARCHAR(20),
  country_sender VARCHAR(100),
  
  -- Receiver Details
  company_receiver TEXT,
  contact_name_receiver VARCHAR(255),
  phone_receiver VARCHAR(50),
  email_receiver TEXT,
  address_receiver TEXT,
  province_receiver VARCHAR(255),
  city_receiver VARCHAR(255),
  postal_code_receiver VARCHAR(20),
  country_receiver VARCHAR(100),
  
  -- Shipment Mode
  mode VARCHAR(50), -- B2B, B2C
  pick_up_drop_off VARCHAR(50),
  
  -- Scripts and Notifications
  export_script TEXT,
  arrival_script TEXT,
  zns_new_order TEXT,
  ttgh_code TEXT,
  ttgh_cancel TEXT,
  efc TEXT,
  
  -- Costs and Fees
  vnex_internal_cost DECIMAL(15,2),
  internal_description TEXT,
  vnex_additional_service_fee DECIMAL(15,2),
  additional_description TEXT,
  
  -- Information Fields
  courier_info TEXT,
  shipment_info TEXT,
  extra_charges_info TEXT,
  status_info TEXT,
  pick_up_info TEXT,
  
  -- Email and HAB
  email_sent_import_charge TEXT,
  hab_number VARCHAR(100),
  
  -- History and Changes
  history TEXT,
  name VARCHAR(255),
  changed_columns TEXT,
  
  -- Pickup Zone
  zone_for_pickup VARCHAR(100),
  cut_off_for_pickup TIME,
  
  -- Metadata
  imported_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- CREATE INDEXES for better query performance
-- ============================================

-- Core identification indexes
CREATE INDEX IF NOT EXISTS idx_raw_orders_house_bill_no ON raw_orders(house_bill_no);
CREATE INDEX IF NOT EXISTS idx_raw_orders_tracking_number ON raw_orders(tracking_number);
CREATE INDEX IF NOT EXISTS idx_raw_orders_status ON raw_orders(status);
CREATE INDEX IF NOT EXISTS idx_raw_orders_method ON raw_orders(method);
CREATE INDEX IF NOT EXISTS idx_raw_orders_country ON raw_orders(country);

-- Date indexes for time-based queries
CREATE INDEX IF NOT EXISTS idx_raw_orders_date_fpu ON raw_orders(date_fpu);
CREATE INDEX IF NOT EXISTS idx_raw_orders_pickup_date ON raw_orders(pickup_date);
CREATE INDEX IF NOT EXISTS idx_raw_orders_origin_scan_date ON raw_orders(origin_scan_date);
CREATE INDEX IF NOT EXISTS idx_raw_orders_export_date ON raw_orders(export_date);
CREATE INDEX IF NOT EXISTS idx_raw_orders_arrival_date ON raw_orders(arrival_date);

-- Personnel indexes
CREATE INDEX IF NOT EXISTS idx_raw_orders_salesperson ON raw_orders(salesperson);
CREATE INDEX IF NOT EXISTS idx_raw_orders_pic ON raw_orders(pic);

-- Sender/Receiver indexes (text search)
CREATE INDEX IF NOT EXISTS idx_raw_orders_sender ON raw_orders USING gin(to_tsvector('english', sender));
CREATE INDEX IF NOT EXISTS idx_raw_orders_receiver ON raw_orders USING gin(to_tsvector('english', receiver));

-- Metadata indexes
CREATE INDEX IF NOT EXISTS idx_raw_orders_imported_at ON raw_orders(imported_at);
CREATE INDEX IF NOT EXISTS idx_raw_orders_created_at ON raw_orders(created_at);

-- ============================================
-- CREATE VIEW for easy querying
-- ============================================

CREATE OR REPLACE VIEW raw_orders_summary AS
SELECT 
  house_bill_no,
  tracking_number,
  status,
  method,
  country,
  sender,
  receiver,
  package_type,
  packages_quantity,
  total_gross_weight_kgs,
  total_billable_weight_kgs,
  date_fpu,
  pickup_date,
  export_date,
  arrival_date,
  salesperson,
  pic,
  mode,
  imported_at
FROM raw_orders
ORDER BY date_fpu DESC, house_bill_no DESC;

-- ============================================
-- COMMENTS for documentation
-- ============================================

COMMENT ON TABLE raw_orders IS 'Raw order data imported from CSV file (ORDER - Order.csv). Contains complete shipment information with all original columns preserved.';

COMMENT ON COLUMN raw_orders.house_bill_no IS 'Unique house bill number (primary identifier from CSV)';
COMMENT ON COLUMN raw_orders.tracking_number IS 'Carrier tracking number (UPS, FedEx, DHL, etc.)';
COMMENT ON COLUMN raw_orders.method IS 'Export or Import';
COMMENT ON COLUMN raw_orders.mode IS 'B2B (Business to Business) or B2C (Business to Consumer)';
COMMENT ON COLUMN raw_orders.imported_at IS 'Timestamp when this record was imported into the database';

-- ============================================
-- ENABLE ROW LEVEL SECURITY (Optional)
-- ============================================

-- If using Supabase with RLS
-- ALTER TABLE raw_orders ENABLE ROW LEVEL SECURITY;

-- Policy to allow authenticated users to read
-- CREATE POLICY "Allow authenticated users to read raw_orders"
--   ON raw_orders FOR SELECT
--   TO authenticated
--   USING (true);

-- Policy to allow service role to insert
-- CREATE POLICY "Allow service role to insert raw_orders"
--   ON raw_orders FOR INSERT
--   TO service_role
--   WITH CHECK (true);

-- ============================================
-- GRANT PERMISSIONS
-- ============================================

-- Grant appropriate permissions
-- GRANT SELECT ON raw_orders TO authenticated;
-- GRANT ALL ON raw_orders TO service_role;
-- GRANT SELECT ON raw_orders_summary TO authenticated;
