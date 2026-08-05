
export interface Voucher {
  code: string;
  discountPercent: number;
  description: string;
  isActive: boolean;
}

export const VALID_VOUCHERS: Voucher[] = [
  {
    code: "COMMUNITY50",
    discountPercent: 50.00,
    description: "Community Service Reward",
    isActive: true,
  },
  {
    code: "EARLYBIRD20",
    discountPercent: 20.00,
    description: "Early Payment Discount",
    isActive: true,
  },
  {
    code: "SCHOLAR100",
    discountPercent: 100.00,
    description: "Scholarship Allowance",
    isActive: true,
  },
];

export const getVoucherByCode = (code: string): Voucher | undefined => {
  return VALID_VOUCHERS.find((v) => v.code === code && v.isActive);
};
