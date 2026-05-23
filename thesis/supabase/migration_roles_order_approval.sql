-- Roles: admin | staff | customer (replaces legacy 'user')
-- Order approval workflow for customer-created shipments

-- ── users.role ─────────────────────────────────────────────────────────────
ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_role_check;

UPDATE users
SET role = 'customer'
WHERE role IS NULL
   OR TRIM(LOWER(role)) IN ('user', 'customer', '')
   OR TRIM(LOWER(role)) NOT IN ('admin', 'staff', 'customer');

ALTER TABLE users
  ADD CONSTRAINT users_role_check
  CHECK (
    TRIM(LOWER(role)) IN ('admin', 'staff', 'customer')
  );

-- Optional: first admin (set email after migration)
-- UPDATE users SET role = 'admin' WHERE email = 'your.admin@example.com';

COMMENT ON COLUMN users.role IS 'Access level: admin (full), staff (orders/users read + order review), customer (self-service)';

-- ── order_ups approval (new shipments: pending_review until staff approves) ───
-- Existing rows → approved. DB default for new INSERTs without column → pending_review.

ALTER TABLE public.order_ups
  ADD COLUMN IF NOT EXISTS approval_status text;

UPDATE public.order_ups
SET approval_status = 'approved'
WHERE approval_status IS NULL
   OR TRIM(approval_status) = '';

ALTER TABLE public.order_ups
  ALTER COLUMN approval_status SET DEFAULT 'pending_review';

ALTER TABLE public.order_ups
  ALTER COLUMN approval_status SET NOT NULL;

ALTER TABLE public.order_ups
  DROP CONSTRAINT IF EXISTS order_ups_approval_status_check;

ALTER TABLE public.order_ups
  ADD CONSTRAINT order_ups_approval_status_check
  CHECK (
    TRIM(LOWER(approval_status)) IN (
      'pending_review',
      'pending',
      'approved',
      'rejected'
    )
  );

ALTER TABLE public.order_ups
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.order_ups
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

ALTER TABLE public.order_ups
  ADD COLUMN IF NOT EXISTS staff_notes text;

CREATE INDEX IF NOT EXISTS idx_order_ups_approval_status ON public.order_ups(approval_status);
CREATE INDEX IF NOT EXISTS idx_order_ups_unique_user_approval ON public.order_ups(unique_id_user, approval_status);

COMMENT ON COLUMN public.order_ups.approval_status IS 'pending_review: awaiting staff; approved: visible to customer; rejected: not fulfilled';
COMMENT ON COLUMN public.order_ups.reviewed_by IS 'Staff or admin user who last changed approval';
COMMENT ON COLUMN public.order_ups.staff_notes IS 'Internal / customer-facing notes from reviewer';
