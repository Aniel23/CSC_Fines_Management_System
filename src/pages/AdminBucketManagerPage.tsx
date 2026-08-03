import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { getFines } from "@/integrations/supabase/queries";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Database,
  Filter,
  Image as ImageIcon,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  Trash2,
} from "lucide-react";

type StorageBucket =
  | "payment-proofs"
  | "fine-images"
  | "user-assets"
  | "officer-photos";

type ViewMode = "active" | "bin";
type ReferenceFilter = "all" | "referenced" | "unreferenced";
type FileTypeFilter = "all" | "images" | "other";
type ActionType = "bin" | "restore" | "delete";

interface StorageFile {
  key: string;
  bucket: StorageBucket;
  name: string;
  path: string;
  parentFolder: string;
  updated_at?: string;
  created_at?: string;
  size: number;
  referenced: boolean;
  referenceSources: string[];
  isImage: boolean;
  isDeleted: boolean;
  previewUrl: string;
  deletedAt?: string;
  originalPath?: string;
}

interface BinRecord {
  bucket: StorageBucket;
  binPath: string;
  originalPath: string;
  deletedAt: string;
  size?: number;
}

interface PendingAction {
  type: ActionType;
  files: StorageFile[];
}

const BUCKETS: Array<{ value: StorageBucket; label: string }> = [
  { value: "payment-proofs", label: "Payment Proofs" },
  { value: "fine-images", label: "Fine Images" },
  { value: "user-assets", label: "User Assets" },
  { value: "officer-photos", label: "Officer Photos" },
];

const BIN_FOLDER = "__bin__";
const BIN_PREFIX = `${BIN_FOLDER}/`;
const LOCAL_BIN_KEY = "bucket-manager-bin-records-v1";

function makeFileKey(bucket: StorageBucket, path: string) {
  return `${bucket}:${path}`;
}

function isImageFile(path: string) {
  return /\.(png|jpe?g|gif|webp|bmp|svg|avif)$/i.test(path);
}

function formatBytes(size?: number) {
  if (!size) return "-";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function readBinRecords(): BinRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_BIN_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveBinRecords(records: BinRecord[]) {
  localStorage.setItem(LOCAL_BIN_KEY, JSON.stringify(records));
}

function upsertBinRecord(records: BinRecord[], nextRecord: BinRecord) {
  const filtered = records.filter(
    (record) =>
      !(record.bucket === nextRecord.bucket && record.binPath === nextRecord.binPath)
  );
  filtered.push(nextRecord);
  return filtered;
}

function removeBinRecord(records: BinRecord[], bucket: StorageBucket, binPath: string) {
  return records.filter(
    (record) => !(record.bucket === bucket && record.binPath === binPath)
  );
}

function getPublicUrl(bucket: StorageBucket, path: string) {
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

function extractStorageReference(
  rawValue: string | null | undefined,
  fallbackBucket?: StorageBucket
) {
  if (!rawValue) return null;

  const trimmed = rawValue.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    const match = decodeURIComponent(parsed.pathname).match(
      /\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)$/
    );

    if (match) {
      return {
        bucket: match[1] as StorageBucket,
        path: match[2],
      };
    }
  } catch {
    // Raw storage paths are valid and handled below.
  }

  if (!fallbackBucket) return null;

  return {
    bucket: fallbackBucket,
    path: trimmed.replace(/^\/+/, ""),
  };
}

async function listBucketFiles(bucket: StorageBucket) {
  const collected: Array<{
    name: string;
    path: string;
    parentFolder: string;
    updated_at?: string;
    created_at?: string;
    size: number;
  }> = [];

  const walk = async (prefix = ""): Promise<void> => {
    let offset = 0;

    while (true) {
      const { data, error } = await supabase.storage.from(bucket).list(prefix, {
        limit: 100,
        offset,
        sortBy: { column: "name", order: "asc" },
      });

      if (error) throw error;

      const entries = data || [];
      for (const entry of entries) {
        const path = prefix ? `${prefix}/${entry.name}` : entry.name;
        const isFolder = !(entry as { id?: string | null }).id;

        if (isFolder) {
          await walk(path);
          continue;
        }

        collected.push({
          name: entry.name,
          path,
          parentFolder: prefix || "/",
          updated_at: (entry as { updated_at?: string }).updated_at,
          created_at: (entry as { created_at?: string }).created_at,
          size: (entry as { metadata?: { size?: number } }).metadata?.size || 0,
        });
      }

      if (entries.length < 100) break;
      offset += entries.length;
    }
  };

  await walk();
  return collected;
}

async function buildReferenceMap() {
  const referenceMap = new Map<string, string[]>();
  const addReference = (
    bucket: StorageBucket,
    path: string,
    source: string
  ) => {
    const key = makeFileKey(bucket, path);
    const existing = referenceMap.get(key) || [];
    if (!existing.includes(source)) {
      existing.push(source);
      referenceMap.set(key, existing);
    }
  };

  const addFromValue = (
    rawValue: string | null | undefined,
    source: string,
    fallbackBucket?: StorageBucket
  ) => {
    const ref = extractStorageReference(rawValue, fallbackBucket);
    if (ref) {
      addReference(ref.bucket, ref.path, source);
    }
  };

  const [
    fines,
    studentsResult,
    rolesResult,
    officersResult,
    settingsResult,
  ] = await Promise.all([
    getFines(),
    supabase.from("students").select("id, name, student_id, photo_url"),
    supabase.from("user_roles").select("user_id, avatar_url"),
    supabase.from("csc_officers").select("id, name, photo_url"),
    supabase.from("app_settings").select("key, value").eq("key", "payment_qr_url"),
  ]);

  if (studentsResult.error) throw studentsResult.error;
  if (rolesResult.error) throw rolesResult.error;
  if (officersResult.error) throw officersResult.error;
  if (settingsResult.error) throw settingsResult.error;

  fines.forEach((fine: any) => {
    addFromValue(
      fine.payment_proof,
      `Fine payment proof: ${fine.fine_type}`,
      "payment-proofs"
    );

    if (Array.isArray(fine.payment_proofs)) {
      fine.payment_proofs.forEach((value: string) => {
        addFromValue(
          value,
          `Fine payment proof: ${fine.fine_type}`,
          "payment-proofs"
        );
      });
    }

    addFromValue(
      fine.proof_image,
      `Fine image: ${fine.fine_type}`,
      "fine-images"
    );
  });

  (studentsResult.data || []).forEach((student: any) => {
    addFromValue(
      student.photo_url,
      `Student photo: ${student.name || student.student_id || student.id}`,
      "user-assets"
    );
  });

  (rolesResult.data || []).forEach((role: any) => {
    addFromValue(role.avatar_url, `User avatar: ${role.user_id}`, "user-assets");
  });

  (officersResult.data || []).forEach((officer: any) => {
    addFromValue(
      officer.photo_url,
      `Officer photo: ${officer.name || officer.id}`,
      "officer-photos"
    );
  });

  (settingsResult.data || []).forEach((setting: any) => {
    addFromValue(setting.value, "Admin payment QR", "user-assets");
  });

  return referenceMap;
}

export default function AdminBucketManagerPage() {
  const { user } = useAuth();
  const [files, setFiles] = useState<StorageFile[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [selectedBucket, setSelectedBucket] =
    useState<StorageBucket>("payment-proofs");
  const [viewMode, setViewMode] = useState<ViewMode>("active");
  const [searchTerm, setSearchTerm] = useState("");
  const [referenceFilter, setReferenceFilter] =
    useState<ReferenceFilter>("all");
  const [fileTypeFilter, setFileTypeFilter] = useState<FileTypeFilter>("all");
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [confirmationText, setConfirmationText] = useState("");

  useEffect(() => {
    if (!user || user.role !== "admin") return;
    fetchFilesAndRefs();
  }, [user]);

  async function fetchFilesAndRefs() {
    try {
      setLoading(true);
      const referenceMap = await buildReferenceMap();
      const localBinRecords = readBinRecords();

      const allBuckets = await Promise.all(
        BUCKETS.map(async ({ value }) => {
          const bucketFiles = await listBucketFiles(value);

          return bucketFiles.map((file) => {
            const isDeleted = file.path.startsWith(BIN_PREFIX);
            const binRecord = localBinRecords.find(
              (record) =>
                record.bucket === value && record.binPath === file.path
            );
            const originalPath = binRecord?.originalPath;
            const referencePath = originalPath || file.path;
            const key = makeFileKey(value, file.path);
            const referenceKey = makeFileKey(value, referencePath);
            const referenceSources = referenceMap.get(referenceKey) || [];

            return {
              key,
              bucket: value,
              name: file.name,
              path: file.path,
              parentFolder: file.parentFolder,
              updated_at: file.updated_at,
              created_at: file.created_at,
              size: file.size,
              referenced: referenceSources.length > 0,
              referenceSources,
              isImage: isImageFile(originalPath || file.path),
              isDeleted,
              previewUrl: getPublicUrl(value, file.path),
              deletedAt: binRecord?.deletedAt,
              originalPath,
            } satisfies StorageFile;
          });
        })
      );

      setFiles(allBuckets.flat());
      setSelected({});
    } catch (err) {
      console.error("Error fetching storage files:", err);
      toast.error("Failed to load bucket files");
    } finally {
      setLoading(false);
    }
  }

  const bucketFiles = useMemo(
    () => files.filter((file) => file.bucket === selectedBucket),
    [files, selectedBucket]
  );

  const bucketStats = useMemo(() => {
    const activeFiles = bucketFiles.filter((file) => !file.isDeleted);
    const binFiles = bucketFiles.filter((file) => file.isDeleted);

    return {
      total: bucketFiles.length,
      active: activeFiles.length,
      bin: binFiles.length,
      referenced: activeFiles.filter((file) => file.referenced).length,
    };
  }, [bucketFiles]);

  const visibleFiles = useMemo(() => {
    return bucketFiles
      .filter((file) => (viewMode === "bin" ? file.isDeleted : !file.isDeleted))
      .filter((file) => {
        if (!searchTerm.trim()) return true;
        const haystack = [
          file.name,
          file.path,
          file.parentFolder,
          file.originalPath || "",
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(searchTerm.trim().toLowerCase());
      })
      .filter((file) => {
        if (referenceFilter === "referenced") return file.referenced;
        if (referenceFilter === "unreferenced") return !file.referenced;
        return true;
      })
      .filter((file) => {
        if (fileTypeFilter === "images") return file.isImage;
        if (fileTypeFilter === "other") return !file.isImage;
        return true;
      })
      .sort((a, b) => {
        const first = viewMode === "bin" ? a.deletedAt || a.updated_at : a.updated_at;
        const second = viewMode === "bin" ? b.deletedAt || b.updated_at : b.updated_at;
        return new Date(second || 0).getTime() - new Date(first || 0).getTime();
      });
  }, [bucketFiles, fileTypeFilter, referenceFilter, searchTerm, viewMode]);

  const selectedItems = useMemo(
    () => files.filter((file) => selected[file.key]),
    [files, selected]
  );

  const selectedVisibleItems = useMemo(
    () => visibleFiles.filter((file) => selected[file.key]),
    [selected, visibleFiles]
  );

  const allVisibleSelected =
    visibleFiles.length > 0 &&
    visibleFiles.every((file) => selected[file.key]);

  function toggleSelect(fileKey: string) {
    setSelected((prev) => ({ ...prev, [fileKey]: !prev[fileKey] }));
  }

  function toggleSelectAll(checked: boolean) {
    setSelected((prev) => {
      const next = { ...prev };
      visibleFiles.forEach((file) => {
        next[file.key] = checked;
      });
      return next;
    });
  }

  function getRequiredConfirmationText(action: PendingAction) {
    if (action.type === "restore") return "RESTORE";
    if (action.type === "bin") return `BIN ${action.files.length}`;
    return `DELETE ${action.files.length}`;
  }

  function openActionDialog(type: ActionType, actionFiles: StorageFile[]) {
    if (actionFiles.length === 0) {
      toast.error("Select at least one file first");
      return;
    }

    if (type !== "restore" && actionFiles.some((file) => file.referenced)) {
      toast.error("Referenced files cannot be deleted or moved to the bin");
      return;
    }

    setConfirmationText("");
    setPendingAction({ type, files: actionFiles });
  }

  async function handleMoveToBin(items: StorageFile[]) {
    let successCount = 0;
    let failedCount = 0;
    let binRecords = readBinRecords();

    for (const item of items) {
      try {
        const timestamp = Date.now();
        const sanitizedPath = item.path.replace(/[\\/]/g, "__");
        const binPath = `${BIN_PREFIX}${timestamp}__${sanitizedPath}`;
        const { error } = await supabase.storage
          .from(item.bucket)
          .move(item.path, binPath);

        if (error) throw error;

        binRecords = upsertBinRecord(binRecords, {
          bucket: item.bucket,
          binPath,
          originalPath: item.path,
          deletedAt: new Date().toISOString(),
          size: item.size,
        });
        successCount += 1;
      } catch (error) {
        console.error("Bin move error:", error);
        failedCount += 1;
      }
    }

    saveBinRecords(binRecords);

    if (successCount > 0) {
      toast.success(`${successCount} file(s) moved to the bin`);
    }
    if (failedCount > 0) {
      toast.error(`${failedCount} file(s) could not be moved to the bin`);
    }
  }

  async function handleRestore(items: StorageFile[]) {
    let successCount = 0;
    let failedCount = 0;
    let binRecords = readBinRecords();

    for (const item of items) {
      try {
        const restorePath = item.originalPath || item.name;
        const pathExists = files.some(
          (file) =>
            file.bucket === item.bucket &&
            !file.isDeleted &&
            file.path === restorePath
        );

        if (pathExists) {
          throw new Error("Original file path already exists");
        }

        const { error } = await supabase.storage
          .from(item.bucket)
          .move(item.path, restorePath);

        if (error) throw error;

        binRecords = removeBinRecord(binRecords, item.bucket, item.path);
        successCount += 1;
      } catch (error) {
        console.error("Restore error:", error);
        failedCount += 1;
      }
    }

    saveBinRecords(binRecords);

    if (successCount > 0) {
      toast.success(`${successCount} file(s) restored`);
    }
    if (failedCount > 0) {
      toast.error(`${failedCount} file(s) could not be restored`);
    }
  }

  async function handlePermanentDelete(items: StorageFile[]) {
    const grouped = items.reduce<Record<StorageBucket, string[]>>((acc, item) => {
      if (!acc[item.bucket]) {
        acc[item.bucket] = [];
      }
      acc[item.bucket].push(item.path);
      return acc;
    }, {} as Record<StorageBucket, string[]>);

    let successCount = 0;
    let failedCount = 0;
    let binRecords = readBinRecords();

    for (const [bucket, paths] of Object.entries(grouped) as Array<
      [StorageBucket, string[]]
    >) {
      try {
        const { error } = await supabase.storage.from(bucket).remove(paths);
        if (error) throw error;

        paths.forEach((path) => {
          binRecords = removeBinRecord(binRecords, bucket, path);
        });
        successCount += paths.length;
      } catch (error) {
        console.error("Permanent delete error:", error);
        failedCount += paths.length;
      }
    }

    saveBinRecords(binRecords);

    if (successCount > 0) {
      toast.success(`${successCount} file(s) permanently deleted`);
    }
    if (failedCount > 0) {
      toast.error(`${failedCount} file(s) could not be deleted`);
    }
  }

  async function confirmPendingAction() {
    if (!pendingAction) return;

    const requiredText = getRequiredConfirmationText(pendingAction);
    if (confirmationText.trim() !== requiredText) {
      toast.error(`Type "${requiredText}" to continue`);
      return;
    }

    try {
      setLoading(true);

      if (pendingAction.type === "bin") {
        await handleMoveToBin(pendingAction.files);
      } else if (pendingAction.type === "restore") {
        await handleRestore(pendingAction.files);
      } else {
        await handlePermanentDelete(pendingAction.files);
      }

      setPendingAction(null);
      setConfirmationText("");
      await fetchFilesAndRefs();
    } finally {
      setLoading(false);
    }
  }

  if (!user || user.role !== "admin") {
    return (
      <AppLayout>
        <div className="content-wrapper">
          <Card>
            <CardHeader>
              <CardTitle>Access Denied</CardTitle>
            </CardHeader>
            <CardContent>
              <p>You must be an admin to access this page.</p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="content-wrapper pt-0 space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">
            Bucket Manager
          </h1>
          <p className="text-muted-foreground mt-1">
            Review storage per bucket, filter files, and restore recently binned
            images before permanent deletion.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="card-elevated">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Files In Bucket</p>
              <p className="text-2xl font-bold">{bucketStats.total}</p>
            </CardContent>
          </Card>
          <Card className="card-elevated">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Active Files</p>
              <p className="text-2xl font-bold">{bucketStats.active}</p>
            </CardContent>
          </Card>
          <Card className="card-elevated">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Recently Deleted</p>
              <p className="text-2xl font-bold">{bucketStats.bin}</p>
            </CardContent>
          </Card>
          <Card className="card-elevated">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Referenced</p>
              <p className="text-2xl font-bold">{bucketStats.referenced}</p>
            </CardContent>
          </Card>
        </div>

        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Storage Browser
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
              <div>
                <p className="text-sm font-medium mb-2">Bucket</p>
                <Select
                  value={selectedBucket}
                  onValueChange={(value) =>
                    setSelectedBucket(value as StorageBucket)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BUCKETS.map((bucket) => (
                      <SelectItem key={bucket.value} value={bucket.value}>
                        {bucket.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Search</p>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="File name or path..."
                    className="pl-9"
                  />
                </div>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Reference Filter</p>
                <Select
                  value={referenceFilter}
                  onValueChange={(value) =>
                    setReferenceFilter(value as ReferenceFilter)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Files</SelectItem>
                    <SelectItem value="referenced">Referenced Only</SelectItem>
                    <SelectItem value="unreferenced">Unused Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">File Type</p>
                <Select
                  value={fileTypeFilter}
                  onValueChange={(value) =>
                    setFileTypeFilter(value as FileTypeFilter)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="images">Images Only</SelectItem>
                    <SelectItem value="other">Non-images</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <Tabs
                value={viewMode}
                onValueChange={(value) => setViewMode(value as ViewMode)}
              >
                <TabsList className="grid w-full grid-cols-2 sm:w-auto">
                  <TabsTrigger value="active">Active Files</TabsTrigger>
                  <TabsTrigger value="bin">Recently Deleted Bin</TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <Button
                  onClick={fetchFilesAndRefs}
                  disabled={loading}
                  className="w-full sm:w-auto"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
                {viewMode === "active" ? (
                  <Button
                    variant="secondary"
                    disabled={loading || selectedVisibleItems.length === 0}
                    onClick={() => openActionDialog("bin", selectedVisibleItems)}
                    className="w-full sm:w-auto"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Move Selected To Bin
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="secondary"
                      disabled={loading || selectedVisibleItems.length === 0}
                      onClick={() =>
                        openActionDialog("restore", selectedVisibleItems)
                      }
                      className="w-full sm:w-auto"
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Restore Selected
                    </Button>
                    <Button
                      variant="destructive"
                      disabled={loading || selectedVisibleItems.length === 0}
                      onClick={() =>
                        openActionDialog("delete", selectedVisibleItems)
                      }
                      className="w-full sm:w-auto"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Permanently
                    </Button>
                  </>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm text-warning-foreground">
              <div className="flex items-start gap-2">
                <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  Referenced files are protected. Only unused files can be moved
                  to the bin or permanently deleted.
                </div>
              </div>
            </div>

            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Showing {visibleFiles.length} item(s) in{" "}
              {BUCKETS.find((bucket) => bucket.value === selectedBucket)?.label}
            </div>

            <div className="md:hidden space-y-3">
              {visibleFiles.length > 0 ? (
                <>
                  <div className="flex items-center justify-between rounded-xl border bg-card p-3">
                    <div>
                      <p className="text-sm font-medium">Select visible files</p>
                      <p className="text-xs text-muted-foreground">
                        {selectedVisibleItems.length} selected
                      </p>
                    </div>
                    <Checkbox
                      checked={allVisibleSelected}
                      onCheckedChange={(checked) =>
                        toggleSelectAll(Boolean(checked))
                      }
                      aria-label="Select all visible files"
                    />
                  </div>

                  {visibleFiles.map((file) => (
                    <Card key={file.key} className="border">
                      <CardContent className="space-y-4 pt-4">
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={!!selected[file.key]}
                            onCheckedChange={() => toggleSelect(file.key)}
                            aria-label={`Select ${file.name}`}
                            className="mt-1"
                          />

                          <div className="flex min-w-0 flex-1 gap-3">
                            {file.isImage ? (
                              <a
                                href={file.previewUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="shrink-0"
                              >
                                <img
                                  src={file.previewUrl}
                                  alt={file.name}
                                  className="h-14 w-14 rounded-md border object-cover"
                                />
                              </a>
                            ) : (
                              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border bg-muted">
                                <ImageIcon className="h-5 w-5 text-muted-foreground" />
                              </div>
                            )}

                            <div className="min-w-0 flex-1 space-y-1">
                              <p className="break-all font-medium">{file.name}</p>
                              <p className="break-all text-xs text-muted-foreground">
                                Path: {file.path}
                              </p>
                              {file.originalPath && (
                                <p className="break-all text-xs text-muted-foreground">
                                  Original: {file.originalPath}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline">
                            {file.parentFolder === "/" ? "Root" : file.parentFolder}
                          </Badge>
                          <Badge
                            className={
                              file.referenced ? "bg-info text-white" : "bg-muted"
                            }
                          >
                            {file.referenced ? "Referenced" : "Unused"}
                          </Badge>
                          {file.isDeleted && (
                            <Badge className="bg-warning text-white">In Bin</Badge>
                          )}
                        </div>

                        {file.referenceSources.length > 0 && (
                          <div className="space-y-1 text-xs text-muted-foreground">
                            {file.referenceSources.slice(0, 2).map((source) => (
                              <div key={source}>{source}</div>
                            ))}
                            {file.referenceSources.length > 2 && (
                              <div>
                                +{file.referenceSources.length - 2} more references
                              </div>
                            )}
                          </div>
                        )}

                        <div className="grid grid-cols-1 gap-3 rounded-lg border bg-muted/20 p-3 text-sm sm:grid-cols-2">
                          <div>
                            <p className="text-xs text-muted-foreground">Size</p>
                            <p className="font-medium">{formatBytes(file.size)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">
                              {viewMode === "bin" ? "Deleted" : "Updated"}
                            </p>
                            <p className="font-medium break-words">
                              {formatDate(
                                viewMode === "bin" ? file.deletedAt : file.updated_at
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2">
                          <Button variant="outline" className="w-full" asChild>
                            <a href={file.previewUrl} target="_blank" rel="noreferrer">
                              View
                            </a>
                          </Button>
                          {viewMode === "active" ? (
                            <Button
                              variant="secondary"
                              className="w-full"
                              disabled={file.referenced || loading}
                              onClick={() => openActionDialog("bin", [file])}
                            >
                              Bin
                            </Button>
                          ) : (
                            <>
                              <Button
                                variant="secondary"
                                className="w-full"
                                disabled={loading}
                                onClick={() => openActionDialog("restore", [file])}
                              >
                                Restore
                              </Button>
                              <Button
                                variant="destructive"
                                className="w-full"
                                disabled={file.referenced || loading}
                                onClick={() => openActionDialog("delete", [file])}
                              >
                                Delete
                              </Button>
                            </>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </>
              ) : (
                <div className="rounded-xl border py-10 text-center text-muted-foreground">
                  No files match the current bucket view and filters.
                </div>
              )}
            </div>

            <div className="hidden overflow-x-auto rounded-xl border md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={allVisibleSelected}
                        onCheckedChange={(checked) =>
                          toggleSelectAll(Boolean(checked))
                        }
                        aria-label="Select all visible files"
                      />
                    </TableHead>
                    <TableHead>Preview</TableHead>
                    <TableHead>File</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>
                      {viewMode === "bin" ? "Deleted" : "Updated"}
                    </TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleFiles.length > 0 ? (
                    visibleFiles.map((file) => (
                      <TableRow key={file.key}>
                        <TableCell>
                          <Checkbox
                            checked={!!selected[file.key]}
                            onCheckedChange={() => toggleSelect(file.key)}
                            aria-label={`Select ${file.name}`}
                          />
                        </TableCell>
                        <TableCell>
                          {file.isImage ? (
                            <a
                              href={file.previewUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="block"
                            >
                              <img
                                src={file.previewUrl}
                                alt={file.name}
                                className="h-12 w-12 rounded-md object-cover border"
                              />
                            </a>
                          ) : (
                            <div className="h-12 w-12 rounded-md border bg-muted flex items-center justify-center">
                              <ImageIcon className="h-5 w-5 text-muted-foreground" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="min-w-[280px]">
                          <div className="font-medium break-all">{file.name}</div>
                          <div className="text-xs text-muted-foreground break-all">
                            Path: {file.path}
                          </div>
                          {file.originalPath && (
                            <div className="text-xs text-muted-foreground break-all">
                              Original: {file.originalPath}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="outline">
                              {file.parentFolder === "/" ? "Root" : file.parentFolder}
                            </Badge>
                            <Badge
                              className={
                                file.referenced ? "bg-info text-white" : "bg-muted"
                              }
                            >
                              {file.referenced ? "Referenced" : "Unused"}
                            </Badge>
                            {file.isDeleted && (
                              <Badge className="bg-warning text-white">In Bin</Badge>
                            )}
                          </div>
                          {file.referenceSources.length > 0 && (
                            <div className="mt-2 text-xs text-muted-foreground space-y-1">
                              {file.referenceSources.slice(0, 2).map((source) => (
                                <div key={source}>{source}</div>
                              ))}
                              {file.referenceSources.length > 2 && (
                                <div>
                                  +{file.referenceSources.length - 2} more references
                                </div>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>{formatBytes(file.size)}</TableCell>
                        <TableCell>
                          {formatDate(viewMode === "bin" ? file.deletedAt : file.updated_at)}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            <Button variant="outline" size="sm" asChild>
                              <a href={file.previewUrl} target="_blank" rel="noreferrer">
                                View
                              </a>
                            </Button>
                            {viewMode === "active" ? (
                              <Button
                                variant="secondary"
                                size="sm"
                                disabled={file.referenced || loading}
                                onClick={() => openActionDialog("bin", [file])}
                              >
                                Bin
                              </Button>
                            ) : (
                              <>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  disabled={loading}
                                  onClick={() => openActionDialog("restore", [file])}
                                >
                                  Restore
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  disabled={file.referenced || loading}
                                  onClick={() => openActionDialog("delete", [file])}
                                >
                                  Delete
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-10">
                        <div className="text-muted-foreground">
                          No files match the current bucket view and filters.
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Dialog
          open={!!pendingAction}
          onOpenChange={(open) => {
            if (!open) {
              setPendingAction(null);
              setConfirmationText("");
            }
          }}
        >
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {pendingAction?.type === "bin"
                  ? "Move Files To Bin"
                  : pendingAction?.type === "restore"
                  ? "Restore Files"
                  : "Delete Files Permanently"}
              </DialogTitle>
              <DialogDescription>
                {pendingAction?.type === "bin" &&
                  "Selected files will be moved to the recently deleted bin and remain viewable until permanently deleted."}
                {pendingAction?.type === "restore" &&
                  "Selected files will be restored to their original bucket paths."}
                {pendingAction?.type === "delete" &&
                  "Selected files will be permanently removed from storage and the recently deleted bin."}
              </DialogDescription>
            </DialogHeader>

            {pendingAction && (
              <div className="space-y-4">
                <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                  <div className="font-medium mb-2">
                    {pendingAction.files.length} file(s) selected
                  </div>
                  <div className="max-h-32 overflow-auto space-y-1 text-muted-foreground">
                    {pendingAction.files.map((file) => (
                      <div key={file.key} className="break-all">
                        {file.path}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Type{" "}
                    <span className="font-semibold text-foreground">
                      {getRequiredConfirmationText(pendingAction)}
                    </span>{" "}
                    to confirm.
                  </p>
                  <Input
                    value={confirmationText}
                    onChange={(event) => setConfirmationText(event.target.value)}
                    placeholder={getRequiredConfirmationText(pendingAction)}
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setPendingAction(null);
                  setConfirmationText("");
                }}
              >
                Cancel
              </Button>
              <Button
                variant={
                  pendingAction?.type === "delete" ? "destructive" : "default"
                }
                onClick={confirmPendingAction}
                disabled={!pendingAction || loading}
              >
                Confirm
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
