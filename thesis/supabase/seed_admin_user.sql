-- Default administrator for LogiShop (development / first setup).
-- Login:  email = admin@gmail.com    password = admin1234
-- Password hash: bcrypt cost 10 for "admin1234" (bcryptjs-compatible).
--
-- Run once in Supabase SQL Editor (or psql). Targets fixed id so email/password can change safely.

INSERT INTO public.users (
  id,
  email,
  password,
  name,
  phone,
  address,
  role,
  unique_id_user,
  created_at
)
VALUES (
  '00000000-0000-4000-8000-000000000001'::uuid,
  'admin@gmail.com',
  '$2a$10$ODfSbdu/l21ifsVWselI8eskkWBmH8BzX/s7/FAK0/Y7uqys6Mjdq',
  'System Administrator',
  NULL,
  NULL,
  'admin',
  '00000000-0000-4000-8000-000000000001'::uuid,
  now()
)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  password = EXCLUDED.password,
  name = EXCLUDED.name,
  role = 'admin',
  unique_id_user = EXCLUDED.unique_id_user;
