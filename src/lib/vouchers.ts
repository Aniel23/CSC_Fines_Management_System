
export interface Voucher {
  code: string;
  amount: number;
  description: string;
  isActive: boolean;
}

export const VALID_VOUCHERS: Voucher[] = [
  {
    code: "COMMUNITY50",
    amount: 50.00,
    description: "Community Service Reward",
    isActive: true,
  },
  {
    code: "EARLYBIRD20",
    amount: 20.00,
    description: "Early Payment Discount",
    isActive: true,
  },
  {
    code: "SCHOLAR100",
    amount: 100.00,
    description: "Scholarship Allowance",
    isActive: true,
  },
];

export const getVoucherByCode = (code: string): Voucher | undefined => {
  return VALID_VOUCHERS.find((v) => v.code === code && v.isActive);
};
