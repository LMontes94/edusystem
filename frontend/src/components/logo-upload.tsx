'use client';
  
import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input }  from '@/components/ui/input';
import { useUpdateInstitution } from '@/lib/api/institution';
import { Upload, Trash2, ImageIcon } from 'lucide-react';
 
// ── Hook logo ─────────────────────────────────
function useLogoUrl(institutionId: string) {
  return useQuery<{ url: string | null }>({
    queryKey: ['institution-logo', institutionId],
    queryFn:  async () => {
      const res = await api.get(`/institutions/${institutionId}/logo-url`);
      return res.data;
    },
    enabled: !!institutionId,
  });
}
 
function useUploadLogo(institutionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post(`/institutions/${institutionId}/logo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['institution-logo', institutionId] });
      queryClient.invalidateQueries({ queryKey: ['institution', 'mine'] });
      toast.success('Logo actualizado');
    },
    onError: () => toast.error('Error al subir el logo'),
  });
}
 
// ── Componente logo ───────────────────────────
export function LogoUpload({ institutionId }: { institutionId: string }) {
  const fileInputRef  = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
 
  const { data: logoData }   = useLogoUrl(institutionId);
  const uploadLogo            = useUploadLogo(institutionId);
 
  const currentUrl = preview ?? logoData?.url ?? null;
 
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
 
    if (file.size > 2 * 1024 * 1024) {
      toast.error('El archivo no puede superar 2MB');
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast.error('Solo se permiten imágenes');
      return;
    }
 
    // Preview local inmediato
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
 
    // Subir
    uploadLogo.mutate(file, {
      onSettled: () => setPreview(null),
    });
  }
 
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Logo de la institución</label>
      <div className="flex items-center gap-4">
        {/* Preview */}
        <div
          className="h-20 w-20 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center bg-muted/20 overflow-hidden cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          {currentUrl ? (
            <img
              src={currentUrl}
              alt="Logo institución"
              className="h-full w-full object-contain p-1"
            />
          ) : (
            <div className="flex flex-col items-center gap-1 text-muted-foreground">
              <ImageIcon className="h-6 w-6" />
              <span className="text-xs">Logo</span>
            </div>
          )}
        </div>
 
        {/* Acciones */}
        <div className="space-y-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadLogo.isPending}
          >
            <Upload className="h-3.5 w-3.5" />
            {uploadLogo.isPending ? 'Subiendo...' : currentUrl ? 'Cambiar logo' : 'Subir logo'}
          </Button>
          <p className="text-xs text-muted-foreground">
            PNG, JPG o SVG · Máx. 2MB
          </p>
        </div>
 
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
}