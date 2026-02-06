# 🔧 Supabase Schema Update - Fixed Version

## Problem
The original SQL had `CREATE POLICY IF NOT EXISTS` which is not supported in PostgreSQL/Supabase.

## Solution
Created two versions of the SQL file:

### 1. **UPDATE_ORDERS_SCHEMA.sql** (Updated - Simple Version)
- Uses `DROP POLICY IF EXISTS` before creating policies
- Simpler and cleaner

### 2. **UPDATE_ORDERS_SCHEMA_SAFE.sql** (NEW - Extra Safe Version)
- Checks each column before adding
- Handles all edge cases
- Most reliable option

## How to Run (Choose One)

### Option A: Simple Version (Recommended)
1. Open Supabase Dashboard → SQL Editor
2. Copy contents of `UPDATE_ORDERS_SCHEMA.sql`
3. Paste and click "Run"
4. ✅ Done!

### Option B: Safe Version (If Option A fails)
1. Open Supabase Dashboard → SQL Editor
2. Copy contents of `UPDATE_ORDERS_SCHEMA_SAFE.sql`
3. Paste and click "Run"
4. ✅ Done!

## What Gets Added to Your Orders Table

New columns:
- `sender_name` TEXT
- `sender_phone` TEXT
- `sender_email` TEXT
- `sender_address` TEXT
- `receiver_name` TEXT
- `receiver_address` TEXT
- `length` DECIMAL(10,2)
- `width` DECIMAL(10,2)
- `height` DECIMAL(10,2)
- `gross_weight` DECIMAL(10,2)
- `from_location` TEXT
- `to_location` TEXT
- `order_id` TEXT (UNIQUE)

Plus:
- Index on `order_id` for faster queries
- RLS policies for security
- View `order_details` for easier querying

## Testing After Running SQL

In Supabase SQL Editor, test with:

```sql
-- Check if columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'orders';

-- Check if policies were created
SELECT policyname 
FROM pg_policies 
WHERE tablename = 'orders';

-- Test the view
SELECT * FROM order_details LIMIT 5;
```

## What If It Still Fails?

If you get any errors:

1. **Enable RLS first** (if not enabled):
   ```sql
   ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
   ```

2. **Check if orders table exists**:
   ```sql
   SELECT * FROM orders LIMIT 1;
   ```

3. **Run in smaller chunks**:
   - First run just the ALTER TABLE commands
   - Then run the CREATE POLICY commands separately
   - Finally run the CREATE VIEW command

4. **Manual column addition** (one at a time):
   ```sql
   ALTER TABLE orders ADD COLUMN IF NOT EXISTS sender_name TEXT;
   ALTER TABLE orders ADD COLUMN IF NOT EXISTS sender_phone TEXT;
   -- etc...
   ```

## After Success

Your orders table will now support the new enhanced order structure from the create-order form! 🎉

You can create orders with all the new fields and they'll be properly stored in Supabase.
