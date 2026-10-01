-- A 100% voucher settles a fine without a cash payment, so retain a zero-value
-- transaction row instead of failing the existing positive-amount constraint.
ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_amount_paid_check;

-- Older payment handlers saved the pre-discount amount as amount_paid. Recover
-- the voucher percentage from the transaction note and preserve the gross
-- amount in original_amount before correcting the recorded cash amount.
WITH voucher_transactions AS (
  SELECT
    id,
    COALESCE(original_amount, amount_paid) AS gross_amount,
    COALESCE(voucher_used, (regexp_match(notes, 'Voucher: *([A-Z0-9]+)'))[1]) AS voucher_code,
    (regexp_match(notes, 'Voucher: *[A-Z0-9]+ *\(-([0-9]+([.][0-9]+)?)%'))[1]::NUMERIC AS discount_percent
  FROM public.transactions
  WHERE notes LIKE '%Voucher:%' OR voucher_used IS NOT NULL
)
UPDATE public.transactions AS tx
SET original_amount = voucher_transactions.gross_amount,
    amount_paid = ROUND(voucher_transactions.gross_amount * (100 - voucher_transactions.discount_percent) / 100, 2),
    voucher_used = voucher_transactions.voucher_code
FROM voucher_transactions
WHERE tx.id = voucher_transactions.id
  AND voucher_transactions.voucher_code IS NOT NULL
  AND voucher_transactions.discount_percent BETWEEN 0 AND 100;

-- Older gateway submissions did not set voucher_used on the fine record.
WITH latest_voucher_transaction AS (
  SELECT DISTINCT ON (fine_id)
    fine_id,
    voucher_used,
    original_amount
  FROM public.transactions
  WHERE voucher_used IS NOT NULL
  ORDER BY fine_id, payment_date DESC
)
UPDATE public.fines AS fine
SET voucher_used = latest_voucher_transaction.voucher_used,
    original_amount = COALESCE(fine.original_amount, latest_voucher_transaction.original_amount)
FROM latest_voucher_transaction
WHERE fine.id = latest_voucher_transaction.fine_id;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_amount_paid_nonnegative_check
  CHECK (amount_paid >= 0);