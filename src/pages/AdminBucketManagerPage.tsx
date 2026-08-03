import React, { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { getFines } from '@/integrations/supabase/queries';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface StorageFile {
  name: string;
  id?: string;
  updated_at?: string;
  created_at?: string;
  size?: number;
}

export default function AdminBucketManagerPage() {
  const { user } = useAuth();
  const [files, setFiles] = useState<StorageFile[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [unusedOnly, setUnusedOnly] = useState(true);

  useEffect(() => {
    if (!user || user.role !== 'admin') return;
    fetchFilesAndRefs();
  }, [user]);

  async function fetchFilesAndRefs() {
    try {
      setLoading(true);
      // List files in payment-proofs bucket
      const { data: list, error: listErr } = await supabase.storage.from('payment-proofs').list('', { limit: 2000 });
      if (listErr) throw listErr;

      const storageFiles: StorageFile[] = (list || []).map(f => ({ name: f.name, updated_at: (f as any).updated_at, size: (f as any).size }));

      // Get referenced files from fines table
      const fines = await getFines();
      const referenced = new Set<string>();

      fines.forEach((fine: any) => {
        if (fine.payment_proof) {
          try {
            const parts = fine.payment_proof.split('/');
            referenced.add(decodeURIComponent(parts[parts.length - 1]));
          } catch (_) {}
        }
        if (fine.payment_proofs && Array.isArray(fine.payment_proofs)) {
          fine.payment_proofs.forEach((url: string) => {
            if (!url) return;
            try {
              const parts = url.split('/');
              referenced.add(decodeURIComponent(parts[parts.length - 1]));
            } catch (_) {}
          });
        }
      });

      // Mark unused files
      const merged = storageFiles.map(f => ({ ...f, referenced: referenced.has(f.name) }));
      setFiles(merged as any);
      setSelected({});
    } catch (err) {
      console.error('Error fetching storage files:', err);
      toast.error('Failed to load bucket files');
    } finally {
      setLoading(false);
    }
  }

  function toggleSelect(name: string) {
    setSelected(prev => ({ ...prev, [name]: !prev[name] }));
  }

  async function deleteSelected() {
    const names = Object.keys(selected).filter(k => selected[k]);
    if (names.length === 0) {
      toast.error('Select at least one file to delete');
      return;
    }

    if (!confirm(`Delete ${names.length} file(s) from storage? This is permanent.`)) return;

    try {
      setLoading(true);
      const { error } = await supabase.storage.from('payment-proofs').remove(names);
      if (error) throw error;
      toast.success('Deleted selected files');
      await fetchFilesAndRefs();
    } catch (err) {
      console.error('Delete error:', err);
      toast.error('Failed to delete files');
    } finally {
      setLoading(false);
    }
  }

  const visibleFiles = files.filter(f => (unusedOnly ? !(f as any).referenced : true));

  if (!user || user.role !== 'admin') {
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
      <div className="content-wrapper">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Bucket Manager — payment-proofs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 mb-4">
              <Button onClick={fetchFilesAndRefs} disabled={loading}>Refresh</Button>
              <Button variant="destructive" onClick={deleteSelected} disabled={loading}>Delete Selected</Button>
              <label className="ml-4 flex items-center gap-2">
                <input type="checkbox" checked={unusedOnly} onChange={() => setUnusedOnly(s => !s)} />
                <span className="text-sm">Show unused only</span>
              </label>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Select</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead>Referenced</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleFiles.map((f: any) => (
                    <TableRow key={f.name}>
                      <TableCell>
                        <input type="checkbox" checked={!!selected[f.name]} onChange={() => toggleSelect(f.name)} />
                      </TableCell>
                      <TableCell>{f.name}</TableCell>
                      <TableCell>{f.size ? `${(f.size / 1024).toFixed(1)} KB` : '-'}</TableCell>
                      <TableCell>{f.updated_at || '-'}</TableCell>
                      <TableCell>{(f as any).referenced ? 'Yes' : 'No'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
