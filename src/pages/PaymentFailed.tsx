import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, Home, RefreshCw } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { toast } from 'sonner';

export default function PaymentFailed() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // Get payment details from URL parameters
    const paymentId = searchParams.get('payment_id');
    const sourceId = searchParams.get('source_id');
    
    // Show error message with payment details
    const message = sourceId 
      ? `Payment failed! Transaction ID: ${sourceId}`
      : 'Payment was not completed';
    
    toast.error(message);
  }, [searchParams]);

  return (
    <AppLayout>
      <div className="content-wrapper pt-0">
        <div className="min-h-96 flex items-center justify-center px-4">
          <Card className="w-full max-w-md text-center card-elevated border-destructive/20 bg-destructive/5">
            <CardHeader className="pb-4">
              <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
                <AlertCircle className="h-8 w-8 text-destructive" />
              </div>
              <CardTitle className="text-2xl font-bold text-destructive">Payment Failed</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <p className="text-muted-foreground">
                  Your payment could not be completed. This could be due to insufficient funds, network issues, or the payment was cancelled.
                </p>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Transaction ID</p>
                  <p className="font-mono text-sm">{searchParams.get('source_id') || 'Unknown'}</p>
                </div>
                <div className="p-4 bg-warning/5 rounded-lg border border-warning/20">
                  <p className="text-sm text-warning font-medium mb-1">What to do next?</p>
                  <p className="text-xs text-muted-foreground">
                    You can try the payment again or contact support if the issue persists. Your fines remain unchanged.
                  </p>
                </div>
              </div>
              
              <div className="space-y-3">
                <Button 
                  onClick={() => navigate('/student-payment')} 
                  className="w-full"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Try Payment Again
                </Button>
                <Button 
                  onClick={() => navigate('/student-dashboard')} 
                  variant="outline" 
                  className="w-full"
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
