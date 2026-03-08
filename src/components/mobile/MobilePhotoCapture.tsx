import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Camera, Upload, X, Loader2, ImagePlus, AlertTriangle } from 'lucide-react';
import { validateMediaFile, uploadMediaFile, type UploadResult } from '@/lib/mediaUpload';
import { useToast } from '@/hooks/use-toast';

interface MobilePhotoCaptureProps {
  estimateDbId: string;
  areaId: string;
  areaName: string;
  onPhotoUploaded: (url: string, caption: string) => Promise<void>;
  isOnline: boolean;
}

interface PendingPhoto {
  id: string;
  file: File;
  preview: string;
  caption: string;
  status: 'pending' | 'uploading' | 'done' | 'error';
  error?: string;
}

const DRAFT_KEY = (estId: string, areaId: string) => `tvik_photo_drafts_${estId}_${areaId}`;

export function MobilePhotoCapture({ estimateDbId, areaId, areaName, onPhotoUploaded, isOnline }: MobilePhotoCaptureProps) {
  const { toast } = useToast();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [uploading, setUploading] = useState(false);

  const addFiles = useCallback((files: FileList | File[]) => {
    const newPhotos: PendingPhoto[] = [];
    for (const file of Array.from(files)) {
      const error = validateMediaFile(file);
      if (error) {
        toast({ title: 'Invalid file', description: `${file.name}: ${error}`, variant: 'destructive' });
        continue;
      }
      newPhotos.push({
        id: crypto.randomUUID(),
        file,
        preview: URL.createObjectURL(file),
        caption: '',
        status: 'pending',
      });
    }
    setPhotos(prev => [...prev, ...newPhotos]);
  }, [toast]);

  const removePhoto = (id: string) => {
    setPhotos(prev => {
      const p = prev.find(x => x.id === id);
      if (p) URL.revokeObjectURL(p.preview);
      return prev.filter(x => x.id !== id);
    });
  };

  const updateCaption = (id: string, caption: string) => {
    setPhotos(prev => prev.map(p => p.id === id ? { ...p, caption } : p));
  };

  const uploadAll = useCallback(async () => {
    if (!isOnline) {
      toast({ title: 'Offline', description: 'Photos queued. They will upload when back online.', variant: 'destructive' });
      return;
    }
    setUploading(true);
    const pending = photos.filter(p => p.status === 'pending' || p.status === 'error');
    for (const photo of pending) {
      setPhotos(prev => prev.map(p => p.id === photo.id ? { ...p, status: 'uploading' } : p));
      try {
        const result = await uploadMediaFile(photo.file, 'estimates');
        await onPhotoUploaded(result.url, photo.caption || photo.file.name);
        setPhotos(prev => prev.map(p => p.id === photo.id ? { ...p, status: 'done' } : p));
      } catch (e: any) {
        setPhotos(prev => prev.map(p => p.id === photo.id ? { ...p, status: 'error', error: e.message } : p));
      }
    }
    setUploading(false);
    const successCount = photos.filter(p => p.status !== 'error').length;
    if (successCount > 0) {
      toast({ title: `${successCount} photo(s) uploaded for ${areaName}` });
    }
  }, [photos, isOnline, onPhotoUploaded, areaName, toast]);

  const pendingCount = photos.filter(p => p.status === 'pending' || p.status === 'error').length;
  const doneCount = photos.filter(p => p.status === 'done').length;

  return (
    <div className="space-y-3">
      {/* Camera / Gallery buttons */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          className="h-16 flex-col gap-1"
          onClick={() => cameraRef.current?.click()}
        >
          <Camera className="h-6 w-6" />
          <span className="text-xs">Take Photo</span>
        </Button>
        <Button
          variant="outline"
          className="h-16 flex-col gap-1"
          onClick={() => galleryRef.current?.click()}
        >
          <ImagePlus className="h-6 w-6" />
          <span className="text-xs">From Gallery</span>
        </Button>
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={e => e.target.files && addFiles(e.target.files)}
        />
        <input
          ref={galleryRef}
          type="file"
          accept=".png,.jpg,.jpeg,.webp"
          multiple
          className="hidden"
          onChange={e => e.target.files && addFiles(e.target.files)}
        />
      </div>

      {/* Preview grid */}
      {photos.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              {photos.length} photo(s) • {doneCount} uploaded
            </span>
            {pendingCount > 0 && (
              <Badge variant="secondary" className="text-xs">{pendingCount} ready</Badge>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {photos.map(photo => (
              <div key={photo.id} className="relative group">
                <img
                  src={photo.preview}
                  alt={photo.caption || 'Photo'}
                  className="w-full aspect-square object-cover rounded-lg border border-border"
                />
                {photo.status === 'uploading' && (
                  <div className="absolute inset-0 bg-background/60 rounded-lg flex items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                )}
                {photo.status === 'done' && (
                  <div className="absolute top-1 right-1">
                    <Badge className="bg-primary text-primary-foreground text-[10px] px-1 py-0">✓</Badge>
                  </div>
                )}
                {photo.status === 'error' && (
                  <div className="absolute top-1 right-1">
                    <Badge variant="destructive" className="text-[10px] px-1 py-0">!</Badge>
                  </div>
                )}
                {photo.status !== 'uploading' && photo.status !== 'done' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-0.5 left-0.5 h-6 w-6 bg-background/70"
                    onClick={() => removePhoto(photo.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          {/* Upload button */}
          {pendingCount > 0 && (
            <Button
              className="w-full h-12"
              onClick={uploadAll}
              disabled={uploading || !isOnline}
            >
              {uploading ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Uploading…</>
              ) : !isOnline ? (
                <><AlertTriangle className="h-4 w-4 mr-2" />Offline — Queued</>
              ) : (
                <><Upload className="h-4 w-4 mr-2" />Upload {pendingCount} Photo(s)</>
              )}
            </Button>
          )}
        </div>
      )}

      {photos.length === 0 && (
        <Card>
          <CardContent className="py-6 text-center text-muted-foreground text-sm">
            <Camera className="h-8 w-8 mx-auto mb-2 opacity-40" />
            Take a photo or select from gallery to capture site conditions for <strong>{areaName}</strong>.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
