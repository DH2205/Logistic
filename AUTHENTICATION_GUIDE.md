# Authentication System Guide

## Overview

Your web application has a **complete authentication system** already implemented! Users can register, login, and their data is stored in a JSON database.

## How It Works

### 1. User Registration

**Frontend:** `client/src/pages/Register.jsx`
- Users fill out a registration form with:
  - Full Name (required)
  - Email (required, validated)
  - Password (required, min 6 characters)
  - Confirm Password (required)
  - Phone (optional)
  - Address (optional)

**Backend:** `server/routes/auth.js` - `POST /api/auth/register`
- Validates email format and password length
- Checks if user already exists
- Hashes password using bcrypt
- Creates user record in database
- Returns JWT token and user info

**Database Storage:** `server/data/db.json`
- User data is stored in the `users` array
- Password is hashed (never stored in plain text)
- Each user gets a unique ID

### 2. User Login

**Frontend:** `client/src/pages/Login.jsx`
- Users enter email and password
- Form validates input
- On success, user is redirected to homepage

**Backend:** `server/routes/auth.js` - `POST /api/auth/login`
- Finds user by email
- Compares password with hashed version
- Returns JWT token if credentials are valid

### 3. User Data Storage

**Location:** `server/data/db.json`

**User Object Structure:**
```json
{
  "users": [
    {
      "id": "unique-uuid",
      "email": "user@example.com",
      "password": "$2a$10$hashedpassword...",
      "name": "John Doe",
      "phone": "+1234567890",
      "address": "123 Main St",
      "role": "user",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

**Security Features:**
- ✅ Passwords are hashed using bcrypt (never plain text)
- ✅ JWT tokens for authentication
- ✅ Token stored in browser localStorage
- ✅ Automatic token validation on protected routes

## Testing the Authentication

### Step 1: Start the Application
```bash
npm run dev
```

### Step 2: Register a New User
1. Open `http://localhost:5173`
2. Click "Register" in the header
3. Fill in the form:
   - Name: `John Doe`
   - Email: `john@example.com`
   - Password: `password123`
   - Confirm Password: `password123`
   - (Optional) Phone and Address
4. Click "Register"
5. You'll be automatically logged in and redirected to homepage

### Step 3: View Stored User Data
Check the database file:
```bash
cat server/data/db.json
```
Or open `server/data/db.json` in your editor to see the stored user.

### Step 4: Test Login
1. Click "Logout" in the header
2. Click "Login"
3. Enter your email and password
4. You'll be logged in and redirected

## API Endpoints

### Register User
```bash
POST http://localhost:5000/api/auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "phone": "+1234567890",
  "address": "123 Main St"
}
```

**Response:**
```json
{
  "message": "User registered successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "john@example.com",
    "name": "John Doe",
    "phone": "+1234567890",
    "address": "123 Main St",
    "role": "user"
  }
}
```

### Login
```bash
POST http://localhost:5000/api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "john@example.com",
    "name": "John Doe",
    "phone": "+1234567890",
    "address": "123 Main St",
    "role": "user"
  }
}
```

### Get Current User (Protected)
```bash
GET http://localhost:5000/api/auth/me
Authorization: Bearer YOUR_TOKEN_HERE
```

## Protected Routes

The following routes require authentication (JWT token):
- `/api/cart/*` - Shopping cart operations
- `/api/orders/*` - Order management
- `/api/auth/me` - Get current user

## Frontend Authentication State

**Context:** `client/src/context/AuthContext.jsx`
- Manages user authentication state globally
- Provides `login()`, `register()`, and `logout()` functions
- Automatically checks for existing token on page load

**Usage in Components:**
```javascript
import { useAuth } from '../context/AuthContext';

function MyComponent() {
  const { user, login, register, logout } = useAuth();
  
  // user is null if not logged in
  // user contains user info if logged in
}
```

## Database File Location

User data is stored in:
```
server/data/db.json
```

This file is automatically created when you first register a user. The database structure includes:
- `users` - All registered users
- `products` - Product catalog
- `carts` - Shopping carts
- `orders` - Order history

## Security Notes

1. **Password Hashing:** All passwords are hashed using bcrypt before storage
2. **JWT Tokens:** Tokens expire after 7 days (configurable in `server/utils/auth.js`)
3. **Token Storage:** Tokens are stored in browser localStorage
4. **Validation:** Email format and password length are validated on both frontend and backend

## Troubleshooting

### User Registration Fails
- Check that email is valid format
- Ensure password is at least 6 characters
- Verify email is not already registered
- Check server console for errors

### Login Fails
- Verify email exists in database
- Check password is correct
- Ensure server is running on port 5000

### Database Not Found
- The `server/data/db.json` file is created automatically
- Ensure `server/data` directory has write permissions

## Next Steps

Your authentication system is fully functional! You can:
1. ✅ Register new users
2. ✅ Login with existing users
3. ✅ Store user data in database
4. ✅ Protect routes with authentication
5. ✅ Manage user sessions with JWT tokens

To enhance it further, you could add:
- Email verification
- Password reset functionality
- Social login (Google, Facebook)
- Two-factor authentication
- User profile management page
