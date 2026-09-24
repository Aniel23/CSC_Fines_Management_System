import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PaymentSuccess from '../pages/PaymentSuccess';
import { useAuth } from '@/contexts/AuthContext';

const mockUpdateFine = vi.fn();
const mockCreateTransaction = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/integrations/supabase/queries', () => ({
  updateFine: mockUpdateFine,
  createTransaction: mockCreateTransaction,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

describe('PaymentSuccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'user-1', role: 'student' },
    } as any);

    mockUpdateFine.mockResolvedValue({ id: 'fine-1' });
    mockCreateTransaction.mockResolvedValue({ id: 'txn-1' });

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { balance: 150 } }),
        }),
      }),
    });
  });

  it('renders the success screen and processes the payment', async () => {
    render(
      <MemoryRouter initialEntries={['/payment/success?source_id=pay_123&fineIds=fine-1&amount=150']}>
        <PaymentSuccess />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Payment Successful!/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(mockCreateTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          fine_id: 'fine-1',
          amount_paid: 150,
        })
      );
    });
  });
});
