# Data Import Script

This script imports data from your `database.json` file into your Supabase database.

## Setup

1. **Copy your database.json file** to the `thesis/` directory (root of your project)

2. **Make sure your `.env.local` file has:**
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

3. **Run the import script:**
   ```bash
   node scripts/import-data.js
   ```

## What it does

- ✅ Imports **users** (checks for duplicates by email)
- ✅ Imports **products** (checks for duplicates by id)
- ✅ Imports **locations/airports** (checks for duplicates by id) - **This is the main one!**
- ✅ Imports **orders** (checks for duplicates by order_id)

## Field Name Conversion

The script automatically converts field names from your JSON to match Supabase schema:
- `createdAt` → `created_at`
- `updatedAt` → `updated_at`
- `orderID` → `order_id`
- `userId` → `user_id`
- `packageName` → `package_name`
- `customerName` → `customer_name`
- `receiverName` → `receiver_name`
- `deliveryStatus` → `delivery_status`
- `trackingNumber` → `tracking_number`
- `submissionTime` → `submission_time`

## Troubleshooting

- **"File not found"**: Make sure `database.json` is in the `thesis/` directory
- **"Missing Supabase credentials"**: Check your `.env.local` file
- **"Permission denied"**: Make sure you're using `SUPABASE_SERVICE_ROLE_KEY` (not anon key)
