import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loader, QrCode, ExternalLink, Smartphone, Upload, CheckCircle2, Image as ImageIcon, Plus } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  const [proofFiles, setProofFiles] = useState<File[]>([]);
  const [proofPreviews, setProofPreviews] = useState<Array<{ src: string; type: 'image' | 'video'; name: string }>>([]);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [tempFiles, setTempFiles] = useState<File[]>([]);
  const [tempPreviews, setTempPreviews] = useState<Array<{ src: string; type: 'image' | 'video'; name: string }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { settings } = useAppSettings();

  const paymentService = PaymentService.getInstance();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const maxFiles = 6;
    const selected = files.slice(0, maxFiles);

    const previews: Array<{ src: string; type: 'image' | 'video'; name: string }> = [];
    const validFiles: File[] = [];

    for (const file of selected) {
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');

      // Validate type
      if (!isImage && !isVideo) {
        toast.error(`Unsupported file type: ${file.name}`);
        continue;
      }

      // Validate size: images 5MB, videos 50MB
      const maxSize = isImage ? 5 * 1024 * 1024 : 50 * 1024 * 1024;
      if (file.size > maxSize) {
        toast.error(`${file.name} is too large (${Math.round(file.size / 1024 / 1024)}MB)`);
        continue;
      }

      validFiles.push(file);

      if (isImage) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setProofPreviews((prev) => [...prev, { src: reader.result as string, type: 'image', name: file.name }]);
        };
        reader.readAsDataURL(file);
      } else {
        // For video use object URL for quick preview
        const url = URL.createObjectURL(file);
        previews.push({ src: url, type: 'video', name: file.name });
      }
    }

    // Append any video previews that used object URLs
    if (previews.length > 0) setProofPreviews((prev) => [...prev, ...previews]);

    // Replace current proof files with the valid selection (append if there were already files)
    setProofFiles((prev) => [...prev, ...validFiles].slice(0, maxFiles));
  };

  const removeProofAt = (index: number) => {
    setProofFiles((prev) => {
      const next = [...prev];
      next.splice(index, 1);
      return next;
    });
    setProofPreviews((prev) => {
      const next = [...prev];
      // Revoke object URL if it's a video
      const item = next[index];
      if (item && item.type === 'video') {
        try { URL.revokeObjectURL(item.src); } catch (e) {}
      }
      next.splice(index, 1);
      return next;
    });
  };

  const removeTempAt = (index: number) => {
    setTempFiles((prev) => {
      const next = [...prev];
      next.splice(index, 1);
      return next;
    });
    setTempPreviews((prev) => {
      const next = [...prev];
      const item = next[index];
      if (item && item.type === 'video') {
        try { URL.revokeObjectURL(item.src); } catch (e) {}
      }
      next.splice(index, 1);
      return next;
    });
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
    if (!proofFiles || proofFiles.length === 0) {
      toast.error('Please upload your proof of payment first');
      return;
    }

    setIsProcessing(true);
    
    try {
      // 1. Upload all proof files to Supabase Storage and collect public URLs
      const uploadedUrls: string[] = [];

      for (const file of proofFiles) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('payment-proofs')
          .upload(filePath, file, { contentType: file.type });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
          .from('payment-proofs')
          .getPublicUrl(filePath);

        if (data?.publicUrl) uploadedUrls.push(data.publicUrl);
      }

      if (uploadedUrls.length === 0) throw new Error('No files were uploaded');

      // 2. Update fines in database with array of proofs
      const { error: updateError } = await supabase
        .from('fines')
        .update({ 
          status: 'Pending',
          payment_proofs: uploadedUrls,
          payment_proof: uploadedUrls[0] || null
        } as any)
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

              <div className="flex flex-col items-center justify-center py-4 rounded-lg">
                <ImageIcon className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-xs text-muted-foreground text-center px-4 mb-2">
                  Take a screenshot or record a short video of your CSC slip and upload here. You may select multiple files.
                </p>
                <div className="flex items-center gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button onClick={() => setIsUploadModalOpen(true)} className="bg-primary text-white flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        Choose Images / Videos
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Add images or short videos of the CSC slip</TooltipContent>
                  </Tooltip>
                  {proofPreviews.length > 0 && (
                    <span className="text-xs text-muted-foreground">{proofPreviews.length} file(s) selected</span>
                  )}
                </div>
              </div>

              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*,video/*"
                multiple
                className="hidden"
              />
            
              <Dialog open={isUploadModalOpen} onOpenChange={(open) => {
                if (!open) {
                  // Cancel -> discard temp
                  setTempFiles([]);
                  setTempPreviews([]);
                }
                setIsUploadModalOpen(open);
              }}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Select Proof Files</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="flex flex-col gap-2">
                      <input
                        type="file"
                        accept="image/*,video/*"
                        multiple
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          const maxFiles = 6;
                          const selected = files.slice(0, maxFiles);
                          const previews: Array<{ src: string; type: 'image' | 'video'; name: string }> = [];
                          const validFiles: File[] = [];

                          for (const file of selected) {
                            const isImage = file.type.startsWith('image/');
                            const isVideo = file.type.startsWith('video/');
                            if (!isImage && !isVideo) continue;
                            const maxSize = isImage ? 5 * 1024 * 1024 : 50 * 1024 * 1024;
                            if (file.size > maxSize) continue;
                            validFiles.push(file);
                            if (isImage) {
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                setTempPreviews((prev) => [...prev, { src: reader.result as string, type: 'image', name: file.name }]);
                              };
                              reader.readAsDataURL(file);
                            } else {
                              const url = URL.createObjectURL(file);
                              previews.push({ src: url, type: 'video', name: file.name });
                            }
                          }
                          if (previews.length > 0) setTempPreviews((prev) => [...prev, ...previews]);
                          setTempFiles((prev) => [...prev, ...validFiles].slice(0, 6));
                        }}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {(tempPreviews.length > 0 ? tempPreviews : proofPreviews).map((p, idx) => (
                        <div key={idx} className="relative border rounded-lg overflow-hidden">
                          {p.type === 'image' ? (
                            <img src={p.src} alt={p.name} className="w-full h-36 object-cover" />
                          ) : (
                            <video src={p.src} className="w-full h-36 object-cover bg-black" controls />
                          )}
                          <div className="absolute top-2 right-2 flex gap-2">
                            <Button size="icon" variant="ghost" onClick={() => removeTempAt(idx)} className="bg-white/80">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6.707 6.707a1 1 0 00-1.414-1.414L2 8.586 6.707 13.293a1 1 0 001.414-1.414L4.414 8.586l2.293-2.293z" clipRule="evenodd"/></svg>
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => { setIsUploadModalOpen(false); setTempFiles([]); setTempPreviews([]); }}>
                        Cancel
                      </Button>
                      <Button onClick={() => {
                        // Commit temp into main
                        if (tempFiles.length > 0) setProofFiles((prev) => [...prev, ...tempFiles].slice(0, 6));
                        if (tempPreviews.length > 0) setProofPreviews((prev) => [...prev, ...tempPreviews].slice(0, 6));
                        setTempFiles([]);
                        setTempPreviews([]);
                        setIsUploadModalOpen(false);
                      }}>
                        Done
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
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
