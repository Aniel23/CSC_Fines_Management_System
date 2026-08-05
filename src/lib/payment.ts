// Payment integration types and utilities
// Removed PayMongo integration as requested

export interface PaymentMethod {
  id: string;
  name: string;
  type: 'qrph';
  icon: string;
}

export interface PaymentRequest {
  amount: number;
  description: string;
  customer: {
    email?: string;
    name?: string;
    phone?: string;
  };
  metadata?: Record<string, any>;
}

export interface PaymentResponse {
  id: string;
  status: 'pending' | 'paid' | 'failed' | 'refunded';
  checkoutUrl?: string;
  qrCode?: string;
  referenceNumber: string;
}

// Mock payment methods - replace with actual API calls
export const PAYMENT_METHODS: PaymentMethod[] = [
  {
    id: 'qrph',
    name: 'Scan to Pay (QR Ph)',
    type: 'qrph',
    icon: 'https://upload.wikimedia.org/wikipedia/commons/f/fa/QR_Ph_logo.png'
  }
];

// Payment Service without PayMongo Integration
export class PaymentService {
  private static instance: PaymentService;

  static getInstance(): PaymentService {
    if (!PaymentService.instance) {
      PaymentService.instance = new PaymentService();
    }
    return PaymentService.instance;
  }

  constructor() {
    // No initialization needed for PayMongo anymore
  }

  async createPayment(request: PaymentRequest, method: PaymentMethod): Promise<PaymentResponse> {
    try {
      return await this.createMockPayment(request, method);
    } catch (error) {
      throw new Error('Payment processing failed');
    }
  }

  private async createMockPayment(request: PaymentRequest, method: PaymentMethod): Promise<PaymentResponse> {
    console.log('Creating mock payment:', { request, method });

    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Using the same static QR code for mock as well
    return {
      id: `pay_${Date.now()}`,
      status: 'pending',
      qrCode: '/api/IMG_20260227_115552.jpg',
      referenceNumber: `REF-${Date.now().toString().slice(-8)}`
    };
  }

  async checkPaymentStatus(paymentId: string): Promise<PaymentResponse> {
    try {
      // Mock status check
      await new Promise(resolve => setTimeout(resolve, 1000));
      return {
        id: paymentId,
        status: 'paid',
        referenceNumber: this.generateReferenceNumber()
      };
    } catch (error) {
      throw error;
    }
  }

  private generateMockCheckoutUrl(method: PaymentMethod): string {
    const baseUrl = window.location.origin;
    return `${baseUrl}/payment/checkout?method=${method.id}&id=${Date.now()}`;
  }

  private generateMockQRCode(): string {
    // In production, this would come from the payment gateway
    return `data:image/png;base64,mock-qr-code-data`;
  }

  private generateReferenceNumber(): string {
    return `REF-${Date.now().toString().slice(-8)}`;
  }

  // Helper method to check if real API is enabled
  isRealApiEnabled(): boolean {
    return false; // Always false since PayMongo is removed
  }
}