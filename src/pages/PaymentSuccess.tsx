import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Home, Receipt, Loader } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { toast } from 'sonner';
import { createTransaction, updateFine } from '@/integrations/supabase/queries';
import type { FineStatus } from '@/data/mockData';
import { useAuth } from '@/contexts/AuthContext';

export default function PaymentSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentProcessed, setPaymentProcessed] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    // Get payment details from URL parameters
    const paymentId = searchParams.get('payment_id');
    const sourceId = searchParams.get('source_id');
    const fineIds = searchParams.get('fineIds');
    
    console.log('Payment Success:', { paymentId, sourceId, fineIds });
    
    // Show success message with payment details
    const message = sourceId 
      ? `Payment successful! Transaction ID: ${sourceId}`
      : 'Payment completed successfully!';
    
    toast.success(message);

    // Process the payment in database if we have fine IDs
    if (fineIds && !paymentProcessed) {
      processPayment(fineIds, sourceId);
    }
  }, [searchParams, paymentProcessed]);

  const processPayment = async (fineIds: string, sourceId: string | null) => {
    setIsProcessing(true);
    
    try {
      const fineIdArray = fineIds.split(',');
      
      // Get payment amount from URL or calculate it
      const paymentAmount = searchParams.get('amount') || '0';
      const amount = parseFloat(paymentAmount);
      
      // Check if we're in test mode AND user is a student (not admin)
      const isTestMode = window.location.hostname === 'localhost' || 
                        window.location.hostname.includes('netlify.app') ||
                        window.location.hostname.includes('preview');
      
      const isStudent = user?.role === 'student';
      const shouldAutoApprove = isTestMode && isStudent;
      
      // Process each fine
      const paymentPromises = fineIdArray.map(async (fineId) => {
        try {
          // 1. Update fine status to "Pending" (Awaiting Approval)
          // We can't easily know the partial amount from URL alone if multiple fines were paid partially.
          // In a real app we'd pass a payment map. For now, assume full balance if this is the generic success page.
          const { data: currentFine } = await supabase.from('fines').select('balance').eq('id', fineId.trim()).single();
          const amountToPay = currentFine?.balance || amount;

          await updateFine(fineId.trim(), { 
            status: "Pending",
            pending_payment: amountToPay
          });

          // 2. Create a transaction record with actual amount
          await createTransaction({
            fine_id: fineId.trim(),
            amount_paid: amountToPay,
            payment_date: new Date().toISOString(),
            notes: `PayMongo Payment - Source ID: ${sourceId}, Status: Pending Approval`
          });
          
          // 3. Auto-approve only for students in test mode after 2 seconds
          if (shouldAutoApprove) {
            setTimeout(async () => {
              try {
                const newBalance = Math.max(0, (currentFine?.balance || amount) - amountToPay);
                await updateFine(fineId.trim(), { 
                  status: newBalance === 0 ? "Paid" : "To Pay",
                  balance: newBalance,
                  pending_payment: 0
                });
                toast.success(`Fine ${fineId} automatically approved (test mode)`);
              } catch (error) {
              }
            }, 2000);
          }
        } catch (error) {
        }
      });

      await Promise.all(paymentPromises);
      setPaymentProcessed(true);
      
      if (shouldAutoApprove) {
        toast.success('Payment processed! Auto-approval enabled for student test mode.');
      } else {
        toast.success('Payment processed successfully! Fines are now pending admin approval.');
      }
    } catch (error) {
      toast.error('There was an issue processing your payment. Please contact support.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <AppLayout>
      <div className="content-wrapper pt-0">
        <div className="min-h-96 flex items-center justify-center px-4">
          <Card className="w-full max-w-md text-center card-elevated border-success/20 bg-success/5">
            <CardHeader className="pb-4">
              <div className="mx-auto w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mb-4">
                {isProcessing ? (
                  <Loader className="h-8 w-8 text-success animate-spin" />
                ) : (
                  <CheckCircle className="h-8 w-8 text-success" />
                )}
              </div>
              <CardTitle className="text-2xl font-bold text-success">
                {isProcessing ? 'Processing Payment...' : 'Payment Successful!'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <p className="text-muted-foreground">
                  {isProcessing 
                    ? 'Please wait while we update your payment records...'
                    : 'Your payment has been processed successfully. The fines have been updated and are now pending admin approval.'
                  }
                </p>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Transaction ID</p>
                  <p className="font-mono text-sm">{searchParams.get('source_id') || 'Processing...'}</p>
                </div>
                <div className="p-4 bg-info/5 rounded-lg border border-info/20">
                  <p className="text-sm text-info font-medium mb-1">Next Steps</p>
                  <p className="text-xs text-muted-foreground">
                    {isProcessing ? 'Please wait while we update your payment records...' : 
                     (window.location.hostname === 'localhost' || 
                      window.location.hostname.includes('netlify.app') ||
                      window.location.hostname.includes('preview')) && user?.role === 'student' ? 
                     'Your payment is being processed and will be automatically approved in 2 seconds (student test mode).' :
                     'Your payment is now pending verification by administration. You can check status in your fines section.'}
                  </p>
                </div>
              </div>
              
              <div className="space-y-3">
                <Button 
                  onClick={() => navigate('/student-payment')} 
                  className="w-full bg-success hover:bg-success/90"
                  disabled={isProcessing}
                >
                  <Receipt className="mr-2 h-4 w-4" />
                  View Payment Status
                </Button>
                <Button 
                  onClick={() => navigate('/student-dashboard')} 
                  variant="outline" 
                  className="w-full"
                  disabled={isProcessing}
                >
                  <Home className="mr-2 h-4 w-4" />
                  Back to Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
