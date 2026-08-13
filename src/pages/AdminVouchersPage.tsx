import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Ticket, Trash2, Save, Loader, AlertCircle, Pencil, Calendar, History } from "lucide-react";
import { useAppSettings } from "@/hooks/useAppSettings";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { getDepartments } from "@/integrations/supabase/queries";
import { DEFAULT_DEPARTMENTS } from "@/lib/constants";
import { Checkbox } from "@/components/ui/checkbox";

interface Voucher {
  id: string;
  code: string;
  amount: number;
  description: string;
  isActive: boolean;
  createdAt: string;
  expirationDate?: string; // ISO date string
  departments?: string[]; // Array of department names, or ['ALL']
  usedBy?: { studentId: string; usedAt: string }[]; // Array of usage records
  usageLimit?: number; // Maximum number of times this voucher can be used globally
}

export default function AdminVouchersPage() {
  const { settings, loading: settingsLoading, upsertSetting } = useAppSettings();
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState<Voucher | null>(null);
  const [dbDepartments, setDbDepartments] = useState<string[]>([]);
  
  // Form state
  const [code, setCode] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [usageLimit, setUsageLimit] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>(["ALL"]);

  useEffect(() => {
    const loadDepartments = async () => {
      try {
        const depts = await getDepartments();
        if (depts && depts.length > 0) {
          const deptNames = depts.map((d: any) => d.name).filter(Boolean).sort();
          setDbDepartments(deptNames);
        } else {
          setDbDepartments(DEFAULT_DEPARTMENTS);
        }
      } catch (error) {
        console.error("Error loading departments:", error);
        setDbDepartments(DEFAULT_DEPARTMENTS);
      }
    };
    loadDepartments();
  }, []);

  // Load vouchers from settings when available
  useEffect(() => {
    if (settings.voucher_codes) {
      try {
        const parsed = JSON.parse(settings.voucher_codes);
        if (Array.isArray(parsed)) {
          // Migrate old vouchers to new format if needed
          const migrated = parsed.map(v => ({
            ...v,
            departments: v.departments || ["ALL"],
            usedBy: Array.isArray(v.usedBy) && typeof v.usedBy[0] === 'string' 
              ? v.usedBy.map((id: string) => ({ studentId: id, usedAt: new Date().toISOString() }))
              : (v.usedBy || [])
          }));
          setVouchers(migrated);
        }
      } catch (e) {
        console.error("Failed to parse vouchers:", e);
      }
    }
  }, [settings.voucher_codes]);

  const resetForm = () => {
    setCode("");
    setAmount("");
    setDescription("");
    setUsageLimit("");
    setExpirationDate("");
    setSelectedDepartments(["ALL"]);
    setEditingVoucher(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (voucher: Voucher) => {
    setEditingVoucher(voucher);
    setCode(voucher.code);
    setAmount(voucher.amount.toString());
    setDescription(voucher.description);
    setUsageLimit(voucher.usageLimit ? voucher.usageLimit.toString() : "");
    setExpirationDate(voucher.expirationDate ? voucher.expirationDate.split('T')[0] : "");
    setSelectedDepartments(voucher.departments || ["ALL"]);
    setIsDialogOpen(true);
  };

  const handleDepartmentToggle = (dept: string) => {
    if (dept === "ALL") {
      setSelectedDepartments(["ALL"]);
      return;
    }
    
    let newSelection = selectedDepartments.filter(d => d !== "ALL");
    if (newSelection.includes(dept)) {
      newSelection = newSelection.filter(d => d !== dept);
    } else {
      newSelection.push(dept);
    }
    
    if (newSelection.length === 0) {
      setSelectedDepartments(["ALL"]);
    } else {
      setSelectedDepartments(newSelection);
    }
  };

  const handleSaveVoucher = () => {
    if (!code || !amount || !description) {
      toast.error("Please fill in all required fields");
      return;
    }

    const voucherCode = code.toUpperCase().trim();
    const voucherAmount = parseFloat(amount);
    const limit = usageLimit ? parseInt(usageLimit) : undefined;

    if (isNaN(voucherAmount) || voucherAmount < 1 || voucherAmount > 100) {
      toast.error("Please enter a valid percentage between 1 and 100");
      return;
    }

    if (limit !== undefined && (isNaN(limit) || limit <= 0)) {
      toast.error("Please enter a valid usage limit");
      return;
    }

    // Check for duplicate code (exclude current voucher if editing)
    if (vouchers.some(v => v.code === voucherCode && v.id !== editingVoucher?.id)) {
      toast.error("Voucher code already exists");
      return;
    }

    let updatedVouchers: Voucher[];

    const voucherData = {
      code: voucherCode,
      amount: voucherAmount,
      description,
      usageLimit: limit,
      expirationDate: expirationDate ? new Date(expirationDate).toISOString() : undefined,
      departments: selectedDepartments
    };

    if (editingVoucher) {
      // Update existing
      updatedVouchers = vouchers.map(v => 
        v.id === editingVoucher.id 
          ? { ...v, ...voucherData } 
          : v
      );
      toast.success("Voucher updated successfully");
    } else {
      // Create new
      const newVoucher: Voucher = {
        id: crypto.randomUUID(),
        ...voucherData,
        isActive: true,
        createdAt: new Date().toISOString(),
        usedBy: []
      };
      updatedVouchers = [newVoucher, ...vouchers];
      toast.success("Voucher created successfully");
    }

    setVouchers(updatedVouchers);
    saveVouchersToSettings(updatedVouchers);
    
    setIsDialogOpen(false);
    resetForm();
  };

  const handleToggleStatus = (id: string) => {
    const updatedVouchers = vouchers.map(v => 
      v.id === id ? { ...v, isActive: !v.isActive } : v
    );
    setVouchers(updatedVouchers);
    saveVouchersToSettings(updatedVouchers);
  };

  const handleDeleteVoucher = (id: string) => {
    const updatedVouchers = vouchers.filter(v => v.id !== id);
    setVouchers(updatedVouchers);
    saveVouchersToSettings(updatedVouchers);
    toast.success("Voucher deleted");
  };

  const saveVouchersToSettings = async (updatedVouchers: Voucher[]) => {
    setIsSaving(true);
    try {
      await upsertSetting("voucher_codes", JSON.stringify(updatedVouchers));
    } catch (error) {
      console.error("Error saving vouchers:", error);
      toast.error("Failed to save changes");
    } finally {
      setIsSaving(false);
    }
  };

  const getVoucherStatus = (voucher: Voucher) => {
    if (!voucher.isActive) return { label: "Inactive", variant: "secondary" as const };
    
    if (voucher.expirationDate && new Date(voucher.expirationDate) < new Date()) {
      return { label: "Expired", variant: "destructive" as const };
    }
    
    if (voucher.usageLimit && (voucher.usedBy?.length || 0) >= voucher.usageLimit) {
      return { label: "Fully Used", variant: "warning" as const };
    }
    
    return { label: "Active", variant: "default" as const };
  };

  if (settingsLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="content-wrapper pt-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">
              Voucher Management
            </h1>
            <p className="text-muted-foreground mt-1">
              Create and manage discount vouchers for students
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
            <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2 w-full sm:w-auto">
                  <History className="h-4 w-4" />
                  Voucher History
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Voucher Usage History</DialogTitle>
                  <DialogDescription>
                    Track all used vouchers, including date used and expiration details.
                  </DialogDescription>
                </DialogHeader>
                <div className="mt-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">#</TableHead>
                        <TableHead>Code</TableHead>
                        <TableHead>Student ID</TableHead>
                        <TableHead>Date Used</TableHead>
                        <TableHead>Expiration</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vouchers.flatMap(v => 
                        (v.usedBy || []).map(usage => ({
                          code: v.code,
                          studentId: usage.studentId,
                          usedAt: usage.usedAt,
                          expirationDate: v.expirationDate
                        }))
                      ).sort((a, b) => new Date(b.usedAt).getTime() - new Date(a.usedAt).getTime())
                      .map((record, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell className="font-mono font-bold">{record.code}</TableCell>
                          <TableCell>{record.studentId}</TableCell>
                          <TableCell>{new Date(record.usedAt).toLocaleString()}</TableCell>
                          <TableCell>{record.expirationDate ? new Date(record.expirationDate).toLocaleDateString() : "Never"}</TableCell>
                        </TableRow>
                      ))}
                      {vouchers.every(v => !v.usedBy || v.usedBy.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            No vouchers have been used yet.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button className="gap-2 w-full sm:w-auto" onClick={handleOpenCreate}>
                  <Plus className="h-4 w-4" />
                  Generate New Voucher
                </Button>
              </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingVoucher ? "Edit Voucher" : "Create New Voucher"}</DialogTitle>
                <DialogDescription>
                  {editingVoucher ? "Update the voucher details below." : "Fill in the details to create a new discount voucher."}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Voucher Code</Label>
                  <Input
                    placeholder="e.g. EARLYBIRD50"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                  />
                  <p className="text-xs text-muted-foreground">Code will be automatically uppercased</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Discount Percentage (%)</Label>
                    <Input
                      type="number"
                      placeholder="e.g., 50"
                      min="1"
                      max="100"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Enter a percentage between 1-100</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Usage Limit (Optional)</Label>
                    <Input 
                      type="number" 
                      placeholder="No limit" 
                      value={usageLimit}
                      onChange={(e) => setUsageLimit(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Max total uses</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Expiration Date (Optional)</Label>
                  <Input 
                    type="date" 
                    value={expirationDate}
                    onChange={(e) => setExpirationDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Allowed Departments</Label>
                  <div className="border rounded-md p-3 space-y-2 max-h-40 overflow-y-auto">
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="dept-all" 
                        checked={selectedDepartments.includes("ALL")}
                        onCheckedChange={() => handleDepartmentToggle("ALL")}
                      />
                      <label htmlFor="dept-all" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                        Select All Departments
                      </label>
                    </div>
                    {dbDepartments.map(dept => (
                      <div key={dept} className="flex items-center space-x-2 ml-4">
                        <Checkbox 
                          id={`dept-${dept}`} 
                          checked={selectedDepartments.includes("ALL") || selectedDepartments.includes(dept)}
                          disabled={selectedDepartments.includes("ALL")}
                          onCheckedChange={() => handleDepartmentToggle(dept)}
                        />
                        <label htmlFor={`dept-${dept}`} className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                          {dept}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea 
                    placeholder="What is this voucher for?" 
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSaveVoucher} disabled={isSaving}>
                  {isSaving ? <Loader className="h-4 w-4 animate-spin" /> : (editingVoucher ? "Save Changes" : "Create Voucher")}
                </Button>
              </DialogFooter>
            </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid gap-6">
          {/* Active Vouchers Card */}
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ticket className="h-5 w-5 text-primary" />
                Active Vouchers
              </CardTitle>
              <CardDescription>
                Manage existing vouchers availability
              </CardDescription>
            </CardHeader>
            <CardContent>
              {vouchers.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-lg">
                  <Ticket className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                  <h3 className="text-lg font-medium text-muted-foreground">No vouchers created yet</h3>
                  <p className="text-sm text-muted-foreground/80 mt-1">
                    Click "Generate New Voucher" to create your first one.
                  </p>
                </div>
              ) : (
                <>
                  {/* Desktop view */}
                  <div className="hidden md:block rounded-md border overflow-x-auto">
                    <Table className="min-w-[800px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[50px]">#</TableHead>
                          <TableHead>Code</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Discount</TableHead>
                          <TableHead>Used</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Expires</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {vouchers.map((voucher, index) => {
                          const status = getVoucherStatus(voucher);
                          return (
                          <TableRow key={voucher.id}>
                            <TableCell className="font-medium text-muted-foreground">{index + 1}</TableCell>
                            <TableCell className="font-mono font-bold text-primary">
                              {voucher.code}
                            </TableCell>
                            <TableCell>
                              <div className="max-w-[200px] truncate" title={voucher.description}>
                                {voucher.description}
                              </div>
                              {voucher.departments && !voucher.departments.includes("ALL") && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  Depts: {voucher.departments.join(", ")}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="font-bold">
                              {voucher.amount}%
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {voucher.usedBy?.length || 0} {voucher.usageLimit ? `/ ${voucher.usageLimit}` : ""} students
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Switch 
                                  checked={voucher.isActive} 
                                  onCheckedChange={() => handleToggleStatus(voucher.id)}
                                />
                                <Badge variant={status.variant}>
                                  {status.label}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {voucher.expirationDate ? new Date(voucher.expirationDate).toLocaleDateString() : "Never"}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  className="text-muted-foreground hover:text-primary hover:bg-primary/10"
                                  onClick={() => handleOpenEdit(voucher)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => handleDeleteVoucher(voucher.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Mobile view */}
                  <div className="md:hidden space-y-4">
                    {vouchers.map((voucher) => {
                      const status = getVoucherStatus(voucher);
                      return (
                      <Card key={voucher.id} className="border shadow-sm">
                        <CardContent className="pt-6">
                          <div className="space-y-4">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="font-mono font-bold text-primary text-lg">{voucher.code}</p>
                                <p className="text-sm text-muted-foreground mt-1">{voucher.description}</p>
                                {voucher.departments && !voucher.departments.includes("ALL") && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Depts: {voucher.departments.join(", ")}
                                  </p>
                                )}
                              </div>
                              <div className="flex flex-col items-end gap-2">
                                <Badge variant={status.variant}>
                                  {status.label}
                                </Badge>
                                <Switch 
                                  checked={voucher.isActive} 
                                  onCheckedChange={() => handleToggleStatus(voucher.id)}
                                />
                              </div>
                            </div>
                            
                            <div className="flex justify-between text-sm pt-3 border-t">
                              <div>
                                <p className="text-muted-foreground mb-1">Discount</p>
                                <p className="font-bold text-base">{voucher.amount}%</p>
                              </div>
                              <div className="text-right">
                                <p className="text-muted-foreground mb-1">Used By</p>
                                <Badge variant="outline">
                                  {voucher.usedBy?.length || 0} {voucher.usageLimit ? `/ ${voucher.usageLimit}` : ""} students
                                </Badge>
                              </div>
                            </div>

                            <div className="flex justify-between items-center pt-3 border-t">
                              <p className="text-xs text-muted-foreground">
                                Expires: {voucher.expirationDate ? new Date(voucher.expirationDate).toLocaleDateString() : "Never"}
                              </p>
                              <div className="flex gap-2">
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  className="text-muted-foreground hover:text-primary"
                                  onClick={() => handleOpenEdit(voucher)}
                                >
                                  <Pencil className="h-4 w-4 mr-1" /> Edit
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => handleDeleteVoucher(voucher.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )})}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
