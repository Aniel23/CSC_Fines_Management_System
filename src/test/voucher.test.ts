import { describe, expect, it } from "vitest";
import {
  calculateVoucherPaymentLines,
  getDisplayPaidAmount,
  getVoucherCode,
} from "@/lib/voucher";

describe("calculateVoucherPaymentLines", () => {
  it("allocates a percentage discount across fines and preserves the total", () => {
    const lines = calculateVoucherPaymentLines(
      [
        { fineId: "fine-1", amount: 10 },
        { fineId: "fine-2", amount: 20 },
      ],
      10,
    );

    expect(lines.map(({ amountToPay }) => amountToPay)).toEqual([9, 18]);
    expect(lines.reduce((sum, line) => sum + line.amountToPay, 0)).toBe(27);
  });

  it("distributes rounding cents so the line items match the discounted total", () => {
    const lines = calculateVoucherPaymentLines(
      [
        { fineId: "fine-1", amount: 0.05 },
        { fineId: "fine-2", amount: 0.05 },
        { fineId: "fine-3", amount: 0.05 },
      ],
      10,
    );

    expect(lines.reduce((sum, line) => sum + line.discountAmount, 0)).toBe(0.02);
    expect(lines.reduce((sum, line) => sum + line.amountToPay, 0)).toBe(0.13);
  });

  it("allocates equal fine discounts evenly", () => {
    const lines = calculateVoucherPaymentLines(
      [
        { fineId: "fine-1", amount: 10 },
        { fineId: "fine-2", amount: 10 },
        { fineId: "fine-3", amount: 10 },
      ],
      20,
    );

    expect(lines.map(({ amountToPay }) => amountToPay)).toEqual([8, 8, 8]);
  });

  it("supports a 100% voucher and clamps invalid percentages", () => {
    expect(calculateVoucherPaymentLines([{ fineId: "fine-1", amount: 25 }], 100)[0])
      .toMatchObject({ originalAmount: 25, discountAmount: 25, amountToPay: 0 });
    expect(calculateVoucherPaymentLines([{ fineId: "fine-1", amount: 25 }], 150)[0].amountToPay)
      .toBe(0);
  });

  it("recovers voucher details and discounted amounts from legacy transaction notes", () => {
    const notes = "Method: CSC-Slip, Voucher: SAVE20 (-20%, ₱20.00 off)";
    expect(getVoucherCode(null, notes)).toBe("SAVE20");
    expect(getDisplayPaidAmount({ amount_paid: 100, notes }, 100)).toBe(80);
  });

  it("uses the stored net amount when the voucher-adjusted record is already correct", () => {
    expect(getDisplayPaidAmount({
      amount_paid: 80,
      original_amount: 100,
      notes: "Voucher: SAVE20 (-20%, ₱20.00 off)",
    })).toBe(80);
  });
});