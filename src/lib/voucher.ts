export interface VoucherPaymentLine {
  fineId: string;
  originalAmount: number;
  discountAmount: number;
  amountToPay: number;
}

export function getVoucherCode(voucherUsed?: string | null, notes?: string | null): string | null {
  if (voucherUsed?.trim()) return voucherUsed.trim();
  return notes?.match(/Voucher:\s*([A-Z0-9_-]+)/i)?.[1] ?? null;
}

export function getVoucherDiscountPercent(notes?: string | null): number | null {
  const match = notes?.match(/Voucher:.*?\(-([0-9]+(?:\.[0-9]+)?)%/i);
  if (!match) return null;
  const percent = Number(match[1]);
  return Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : null;
}

/** Gets the discounted paid amount, also interpreting older rows that saved gross amounts. */
export function getDisplayPaidAmount(
  transaction: { amount_paid: number; original_amount?: number | null; notes?: string | null } | null | undefined,
  fineOriginalAmount?: number | null,
): number | null {
  if (!transaction) return null;

  const grossAmount = Number(transaction.original_amount ?? fineOriginalAmount ?? transaction.amount_paid);
  if (transaction.amount_paid < grossAmount) return transaction.amount_paid;

  const discountPercent = getVoucherDiscountPercent(transaction.notes);
  if (discountPercent === null || !getVoucherCode(null, transaction.notes)) {
    return transaction.amount_paid;
  }

  return Math.round(grossAmount * (100 - discountPercent)) / 100;
}

/** Allocates a percentage discount across selected fines without losing cents to rounding. */
export function calculateVoucherPaymentLines(
  payments: Array<{ fineId: string; amount: number }>,
  discountPercent = 0,
): VoucherPaymentLine[] {
  const amountsInCents = payments.map(({ fineId, amount }) => ({
    fineId,
    cents: Math.max(0, Math.round((Number(amount) || 0) * 100)),
  }));
  const totalCents = amountsInCents.reduce((sum, payment) => sum + payment.cents, 0);
  const percentage = Math.min(100, Math.max(0, Number(discountPercent) || 0));
  const totalDiscountCents = Math.round(totalCents * percentage / 100);
  const discountAllocations = amountsInCents.map((payment) =>
    totalCents === 0 ? 0 : Math.floor(totalDiscountCents * payment.cents / totalCents),
  );
  const centsRemaining = totalDiscountCents - discountAllocations.reduce((sum, cents) => sum + cents, 0);
  const remainderOrder = amountsInCents
    .map((payment, index) => ({
      index,
      remainder: totalCents === 0 ? 0 : totalDiscountCents * payment.cents % totalCents,
    }))
    .sort((left, right) => right.remainder - left.remainder || left.index - right.index);

  for (let index = 0; index < centsRemaining; index += 1) {
    discountAllocations[remainderOrder[index].index] += 1;
  }

  return amountsInCents.map((payment, index) => {
    const discountCents = discountAllocations[index];
    return {
      fineId: payment.fineId,
      originalAmount: payment.cents / 100,
      discountAmount: discountCents / 100,
      amountToPay: (payment.cents - discountCents) / 100,
    };
  });
}