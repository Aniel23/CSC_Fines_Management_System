
-- Create Vouchers Table
CREATE TABLE IF NOT EXISTS public.vouchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Voucher Redemptions Table to track usage (optional for now, but good practice)
CREATE TABLE IF NOT EXISTS public.voucher_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    voucher_id UUID REFERENCES public.vouchers(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    redeemed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voucher_redemptions ENABLE ROW LEVEL SECURITY;

-- Policies for Vouchers (Read-only for authenticated users to verify codes)
CREATE POLICY "Enable read access for authenticated users" ON public.vouchers
    FOR SELECT USING (auth.role() = 'authenticated');

-- Policies for Redemptions (Insert for authenticated users to redeem)
CREATE POLICY "Enable insert for authenticated users" ON public.voucher_redemptions
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');
    
CREATE POLICY "Enable read access for authenticated users" ON public.voucher_redemptions
    FOR SELECT USING (auth.role() = 'authenticated');

-- Seed Sample Voucher
INSERT INTO public.vouchers (code, amount, description)
VALUES 
    ('COMMUNITY50', 50.00, 'Community Service Reward'),
    ('EARLYBIRD20', 20.00, 'Early Payment Discount')
ON CONFLICT (code) DO NOTHING;
