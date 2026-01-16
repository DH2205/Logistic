# Quick Test: Login & Registration

## ✅ Your Authentication System is Ready!

The login and registration system is **fully implemented** and ready to use. Here's how to test it:

## Test Steps

### 1. Make sure servers are running:
```bash
npm run dev
```

### 2. Open your browser:
```
http://localhost:5173
```

### 3. Register a new user:
1. Click **"Register"** button in the header
2. Fill in the form:
   - **Name:** Your name
   - **Email:** your@email.com
   - **Password:** password123 (min 6 characters)
   - **Confirm Password:** password123
3. Click **"Register"**
4. ✅ You'll be automatically logged in!

### 4. View stored user data:
Open the file: `server/data/db.json`

You'll see your user stored like this:
```json
{
  "users": [
    {
      "id": "unique-id",
      "email": "your@email.com",
      "password": "$2a$10$hashed...",
      "name": "Your Name",
      "phone": "",
      "address": "",
      "role": "user",
      "createdAt": "2024-01-10T..."
    }
  ],
  "products": [...],
  "carts": [],
  "orders": []
}
```

### 5. Test Login:
1. Click **"Logout"** in the header
2. Click **"Login"**
3. Enter your email and password
4. ✅ You'll be logged in!

## What's Already Working

✅ **User Registration** - Store users in database  
✅ **User Login** - Authenticate with email/password  
✅ **Password Hashing** - Passwords are securely hashed  
✅ **JWT Tokens** - Secure authentication tokens  
✅ **Protected Routes** - Cart and Orders require login  
✅ **Session Management** - Stay logged in across page refreshes  

## Database Location

User data is stored in:
```
server/data/db.json
```

This file is created automatically when you register your first user.

## API Endpoints

- **Register:** `POST /api/auth/register`
- **Login:** `POST /api/auth/login`
- **Get Current User:** `GET /api/auth/me` (requires token)

## Files Involved

**Backend:**
- `server/routes/auth.js` - Authentication routes
- `server/utils/auth.js` - JWT & password hashing
- `server/middleware/auth.js` - Token verification
- `server/utils/database.js` - Database storage

**Frontend:**
- `client/src/pages/Register.jsx` - Registration page
- `client/src/pages/Login.jsx` - Login page
- `client/src/context/AuthContext.jsx` - Auth state management
- `client/src/services/api.js` - API calls

## Security Features

🔒 Passwords are hashed (never stored in plain text)  
🔒 JWT tokens for secure authentication  
🔒 Email validation  
🔒 Password length validation (min 6 characters)  
🔒 Duplicate email prevention  

---

**Everything is ready! Just run `npm run dev` and start testing!** 🚀
