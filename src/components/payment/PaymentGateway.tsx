import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loader, QrCode, ExternalLink, Smartphone, Upload, CheckCircle2, Image as ImageIcon } from 'lucide-react';
import { PaymentService, PaymentMethod, PAYMENT_METHODS, PaymentResponse } from '@/lib/payment';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAppSettings } from '@/hooks/useAppSettings';

interface PaymentGatewayProps {
  amount: number;
  fineIds: string[];
  onSuccess: (paymentResponse: PaymentResponse) => void;
  onCancel: () => void;
}

export default function PaymentGateway({ amount, fineIds, onSuccess, onCancel }: PaymentGatewayProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentResponse, setPaymentResponse] = useState<PaymentResponse | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { settings } = useAppSettings();

  const paymentService = PaymentService.getInstance();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size must be less than 5MB');
        return;
      }
      setProofFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setProofPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePaymentMethodSelect = (method: PaymentMethod) => {
    setSelectedMethod(method);
    setShowQR(false);
    setPaymentResponse(null);
  };

  const handleProcessPayment = async () => {
    if (!selectedMethod) {
      toast.error('Please select a payment method');
      return;
    }

    setIsProcessing(true);
    
    try {
      const response = await paymentService.createPayment(
        {
          amount,
          description: `Payment for ${fineIds.length} fine(s)`,
          customer: {
            name: 'Student',
            email: 'student@school.edu'
          },
          metadata: {
            fineIds,
            type: 'student_fines'
          }
        },
        selectedMethod
      );

      setPaymentResponse(response);
      setShowQR(true);
      toast.success('QR Code generated! Please scan to pay.');
    } catch (error) {
      toast.error('Payment processing failed. Please try again.');
      console.error('Payment error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!paymentResponse) return;
    if (!proofFile) {
      toast.error('Please upload your proof of payment first');
      return;
    }

    setIsProcessing(true);
    
    try {
      // 1. Upload proof image to Supabase Storage
      const fileExt = proofFile.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
      const filePath = `${fileName}`; // No folder prefix needed for bucket root

      // Upload to 'payment-proofs' bucket
      const { error: uploadError } = await supabase.storage
        .from('payment-proofs')
        .upload(filePath, proofFile);

      if (uploadError) throw uploadError;

      // 2. Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('payment-proofs')
        .getPublicUrl(filePath);

      // 3. Update fines in database
      // Note: We need to handle this update properly in the database schema
      // Ideally fines table should have payment_proof column
      const { error: updateError } = await supabase
        .from('fines')
        .update({ 
          status: 'Pending',
          payment_proof: publicUrl
        } as any) // Cast as any to bypass strict type check if column missing in types
        .in('id', fineIds);

      if (updateError) throw updateError;

      toast.success('Proof of payment submitted! Admin will verify your transaction.');
      onSuccess({
        id: paymentResponse.id,
        status: 'pending',
        referenceNumber: paymentResponse.referenceNumber
      });
    } catch (error: any) {
      console.error("Payment confirmation error:", error);
      toast.error(error.message || 'Confirmation failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  const getPaymentIcon = (method: PaymentMethod) => {
    return (
      <img 
        src={method.icon} 
        alt={method.name}
        className="w-12 h-12 object-contain"
        onError={(e) => {
          // Fallback to simple text if image fails to load
          const target = e.target as HTMLImageElement;
          target.style.display = 'none';
          const parent = target.parentElement;
          if (parent) {
            const fallback = document.createElement('div');
            fallback.className = 'w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center text-gray-600 font-bold text-sm';
            fallback.textContent = method.name.charAt(0);
            parent.appendChild(fallback);
          }
        }}
      />
    );
  };

  return (
    <div className="space-y-6">
      {/* Payment Method Selection */}
      {!selectedMethod && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Choose Payment Method</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {PAYMENT_METHODS.map((method) => (
              <Card
                key={method.id}
                className="cursor-pointer hover:shadow-md transition-all hover:scale-105"
                onClick={() => handlePaymentMethodSelect(method)}
              >
                <CardContent className="p-4 text-center">
                  <div className="flex justify-center mb-2">
                    {getPaymentIcon(method)}
                  </div>
                  <p className="font-medium">{method.name}</p>
                  <Badge variant="outline" className="mt-2 text-xs">
                    {method.type === 'gcash' || method.type === 'paymaya' ? 'E-Wallet' : 'Card'}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Selected Payment Method */}
      {selectedMethod && !paymentResponse && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {getPaymentIcon(selectedMethod)}
              Pay with {selectedMethod.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-6 bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl border-2 border-primary/20">
              <label className="text-sm font-semibold text-primary mb-3 block">Amount to Pay:</label>
              <div className="flex items-center justify-center">
                <span className="text-4xl sm:text-5xl font-black text-foreground">₱{amount.toLocaleString()}</span>
              </div>
              <p className="text-center text-xs text-muted-foreground mt-2">
                Total for {fineIds.length} fine{fineIds.length > 1 ? 's' : ''}
              </p>
            </div>
            
            <div className="flex gap-3">
              <Button
                onClick={handleProcessPayment}
                disabled={isProcessing}
                className="flex-1"
              >
                {isProcessing ? (
                  <>
                    <Loader className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  `Pay with ${selectedMethod.name}`
                )}
              </Button>
              <Button variant="outline" onClick={() => setSelectedMethod(null)}>
                Back
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {showQR && paymentResponse && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Scan QR Code to Pay
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-center">
              <div className="w-64 h-64 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center border-2 border-dashed border-gray-300">
                { (settings.payment_qr_url || paymentResponse.qrCode) ? (
                  <img src={settings.payment_qr_url || (paymentResponse.qrCode as string)} alt="Payment QR Code" className="w-full h-full object-contain" />
                ) : (
                  <div className="text-center">
                    <QrCode className="h-16 w-16 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">QR Code Loading...</p>
                  </div>
                )}
              </div>
            </div>
            
            <div className="text-center space-y-2">
              <p className="text-sm text-gray-600">
                Reference Number: <span className="font-mono font-bold">{paymentResponse.referenceNumber}</span>
              </p>
            </div>

            {/* Proof of Payment Upload */}
            <div className="mt-6 p-4 border-2 border-dashed border-primary/20 rounded-xl bg-primary/5">
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Upload Proof of Payment
              </h4>
              
              {!proofPreview ? (
                <div 
                  className="flex flex-col items-center justify-center py-4 cursor-pointer hover:bg-primary/10 transition-colors rounded-lg"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImageIcon className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-xs text-muted-foreground text-center px-4">
                    Take a screenshot of your GCash/Maya receipt and upload it here
                  </p>
                  <Button variant="outline" size="sm" className="mt-3">
                    Select Image
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <img 
                    src={proofPreview} 
                    alt="Proof preview" 
                    className="w-full h-40 object-cover rounded-lg border" 
                  />
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    className="absolute bottom-2 right-2 opacity-90"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Change Image
                  </Button>
                  <div className="absolute top-2 right-2 bg-success text-white p-1 rounded-full shadow-lg">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                </div>
              )}
              
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />
            </div>

            <div className="flex gap-3">
              <Button
                onClick={handleConfirmPayment}
                disabled={isProcessing}
                className="flex-1"
              >
                {isProcessing ? (
                  <>
                    <Loader className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'I Have Paid'
                )}
              </Button>
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment Instructions */}
      {selectedMethod && !showQR && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4 text-center">
            <h4 className="font-semibold text-blue-900 mb-2">Instructions:</h4>
            <p className="text-sm text-blue-800">
              Click the button below to generate your unique payment QR code. 
              You can scan this code with GCash, Maya, or any banking app to pay.
            </p>
          </CardContent>
        </Card>
      )}

      {showQR && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <h4 className="font-semibold text-blue-900 mb-2">How to Pay:</h4>
            <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
              <li>Open your GCash, Maya, or Banking App</li>
              <li>Select "Scan QR" or "Scan to Pay"</li>
              <li>Scan the QR code displayed above</li>
              <li>Review the amount and confirm the transaction</li>
              <li>Once paid, click "I Have Paid" below</li>
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
