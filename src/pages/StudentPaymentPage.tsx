import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle, CreditCard, Loader, X, Clock, User as UserIcon, Upload, ImageIcon, Plus } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { useState, useEffect, useRef } from "react";
import { useFines } from "@/hooks/useFines";
import { useStudents } from "@/hooks/useStudents";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { createTransaction, updateFine } from "@/integrations/supabase/queries";
import { supabase } from "@/integrations/supabase/client";
import type { FineStatus } from "@/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { Ticket } from "lucide-react";
import { useTransactions } from "@/hooks/useTransactions";
import { useAppSettings } from "@/hooks/useAppSettings";
 
interface Voucher {
  id: string;
  code: string;
  amount: number;
  description: string;
  isActive: boolean;
  createdAt: string;
  usedBy?: string[];
  usageLimit?: number;
}

export default function StudentPaymentPage() {
  const { user } = useAuth();
  const { fines, loading: finesLoading, error: finesError, refetch } = useFines();
  const { students, loading: studentsLoading } = useStudents();
  const { transactions } = useTransactions();
  const { settings, upsertSetting } = useAppSettings();
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  
  // All hooks must be called before any early returns
  const [selectedFines, setSelectedFines] = useState<string[]>([]);
  const [paymentAmounts, setPaymentAmounts] = useState<Record<string, number>>({});
  const [paymentMethod, setPaymentMethod] = useState<"Online" | "Over-the-Counter" | "CSC-Slip">("Online");
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [proofImages, setProofImages] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isCscModalOpen, setIsCscModalOpen] = useState(false);
  const [voucherCode, setVoucherCode] = useState("");
  const [appliedVoucher, setAppliedVoucher] = useState<Voucher | null>(null);
  const [showVoucherConfirmDialog, setShowVoucherConfirmDialog] = useState(false);
  const [pendingVoucher, setPendingVoucher] = useState<Voucher | null>(null);

  // Calculate selected amount based on payment amounts (Moved up to be accessible for useEffect)
  const subtotalAmount = selectedFines.reduce((sum, id) => sum + (paymentAmounts[id] || 0), 0);
  const voucherDiscount = appliedVoucher ? Math.round(subtotalAmount * (appliedVoucher.amount / 100)) : 0;
  const selectedAmount = Math.max(0, subtotalAmount - voucherDiscount);

  useEffect(() => {
    if (settings.voucher_codes) {
      try {
        const parsed = JSON.parse(settings.voucher_codes);
        if (Array.isArray(parsed)) {
          setVouchers(parsed);
        }
      } catch (e) {
        console.error("Failed to parse vouchers:", e);
      }
    }
  }, [settings.voucher_codes]);

  if (finesLoading || studentsLoading) {
    return (
      <AppLayout>
        <div className="content-wrapper pt-0 flex items-center justify-center min-h-96">
          <div className="flex flex-col items-center gap-3">
            <Loader className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading payment information...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (finesError) {
    return (
      <AppLayout>
        <div className="content-wrapper pt-0">
          <Card className="border-destructive/50 bg-destructive/5">
            <CardHeader>
              <CardTitle className="text-destructive">Error Loading Data</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-destructive/80">{finesError}</p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  // Check if data is empty
  if (students.length === 0) {
    return (
      <AppLayout>
        <div className="content-wrapper pt-0">
          <Card className="card-elevated border-warning/50">
            <CardHeader>
              <CardTitle className="text-warning">No Student Data Available</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-warning/80">
                No student records found in the database. Please contact support.
              </p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  // Get current student data by matching user.studentId with student.id
  const currentStudent = students.find((s) => s.id === user?.studentId) || students.find((s) => s.student_id === user?.studentId);
  
  // If no current student found, show error
  if (!currentStudent) {
    return (
      <AppLayout>
        <div className="content-wrapper pt-0">
          <Card className="border-destructive/50 bg-destructive/5">
            <CardHeader>
              <CardTitle className="text-destructive">No Student Profile Found</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-destructive/80">
                Could not find your student profile. Please contact support.
              </p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }
  
  // Get pending/unpaid fines for the current student
  const studentFines = fines.filter((f) => f.student_id === currentStudent?.id);

  // Fines that the student can pay (Initial state)
  const toPayFines = studentFines.filter((f) => f.status === "To Pay");
  
  // Fines already submitted for approval
  const pendingApprovalFines = studentFines.filter((f) => f.status === "Pending");
  
  // Settled fines
  const paidFines = studentFines.filter((f) => f.status === "Paid");

  const handleApplyVoucher = () => {
    if (!voucherCode.trim()) {
      toast.error("Please enter a voucher code");
      return;
    }

    const code = voucherCode.toUpperCase().trim();
    const voucher = vouchers.find(v => v.code === code && v.isActive);

    if (voucher) {
      // Validation 0: Expiration Date
      if (voucher.expirationDate && new Date(voucher.expirationDate) < new Date()) {
        toast.error("This voucher has expired.");
        setAppliedVoucher(null);
        return;
      }

      // Validation 1: Already used? (Check settings + local transactions)
      const hasUsedInSettings = voucher.usedBy?.includes(currentStudent.id);
      const hasUsedInTransactions = transactions.some(t => 
        t.fines?.student_id === currentStudent.id && 
        t.notes?.includes(`Voucher: ${voucher.code}`)
      );

      if (hasUsedInSettings || hasUsedInTransactions) {
        toast.error("You have already used this voucher code.");
        setAppliedVoucher(null);
        return;
      }

      // Validation 2: Global usage limit
      // Note: This count might be slightly delayed as it relies on admin approval to update settings
      if (voucher.usageLimit && (voucher.usedBy?.length || 0) >= voucher.usageLimit) {
        toast.error("This voucher has reached its maximum usage limit.");
        setAppliedVoucher(null);
        return;
      }

      // Validation 3: Amount check - if voucher exceeds amount, show confirmation
      if (voucher.amount > subtotalAmount) {
        setPendingVoucher(voucher);
        setShowVoucherConfirmDialog(true);
        return;
      }

      setAppliedVoucher(voucher);
      toast.success(`Voucher applied: ${voucher.description}`);
      setVoucherCode(""); // Clear input on success
    } else {
      toast.error("Invalid or inactive voucher code");
      setAppliedVoucher(null);
    }
  };

  const handleConfirmVoucher = () => {
    if (pendingVoucher) {
      setAppliedVoucher(pendingVoucher);
      toast.success(`Voucher applied: ${pendingVoucher.description}`);
      setVoucherCode("");
      setPendingVoucher(null);
      setShowVoucherConfirmDialog(false);
    }
  };

  const handleCancelVoucher = () => {
    setPendingVoucher(null);
    setShowVoucherConfirmDialog(false);
    setVoucherCode("");
  };

  const handleRemoveVoucher = () => {
    setAppliedVoucher(null);
    toast.info("Voucher removed");
  };

  const handleSelectFine = (fineId: string) => {
    const fine = toPayFines.find(f => f.id === fineId);
    if (fine && fine.balance === 0) {
      toast.info("This fine has no outstanding balance.");
      return;
    }
    
    setSelectedFines((prev) => {
      if (prev.includes(fineId)) {
        // Remove
        const newAmounts = { ...paymentAmounts };
        delete newAmounts[fineId];
        setPaymentAmounts(newAmounts);
        return prev.filter((id) => id !== fineId);
      } else {
        // Add
        setPaymentAmounts(curr => ({ ...curr, [fineId]: fine?.balance || 0 }));
        return [...prev, fineId];
      }
    });
  };

  const handleSelectAll = () => {
    const payableFines = toPayFines.filter(f => f.balance > 0);
    if (selectedFines.length === payableFines.length && payableFines.length > 0) {
      setSelectedFines([]);
      setPaymentAmounts({});
    } else {
      setSelectedFines(payableFines.map((f) => f.id));
      const newAmounts: Record<string, number> = {};
      payableFines.forEach(f => { newAmounts[f.id] = f.balance; });
      setPaymentAmounts(newAmounts);
    }
  };

  const handleAmountChange = (fineId: string, amountStr: string, maxAmount: number) => {
    const num = parseFloat(amountStr);
    if (!isNaN(num)) {
      // Ensure amount is not less than 1 and not more than max balance
      const validNum = Math.min(maxAmount, Math.max(1, num));
      setPaymentAmounts(curr => ({ ...curr, [fineId]: validNum }));
    } else if (amountStr === '') {
      setPaymentAmounts(curr => ({ ...curr, [fineId]: 0 }));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      setProofImages(prev => [...prev, ...files]);

      files.forEach(file => {
        // Use Data URL for images, object URL for non-image (e.g., video)
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onloadend = () => {
            setPreviewUrls(prev => [...prev, reader.result as string]);
          };
          reader.readAsDataURL(file);
        } else {
          setPreviewUrls(prev => [...prev, URL.createObjectURL(file)]);
        }
      });
      // Reset the input so selecting the same file again works
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeImage = (index: number) => {
    setProofImages(prev => prev.filter((_, i) => i !== index));
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  const handlePaymentGatewaySuccess = async (paymentResponse: PaymentResponse) => {
    try {
      setIsSubmitting(true);
      
      // Record payments in database (create transaction and set fine status to "Pending")
      const paymentPromises = selectedFines.map(async (fineId) => {
        const fine = toPayFines.find((f) => f.id === fineId);
        if (!fine) return;

        // 1. Update fine status to "Pending" (Awaiting Approval)
        const amountToPay = paymentAmounts[fineId] || fine.balance;
        await updateFine(fineId, { 
          status: "Pending",
          pending_payment: amountToPay
        });

        // 2. Create a transaction record with payment gateway info
        await createTransaction({
          fine_id: fineId,
          amount_paid: amountToPay,
          payment_date: new Date().toISOString(),
          notes: `Gateway: ${paymentResponse.id}, Ref: ${paymentResponse.referenceNumber}, Status: Pending Approval${appliedVoucher ? ` | Voucher: ${appliedVoucher.code} (-${appliedVoucher.amount}%)` : ''}`
        });
      });

      await Promise.all(paymentPromises);

      // Note: Voucher usage is now recorded upon Admin approval to avoid RLS issues
      // The local transaction check prevents immediate reuse

      setSelectedFines([]);
      setShowPaymentGateway(false);
      setShowPaymentForm(false);
      setAppliedVoucher(null);
      setVoucherCode("");
      
      // Refresh the fines list
      await refetch();

      toast.success(
        "Payment submitted! Please wait for admin approval to view your receipt."
      );
    } catch (err) {
      console.error("Payment processing error:", err);
      toast.error("Failed to process payment. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePayment = async () => {
    if (selectedFines.length === 0) {
      toast.error("Please select at least one fine to pay");
      return;
    }

    // Skip payment method validation if voucher covers full amount
    if (selectedAmount > 0) {
      if (paymentMethod === "CSC-Slip" && proofImages.length === 0) {
        toast.error("Please upload at least one photo of your CSC Payment Slip or proof");
        return;
      }
    }

    try {
      setIsSubmitting(true);
      
      let uploadedProofUrls: string[] = [];

      // Handle file upload if CSC Slip (only if payment method is CSC-Slip and amount > 0)
      if (selectedAmount > 0 && paymentMethod === "CSC-Slip" && proofImages.length > 0) {
        for (const image of proofImages) {
          const fileExt = image.name.split('.').pop();
          const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
          const filePath = `${fileName}`; // No folder prefix needed for bucket root

          // Try to upload to the bucket
          const { error: uploadError } = await supabase.storage
            .from('payment-proofs')
            .upload(filePath, image);

          if (uploadError) {
            console.error("Upload error details:", uploadError);
            throw new Error("Failed to upload payment proof: " + uploadError.message);
          }

          const { data: { publicUrl } } = supabase.storage
            .from('payment-proofs')
            .getPublicUrl(filePath);
          uploadedProofUrls.push(publicUrl);
        }
      }

      // Generate reference number
      const referenceNumber = `PAY-${Date.now().toString().slice(-8)}`;

      // Determine payment method for notes
      const actualPaymentMethod = selectedAmount === 0 ? "Voucher" : paymentMethod;

      // Record payments in database (create transaction and set fine status to "Pending")
      const paymentPromises = selectedFines.map(async (fineId) => {
        const fine = toPayFines.find((f) => f.id === fineId);
        if (!fine) return;

        const amountToPay = paymentAmounts[fineId] || fine.balance;
        
        // 1. Update fine status to "Pending"
        await updateFine(fineId, { 
          status: "Pending",
          payment_proof: uploadedProofUrls.length > 0 ? uploadedProofUrls[0] : null, // Keep first for backward compatibility
          payment_proofs: uploadedProofUrls.length > 0 ? uploadedProofUrls : null,
          pending_payment: amountToPay,
          voucher_used: appliedVoucher ? appliedVoucher.code : null,
          original_amount: amountToPay
        });

        // 2. Create a transaction record
        await createTransaction({
          fine_id: fineId,
          amount_paid: amountToPay,
          payment_date: new Date().toISOString(),
          notes: `Method: ${actualPaymentMethod}, Ref: ${referenceNumber}, Status: Pending Approval${uploadedProofUrls.length > 0 ? ' (With Proof)' : ''}${appliedVoucher ? ` | Voucher: ${appliedVoucher.code} (-${appliedVoucher.amount}%)` : ''}`,
          voucher_used: appliedVoucher ? appliedVoucher.code : null,
          original_amount: amountToPay
        });

        // 3. Create notification for admins
        const { error: notifError } = await supabase.from("notifications").insert({
          user_id: user?.id, // Note: We attach the student's ID, but the query in NotificationsMenu allows admins to see ALL notifications
          title: "New Payment Submitted",
          message: `${user?.name || 'A student'} submitted a payment of ₱${amountToPay} for ${fine.fine_type}.`,
          type: "payment",
          actor_name: user?.name
        });
        
        if (notifError) {
          console.error("Error creating notification:", notifError);
        } else {
           console.log("Notification created successfully for payment.");
        }
      });

      await Promise.all(paymentPromises);

      // Trigger a custom event to force the notification menu to update immediately
      window.dispatchEvent(new CustomEvent('notification-update'));

      setSelectedFines([]);
      setShowPaymentForm(false);
      setProofImages([]);
      setPreviewUrls([]);
      setAppliedVoucher(null);
      setVoucherCode("");
      
      // Refresh the fines list
      await refetch();

      toast.success(
        "Payment submitted! Please wait for admin approval to view your receipt."
      );
    } catch (err) {
      console.error("Payment error:", err);
      toast.error("Failed to process payment. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppLayout>
      <div className="content-wrapper pt-0">
        <div className="flex flex-col md:flex-row items-center gap-6 mb-8">
          <div className="relative group">
            <Avatar className="h-20 w-20 border-4 border-primary/20 shrink-0">
              {(user?.avatarUrl || currentStudent.photo_url) && (
                <AvatarImage 
                  src={user?.avatarUrl || currentStudent.photo_url} 
                  alt={currentStudent.name} 
                  className="object-cover"
                />
              )}
              <AvatarFallback className="bg-muted text-muted-foreground text-xl font-bold">
                {currentStudent.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
          <div className="text-center md:text-left">
            <h1 className="font-display text-3xl font-bold text-foreground">
              Pay My Fines
            </h1>
            <p className="text-muted-foreground mt-1">
              Settle your outstanding violations, {currentStudent.name}
            </p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="card-elevated bg-card text-card-foreground">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                To Pay
              </CardTitle>
              <AlertCircle className="h-5 w-5 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{toPayFines.length}</div>
              <p className="text-sm text-muted-foreground mt-1">
                Awaiting payment
              </p>
            </CardContent>
          </Card>

          <Card className="card-elevated border-info/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pending Approval
              </CardTitle>
              <Clock className="h-5 w-5 text-info" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-info">{pendingApprovalFines.length}</div>
              <p className="text-sm text-muted-foreground mt-1">
                Submitted payments
              </p>
            </CardContent>
          </Card>

          <Card className="card-elevated bg-card text-card-foreground">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Settled Fines
              </CardTitle>
              <CheckCircle className="h-5 w-5 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{paidFines.length}</div>
              <p className="text-sm text-muted-foreground mt-1">
                ₱{paidFines.reduce((sum, f) => sum + f.amount, 0).toLocaleString()} total
              </p>
            </CardContent>
          </Card>
        </div>

        {/* To Pay Fines Section */}
        {toPayFines.length > 0 ? (
          <>
            <Card className="card-elevated mb-8 bg-card text-card-foreground">
              <CardHeader>
                <CardTitle className="font-display">Fines to Pay</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Desktop View Table */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="table-header">
                        <TableHead className="w-12">
                          <input
                            type="checkbox"
                            checked={
                              selectedFines.length === toPayFines.filter(f => f.balance > 0).length &&
                              toPayFines.filter(f => f.balance > 0).length > 0
                            }
                            onChange={handleSelectAll}
                            className="rounded border-input h-4 w-4"
                          />
                        </TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Type of Violation</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {toPayFines.map((fine) => (
                        <TableRow key={fine.id} className={selectedFines.includes(fine.id) ? "bg-primary/5" : ""}>
                          <TableCell>
                            <input
                              type="checkbox"
                              checked={selectedFines.includes(fine.id)}
                              onChange={() => handleSelectFine(fine.id)}
                              disabled={fine.balance === 0}
                              className="rounded border-input h-4 w-4"
                            />
                          </TableCell>
                          <TableCell>
                            {new Date(fine.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="font-medium">
                            {fine.fine_type}
                          </TableCell>
                          <TableCell>₱{fine.amount.toFixed(2)}</TableCell>
                          <TableCell className="font-medium text-warning">
                            {selectedFines.includes(fine.id) ? (
                              <div className="flex items-center gap-2">
                                <span className="text-lg font-bold">₱</span>
                                <Input
                                  type="number"
                                  min={1}
                                  max={fine.balance}
                                  value={paymentAmounts[fine.id] === 0 ? '' : paymentAmounts[fine.id] || ''}
                                  onChange={(e) => handleAmountChange(fine.id, e.target.value, fine.balance)}
                                  className="w-32 h-10 px-3 py-2 text-lg font-bold border-2 border-primary/50 focus:border-primary shadow-sm"
                                />
                                <span className="text-sm text-muted-foreground ml-1 font-medium">/ ₱{fine.balance.toFixed(2)}</span>
                              </div>
                            ) : (
                              `₱${fine.balance.toFixed(2)}`
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile View Cards */}
                <div className="md:hidden space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-border">
                    <span className="text-sm font-medium text-muted-foreground">Select Fines to Pay</span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={handleSelectAll}
                      className="text-xs h-8"
                    >
                      {selectedFines.length === toPayFines.filter(f => f.balance > 0).length ? "Deselect All" : "Select All"}
                    </Button>
                  </div>
                  {toPayFines.map((fine) => (
                    <div 
                      key={fine.id}
                      onClick={() => handleSelectFine(fine.id)}
                      className={`p-4 rounded-xl border-2 transition-all relative ${
                        selectedFines.includes(fine.id)
                          ? "border-primary bg-primary/5 shadow-sm bg-card"
                          : "border-border hover:border-primary/20 bg-card"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={selectedFines.includes(fine.id)}
                          onChange={() => {}} // Handled by parent div click
                          className="rounded border-input h-5 w-5 mt-1 pointer-events-none"
                        />
                        <div className="flex-1">
                          <div className="flex justify-between items-start mb-1">
                            <span className="font-bold text-foreground">{fine.fine_type}</span>
                            <Badge variant="outline" className="text-[10px] py-0">{new Date(fine.created_at).toLocaleDateString()}</Badge>
                          </div>
                          <div className="flex justify-between items-end mt-4">
                            <div>
                              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Amount</p>
                              <p className="text-sm font-medium">₱{fine.amount.toFixed(2)}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] text-warning uppercase font-bold tracking-wider">
                                {selectedFines.includes(fine.id) ? "Paying" : "Balance Due"}
                              </p>
                              {selectedFines.includes(fine.id) ? (
                                <div className="flex items-center justify-end gap-2 mt-2">
                                  <span className="text-base font-bold">₱</span>
                                  <Input
                                    type="number"
                                    min={1}
                                    max={fine.balance}
                                    value={paymentAmounts[fine.id] === 0 ? '' : paymentAmounts[fine.id] || ''}
                                    onChange={(e) => handleAmountChange(fine.id, e.target.value, fine.balance)}
                                    onClick={(e) => e.stopPropagation()} // Prevent toggling selection
                                    className="w-24 h-9 px-2 py-1 text-base font-bold border-2 border-primary/50"
                                  />
                                </div>
                              ) : (
                                <p className="text-lg font-black text-warning">₱{fine.balance.toFixed(2)}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Payment Summary & Actions */}
                {selectedFines.length > 0 && (
                  <div className="mt-6 p-5 bg-primary/5 rounded-2xl border-2 border-primary/20 shadow-lg shadow-primary/5 animate-in slide-in-from-bottom-4 duration-300 sticky bottom-4 z-20 md:relative">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                      <div className="text-center sm:text-left w-full sm:w-auto">
                        <p className="text-xs text-muted-foreground uppercase font-bold tracking-widest mb-1">
                          Grand Total Selected
                        </p>
                        <p className="text-4xl font-black text-foreground">
                          ₱{selectedAmount.toLocaleString()}
                        </p>
                        <p className="text-[10px] text-primary font-medium mt-1">
                          For {selectedFines.length} violation{selectedFines.length > 1 ? "s" : ""}
                        </p>
                      </div>
                      <Button
                        onClick={() => selectedAmount === 0 ? handlePayment() : setShowPaymentForm(true)}
                        className="w-full sm:w-auto bg-success hover:bg-success/90 h-14 px-10 text-lg font-black rounded-xl shadow-xl shadow-success/20 transition-transform active:scale-95 group"
                      >
                        <CreditCard className="mr-3 h-6 w-6 group-hover:rotate-12 transition-transform" />
                        {selectedAmount === 0 ? "Complete Payment" : "Pay Fines Now"}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Payment Form Modal */}
            {showPaymentForm && (
              <div className="fixed inset-0 z-[100] bg-black/60 animate-in fade-in duration-200">
                <div className="flex min-h-full items-center justify-center p-2 sm:p-4">
                  <Card className="w-full max-w-sm sm:max-w-lg card-elevated border-primary shadow-2xl animate-in zoom-in-95 duration-200 bg-card">
                    <CardHeader className="bg-primary/5 border-b border-primary/10 relative px-3 py-4 sm:px-6">
                      <CardTitle className="font-display text-base sm:text-lg sm:text-xl pr-8 text-foreground">Payment Details</CardTitle>
                      <button 
                        onClick={() => setShowPaymentForm(false)}
                        className="absolute right-3 sm:right-4 top-3 sm:top-4 p-1 rounded-full hover:bg-black/5 transition-colors text-muted-foreground"
                      >
                        <X className="h-4 w-4 sm:h-5 sm:w-5" />
                      </button>
                    </CardHeader>
                    <div className="flex flex-col max-h-[70vh]">
                      <div className="flex-1 overflow-y-auto">
                        <CardContent className="p-3 sm:p-4 sm:p-6">
                          <div className="space-y-4 sm:space-y-6">
                            <div className="p-3 sm:p-4 bg-info/5 rounded-lg border border-info/20">
                              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-4">
                                <div className="text-center sm:text-left">
                                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                                    Total Amount to Pay
                                  </p>
                                  <div className="flex items-baseline gap-2">
                                    <p className="text-xl sm:text-2xl sm:text-3xl font-bold text-foreground">
                                      ₱{selectedAmount.toLocaleString()}
                                    </p>
                                    {appliedVoucher && (
                                      <span className="text-sm text-muted-foreground line-through">
                                        ₱{subtotalAmount.toLocaleString()}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="h-10 w-10 sm:h-12 sm:w-12 bg-info/10 rounded-full flex items-center justify-center text-info shrink-0">
                                  <CreditCard className="h-5 w-5 sm:h-6 sm:w-6" />
                                </div>
                              </div>

                              {/* Voucher Section */}
                              <div className="pt-3 border-t border-info/10">
                                <Label className="text-xs font-bold mb-2 flex items-center gap-2">
                                  <Ticket className="h-3 w-3 text-primary" />
                                  Apply Voucher
                                </Label>
                                {appliedVoucher ? (
                                  <div className="flex items-center justify-between bg-background p-2 rounded border border-success/30">
                                    <div className="flex items-center gap-2">
                                      <Ticket className="h-4 w-4 text-success" />
                                      <div>
                                        <p className="text-xs font-bold text-success">{appliedVoucher.code} ({appliedVoucher.amount}% off)</p>
                                        <p className="text-[10px] text-muted-foreground">{appliedVoucher.description}</p>
                                      </div>
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={handleRemoveVoucher}
                                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="flex gap-2 w-full">
                                    <Input
                                      value={voucherCode}
                                      onChange={(e) => setVoucherCode(e.target.value)}
                                      placeholder="Enter voucher code"
                                      className="h-8 text-xs flex-1"
                                    />
                                    <Button
                                      onClick={handleApplyVoucher}
                                      disabled={!voucherCode}
                                      size="sm"
                                      className="h-8 text-xs"
                                    >
                                      Apply
                                    </Button>
                                  </div>
                                )}
                                {appliedVoucher && (
                                  <p className="text-xs text-success mt-2 font-medium text-right">
                                    -{appliedVoucher.amount}% ({voucherDiscount.toLocaleString()} off) Applied
                                  </p>
                                )}
                              </div>
                            </div>

                            {selectedAmount > 0 ? (
                              <>
                                <div>
                                  <label className="text-sm font-medium mb-3 block">
                                    Choose Payment Method
                                  </label>
                                  <div className="space-y-3 sm:space-y-4">
                                    <button
                                      onClick={() => setPaymentMethod("Online")}
                                      className={`w-full p-3 sm:p-4 rounded-xl border-2 transition-all text-left flex flex-col gap-1 ${
                                        paymentMethod === "Online"
                                          ? "border-primary bg-primary/5 shadow-sm"
                                          : "border-border hover:border-primary/20"
                                      }`}
                                    >
                                      <div className="flex items-center gap-2">
                                        <CreditCard className="h-4 w-4 text-primary" />
                                        <p className="font-bold text-foreground text-sm sm:text-base">E-Wallet & Cards</p>
                                      </div>
                                      <p className="text-xs text-muted-foreground leading-relaxed pl-6">
                                        GCash, PayMaya, Credit/Debit Cards
                                      </p>
                                    </button>

                                    <button
                                      onClick={() => { setPaymentMethod("CSC-Slip"); setIsCscModalOpen(true); }}
                                      className={`w-full p-3 sm:p-4 rounded-xl border-2 transition-all text-left flex flex-col gap-1 ${
                                        paymentMethod === "CSC-Slip"
                                          ? "border-primary bg-primary/5 shadow-sm"
                                          : "border-border hover:border-primary/20"
                                      }`}
                                    >
                                      <div className="flex items-center gap-2">
                                        <Upload className="h-4 w-4 text-primary" />
                                        <p className="font-bold text-foreground text-sm sm:text-base">Upload CSC Slip</p>
                                      </div>
                                      <p className="text-xs text-muted-foreground leading-relaxed pl-6">
                                        Submit photo of payment slip issued by CSC
                                      </p>
                                    </button>

                                    <button
                                      onClick={() => setPaymentMethod("Over-the-Counter")}
                                      className={`w-full p-3 sm:p-4 rounded-xl border-2 transition-all text-left flex flex-col gap-1 ${
                                        paymentMethod === "Over-the-Counter"
                                          ? "border-primary bg-primary/5 shadow-sm"
                                          : "border-border hover:border-primary/20"
                                      }`}
                                    >
                                      <div className="flex items-center gap-2">
                                        <UserIcon className="h-4 w-4 text-primary" />
                                        <p className="font-bold text-foreground text-sm sm:text-base">Over-the-Counter</p>
                                      </div>
                                      <p className="text-xs text-muted-foreground leading-relaxed pl-6">
                                        Pay directly at CSC Office
                                      </p>
                                    </button>
                                  </div>
                                </div>

                                {/* CSC-Slip inline upload removed — modal opens when CSC is selected */}

                                {paymentMethod === "Online" && (
                                  <div className="p-3 sm:p-4 bg-muted/50 rounded-lg border border-border/50">
                                    <div className="text-sm font-bold mb-2 flex items-center gap-2">
                                      <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                                      E-Wallet & Card Payment
                                    </div>
                                    <ul className="text-xs sm:text-sm text-muted-foreground space-y-1 sm:space-y-2">
                                      <li className="flex items-start gap-2">
                                        <span className="font-bold text-primary">•</span>
                                        <span>GCash and PayMaya QR code payments</span>
                                      </li>
                                      <li className="flex items-start gap-2">
                                        <span className="font-bold text-primary">•</span>
                                        <span>Credit/Debit card processing</span>
                                      </li>
                                      <li className="flex items-start gap-2">
                                        <span className="font-bold text-primary">•</span>
                                        <span>Instant payment confirmation</span>
                                      </li>
                                    </ul>
                                  </div>
                                )}

                                {paymentMethod === "Over-the-Counter" && (
                                  <div className="p-3 sm:p-4 bg-muted/50 rounded-lg border border-border/50">
                                    <div className="text-sm font-bold mb-2 flex items-center gap-2">
                                      <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                                      Counter Payment Instructions
                                    </div>
                                    <ul className="text-xs sm:text-sm text-muted-foreground space-y-1 sm:space-y-2">
                                      <li className="flex items-start gap-2">
                                        <span className="font-bold text-primary">1.</span>
                                        <span>Visit the CSC office during office hours</span>
                                      </li>
                                      <li className="flex items-start gap-2">
                                        <span className="font-bold text-primary">2.</span>
                                        <span>Bring your student ID</span>
                                      </li>
                                      <li className="flex items-start gap-2">
                                        <span className="font-bold text-primary">3.</span>
                                        <span>Pay the exact amount: ₱{selectedAmount.toLocaleString()}</span>
                                      </li>
                                    </ul>
                                  </div>
                                )}
                              </>
                            ) : (
                              <div className="p-4 sm:p-6 bg-success/10 rounded-xl border-2 border-success/30 text-center">
                                <CheckCircle className="h-8 w-8 text-success mx-auto mb-3" />
                                <p className="text-sm font-bold text-success mb-1">
                                  Fully Covered by Voucher
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Your voucher covers the entire payment amount. No additional payment method needed.
                                </p>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </div>
                      <div className="p-3 sm:p-4 sm:p-6 pt-0 border-t border-border">
                        <div className="flex flex-col gap-2 sm:gap-3">
                          <Button
                            onClick={selectedAmount === 0 ? handlePayment : paymentMethod === "Online" ? () => setShowPaymentGateway(true) : handlePayment}
                            disabled={isSubmitting}
                            className="w-full bg-success hover:bg-success/90 h-11 sm:h-12 text-sm sm:text-base font-bold"
                          >
                            {isSubmitting ? (
                              <>
                                <Loader className="mr-2 h-4 w-4 animate-spin" />
                                Processing...
                              </>
                            ) : selectedAmount === 0 ? (
                              "Complete Payment with Voucher"
                            ) : paymentMethod === "Online" ? (
                              "Continue to Payment Gateway"
                            ) : paymentMethod === "CSC-Slip" ? (
                              "Submit Payment Slip"
                            ) : (
                              "Confirm Payment"
                            )}
                          </Button>
                          <Button
                            onClick={() => setShowPaymentForm(false)}
                            disabled={isSubmitting}
                            variant="outline"
                            className="w-full h-11 sm:h-12 text-sm sm:text-base"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>
              </div>
            )}

            {/* Payment Gateway Modal */}
            {showPaymentGateway && (
              <div className="fixed inset-0 z-[100] bg-black/60 animate-in fade-in duration-200">
                <div className="flex min-h-full items-center justify-center p-2 sm:p-4">
                  <Card className="w-full max-w-md sm:max-w-2xl card-elevated border-primary shadow-2xl animate-in zoom-in-95 duration-200 bg-card">
                    <CardHeader className="bg-primary/5 border-b border-primary/10 relative px-3 py-4 sm:px-6">
                      <CardTitle className="font-display text-base sm:text-lg sm:text-xl pr-8 text-foreground">Payment Gateway</CardTitle>
                      <button 
                        onClick={() => setShowPaymentGateway(false)}
                        className="absolute right-3 sm:right-4 top-3 sm:top-4 p-1 rounded-full hover:bg-black/5 transition-colors text-muted-foreground"
                      >
                        <X className="h-4 w-4 sm:h-5 sm:w-5" />
                      </button>
                    </CardHeader>
                    <div className="flex flex-col max-h-[80vh]">
                      <div className="flex-1 overflow-y-auto">
                        <CardContent className="p-3 sm:p-4 sm:p-6">
                          <PaymentGateway
                            amount={selectedAmount}
                            fineIds={selectedFines}
                            onSuccess={handlePaymentGatewaySuccess}
                            onCancel={() => setShowPaymentGateway(false)}
                          />
                        </CardContent>
                      </div>
                    </div>
                  </Card>
                </div>
              </div>
            )}
          </>
        ) : (
          <Card className="card-elevated mb-8 bg-card text-card-foreground">
            <CardContent className="pt-12 pb-12 text-center px-4">
              <CheckCircle className="h-16 w-16 text-success/50 mx-auto mb-4" />
              <p className="text-lg font-medium text-foreground">No Outstanding Fines!</p>
              <p className="text-muted-foreground mt-1 max-w-xs mx-auto">
                All your violations have been settled or submitted for approval.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Pending Approval Section */}
        {pendingApprovalFines.length > 0 && (
          <Card className="card-elevated border-info/20 overflow-hidden bg-card text-card-foreground">
            <CardHeader className="bg-info/5 border-b border-info/10">
              <CardTitle className="font-display flex items-center gap-2 text-info">
                <Clock className="h-5 w-5" />
                Pending for Approval
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 sm:p-6">
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="table-header">
                      <TableHead>Date Paid</TableHead>
                      <TableHead>Type of Violation</TableHead>
                      <TableHead>Amount Paid</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingApprovalFines.map((fine) => (
                      <TableRow key={fine.id}>
                        <TableCell>{new Date(fine.updated_at || fine.created_at).toLocaleDateString()}</TableCell>
                        <TableCell className="font-medium">{fine.fine_type}</TableCell>
                        <TableCell>₱{fine.amount.toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge className="bg-warning text-white animate-pulse">Awaiting Verification</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile View for Pending Approval */}
              <div className="md:hidden space-y-0 divide-y divide-border/50">
                {pendingApprovalFines.map((fine) => (
                  <div key={fine.id} className="p-4 bg-info/5">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-bold text-sm">{fine.fine_type}</span>
                      <span className="text-[10px] text-muted-foreground">{new Date(fine.updated_at || fine.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-bold text-info">₱{fine.amount.toFixed(2)}</span>
                      <Badge className="bg-warning text-white text-[10px]">Awaiting Admin</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
        {/* CSC Upload Modal (opens when CSC-Slip selected) */}
        <Dialog open={isCscModalOpen} onOpenChange={setIsCscModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload CSC Slip</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 max-h-[70vh] overflow-y-auto">
              <input
                ref={fileInputRef}
                className="hidden"
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={handleFileChange}
              />

              {previewUrls.length === 0 ? (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center justify-center h-40 rounded-lg border-2 border-dashed border-border cursor-pointer hover:border-primary/50 bg-background"
                  >
                    <Plus className="h-8 w-8 text-muted-foreground" />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {previewUrls.map((url, index) => (
                    <div key={index} className="relative rounded-lg overflow-hidden border border-border">
                      <img src={url} alt={`Proof ${index + 1}`} className="w-full h-32 object-cover bg-black/5" />
                      <button onClick={() => removeImage(index)} className="absolute top-1 right-1 p-1 bg-destructive text-white rounded-full hover:bg-destructive/90 shadow-sm">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center justify-center rounded-lg border-2 border-dashed border-border p-2 cursor-pointer hover:border-primary/50"
                  >
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsCscModalOpen(false)}>Close</Button>
                <Button onClick={() => setIsCscModalOpen(false)}>Done</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Voucher Confirmation Dialog */}
        <Dialog open={showVoucherConfirmDialog} onOpenChange={setShowVoucherConfirmDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-warning" />
                Voucher Amount Exceeds Payment
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-4 bg-warning/10 rounded-lg border border-warning/20">
                <p className="text-sm text-foreground">
                  Your voucher discount (<span className="font-bold">{pendingVoucher?.amount}%</span>) will be applied to the total payment amount (<span className="font-bold">₱{subtotalAmount.toFixed(2)}</span>).
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  This voucher can only be used once. Any excess amount will not be refunded or carried over.
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleCancelVoucher}>
                  Cancel
                </Button>
                <Button onClick={handleConfirmVoucher} className="bg-warning hover:bg-warning/90">
                  Use Voucher Anyway
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </AppLayout>
  );
}
