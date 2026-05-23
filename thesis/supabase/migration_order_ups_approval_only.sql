-- =============================================================================
-- order_ups: approval workflow columns (run if you see PGRST204 / missing column)
-- =============================================================================
-- New customer orders: app sets approval_status = pending_review (queue).
-- Rows that already existed before this migration: set to approved so customers
-- keep seeing them. New DB default for INSERTs without the column: pending_review.
--
-- Run in: Supabase Dashboard → SQL Editor → New query → Run
-- After run: wait ~1 min or Project Settings → briefly note “schema reload” if needed
-- =============================================================================

-- Step 1: add nullable column (safe if rerun)
ALTER TABLE public.order_ups
  ADD COLUMN IF NOT EXISTS approval_status text;

-- Step 2: existing shipments → approved (already in the wild / legacy data)
UPDATE public.order_ups
SET approval_status = 'approved'
WHERE approval_status IS NULL
   OR TRIM(approval_status) = '';

-- Step 3: default for brand-new rows inserted without an explicit status
ALTER TABLE public.order_ups
  ALTER COLUMN approval_status SET DEFAULT 'pending_review';

-- Step 4: enforce NOT NULL now that every row has a value
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

COMMENT ON COLUMN public.order_ups.approval_status IS
  'pending_review: awaiting staff; approved: visible to customer list/API; rejected: hidden from customer';

-- Review metadata (used by /api/orders/[id]/review)
ALTER TABLE public.order_ups
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.order_ups
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

ALTER TABLE public.order_ups
  ADD COLUMN IF NOT EXISTS staff_notes text;

CREATE INDEX IF NOT EXISTS idx_order_ups_approval_status ON public.order_ups(approval_status);

CREATE INDEX IF NOT EXISTS idx_order_ups_unique_user_approval ON public.order_ups(unique_id_user, approval_status);
