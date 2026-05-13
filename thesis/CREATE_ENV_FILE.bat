@echo off
echo Creating .env.local file...
echo.

(
echo # Supabase Configuration
echo # Get these values from: https://supabase.com/dashboard/project/_/settings/api
echo.
echo # Project URL ^(found in Project Settings -^> API^)
echo NEXT_PUBLIC_SUPABASE_URL=your_project_url_here
echo.
echo # Anon/Public Key ^(found in Project Settings -^> API^)
echo NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
echo.
echo # Service Role Key ^(found in Project Settings -^> API - use with caution!^)
echo SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
echo.
echo # JWT Secret ^(for token signing - optional, can be any secure string^)
echo JWT_SECRET=your_jwt_secret_here_at_least_32_characters_long
) > .env.local

echo.
echo ✅ .env.local file created!
echo.
echo Next steps:
echo 1. Open .env.local in a text editor
echo 2. Get your credentials from https://app.supabase.com
echo 3. Replace the placeholder values
echo 4. Save the file
echo 5. Restart your dev server (Ctrl+C then npm run dev)
echo.
pause
