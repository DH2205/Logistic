# 📋 SQL Setup Instructions

## File: `complete_schema.sql`

This is your **complete, ready-to-run** SQL schema for Supabase.

---

## ✨ What It Does

1. ✅ **Drops existing tables** (clean slate)
2. ✅ **Creates all tables** with correct snake_case field names
3. ✅ **Adds indexes** for performance
4. ✅ **Enables Row Level Security** (RLS)
5. ✅ **Creates security policies** (authenticated users can create/view orders)
6. ✅ **Inserts sample data** (products, locations)

---

## 🚀 How to Use

### Step 1: Open Supabase Dashboard
Go to: https://app.supabase.com

### Step 2: Navigate to SQL Editor
1. Select your project
2. Click on **SQL Editor** in the left sidebar

### Step 3: Run the SQL
1. Click **"+ New query"**
2. Copy ALL contents of `complete_schema.sql`
3. Paste into the editor
4. Click **RUN** (or press Ctrl+Enter)

### Step 4: Check Success
You should see messages like:
```
✅ SCHEMA SETUP COMPLETE!
📋 Tables Created: users, products, locations, orders
🔒 Security: Row Level Security enabled
📊 Sample Data: 6 products, 10 locations
```

---

## 📊 Tables Created

### 1. **users**
- User accounts with authentication
- Fields: `id`, `email`, `password`, `name`, `phone`, `address`, `role`, `created_at`

### 2. **products**
- Product catalog
- Fields: `id`, `name`, `description`, `price`, `image`, `category`, `stock`, `rating`, `reviews`, `created_at`
- Includes 6 sample products

### 3. **locations**
- Airports, seaports, storage facilities
- Fields: `id`, `name`, `type`, `latitude`, `longitude`, `city`, `country`, `description`, `created_at`, `updated_at`
- Includes 10 major airports/seaports

### 4. **orders**
- Complete order structure with **snake_case** field names
- Fields:
  - `id`, `order_id`, `user_id`
  - Sender: `sender_name`, `sender_phone`, `sender_email`, `sender_address`
  - Receiver: `receiver_name`, `receiver_address`
  - Dimensions: `length`, `width`, `height`, `weight`, `gross_weight`
  - Shipping: `from_location`, `to_location`
  - Status: `status`, `delivery_status`, `tracking_number`
  - Timestamps: `submission_time`, `created_at`, `updated_at`

---

## 🔒 Security Policies

All tables have **Row Level Security** enabled with these policies:

| Table | Who Can Read | Who Can Insert | Who Can Update |
|-------|--------------|----------------|----------------|
| **users** | Everyone | Anyone (for registration) | Own data only |
| **products** | Everyone | Authenticated | - |
| **locations** | Everyone | Authenticated | - |
| **orders** | Authenticated | Authenticated | Authenticated |

---

## ✅ After Running

Your app will be able to:
- ✅ Register new users
- ✅ Login with credentials
- ✅ View products and locations
- ✅ Create orders (with all fields working)
- ✅ View created orders

---

## 🧪 Test Your App

1. **Refresh** your app: http://localhost:3000
2. **Register** a new account (or login)
3. **Go to Create Order** page
4. **Fill out the form** with:
   - Sender info (name, phone, email, address)
   - Receiver info (name, address)
   - Package info (dimensions, weight)
   - Shipping (from/to locations)
5. **Click Submit**
6. **Should see**: "Order created successfully! Order ID: ORD-0001-2026"

---

## 🔧 Troubleshooting

### Issue: "Permission denied for table"
**Solution**: Make sure you ran the ENTIRE SQL file, including the policies section.

### Issue: "Column 'createdAt' not found"
**Solution**: The API has been updated to use snake_case. Make sure your app code is using the latest version.

### Issue: "Duplicate key violation"
**Solution**: The SQL drops and recreates tables. If you want to keep existing data, remove the `DROP TABLE` lines at the top.

---

## 📁 File Location

```
thesis/
└── supabase/
    ├── complete_schema.sql    ← Run this in Supabase SQL Editor
    └── README_SQL.md          ← You're reading this
```

---

## 🎯 Summary

| Step | Action | Status |
|------|--------|--------|
| 1 | Open Supabase SQL Editor | ⏳ To do |
| 2 | Copy `complete_schema.sql` | ⏳ To do |
| 3 | Paste and RUN | ⏳ To do |
| 4 | See success message | ⏳ To do |
| 5 | Refresh app and test | ⏳ To do |

**That's it! Your database is ready!** 🚀

---

## ⚠️ Important Notes

1. **This SQL drops existing tables** - all data will be deleted
2. **Sample data is included** - 6 products and 10 locations
3. **Field names use snake_case** - matches the fixed API
4. **RLS is enabled** - users must be logged in to create orders

---

Need help? Check the error messages in Supabase SQL Editor after running the SQL.
