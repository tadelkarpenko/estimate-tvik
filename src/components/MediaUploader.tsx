import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ImagePlus, Upload, X, Link } from 'lucide-react';
import { validateMediaFile, uploadMediaFile, type UploadResult } from '@/lib/mediaUpload';
import { useToast } from '@/hooks/use-toast';

interface MediaUploaderProps {
  folder: 'estimates' | 'contracts';
  onUploaded: (url: string, caption: string) => Promise<void>;
}

export function MediaUploader({ folder, onUploaded }: MediaUploaderProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlValue, setUrlValue] = useState('');
  const [caption, setCaption] = useState('');

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const error = validateMediaFile(file);
        if (error) {
          toast({ title: 'Invalid file', description: `${file.name}: ${error}`, variant: 'destructive' });
          continue;
        }
        const result = await uploadMediaFile(file, folder);
        await onUploaded(result.url, caption || file.name);
      }
      setCaption('');
      toast({ title: `${files.length} photo(s) uploaded` });
    } catch (e: any) {
      toast({ title: 'Upload failed', description: e.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  }, [folder, onUploaded, caption, toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const addByUrl = async () => {
    if (!urlValue.trim()) return;
    setUploading(true);
    try {
      await onUploaded(urlValue.trim(), caption || '');
      setUrlValue('');
      setCaption('');
      setShowUrlInput(false);
      toast({ title: 'Photo added by URL' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-end">
        <div className="flex-1 min-w-[150px]">
          <Label>Caption (optional)</Label>
          <Input value={caption} onChange={e => setCaption(e.target.value)} placeholder="Photo description" />
        </div>
      </div>

      {/* Drag & drop zone */}
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
          dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
        }`}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">
          {uploading ? 'Uploading...' : 'Drag & drop images here or click to browse'}
        </p>
        <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WEBP • Max 10MB each</p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".png,.jpg,.jpeg,.webp"
          multiple
          className="hidden"
          onChange={e => e.target.files && handleFiles(e.target.files)}
        />
      </div>

      {/* URL add (secondary) */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => setShowUrlInput(!showUrlInput)} className="text-xs">
          <Link className="h-3 w-3 mr-1" />Add by URL (advanced)
        </Button>
      </div>
      {showUrlInput && (
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Input value={urlValue} onChange={e => setUrlValue(e.target.value)} placeholder="https://..." />
          </div>
          <Button size="sm" onClick={addByUrl} disabled={!urlValue.trim() || uploading}>
            <ImagePlus className="h-4 w-4 mr-1" />Add
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setShowUrlInput(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
