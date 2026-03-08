import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Save, Loader2, AlertTriangle, FileText, Tag } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface MobileNotesCaptureProps {
  estimateDbId: string;
  areaId: string;
  areaName: string;
  existingNotes: string;
  quickTags: string[];
  onSaveNotes: (notes: string, tags: string[]) => Promise<void>;
  isOnline: boolean;
}

const DRAFT_KEY = (estId: string, areaId: string) => `tvik_notes_draft_${estId}_${areaId}`;

const COMMON_TAGS = [
  'Water Damage', 'Mold', 'Structural', 'Electrical', 'Plumbing',
  'HVAC', 'Flooring', 'Drywall', 'Paint', 'Trim',
  'Demo Required', 'Permit Needed', 'Client Decision', 'Measure Again',
];

export function MobileNotesCapture({
  estimateDbId, areaId, areaName, existingNotes, quickTags, onSaveNotes, isOnline,
}: MobileNotesCaptureProps) {
  const { toast } = useToast();
  const [notes, setNotes] = useState(() => {
    const draft = localStorage.getItem(DRAFT_KEY(estimateDbId, areaId));
    return draft || existingNotes || '';
  });
  const [selectedTags, setSelectedTags] = useState<string[]>(quickTags);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (notes) {
      localStorage.setItem(DRAFT_KEY(estimateDbId, areaId), notes);
    }
  }, [notes, estimateDbId, areaId]);

  useEffect(() => {
    const draft = localStorage.getItem(DRAFT_KEY(estimateDbId, areaId));
    if (!draft && existingNotes) {
      setNotes(existingNotes);
    }
  }, [existingNotes, estimateDbId, areaId]);

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const saveNotes = useCallback(async () => {
    if (!notes.trim() && selectedTags.length === 0) return;
    setSaving(true);
    try {
      await onSaveNotes(notes.trim(), selectedTags);
      localStorage.removeItem(DRAFT_KEY(estimateDbId, areaId));
      toast({ title: 'Notes saved', description: `Field notes saved for ${areaName}` });
    } catch (e: any) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }, [notes, selectedTags, onSaveNotes, estimateDbId, areaId, areaName, toast]);

  const hasUnsavedChanges = notes.trim() !== (existingNotes || '').trim();

  return (
    <div className="space-y-3">
      {/* Quick tags */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <Tag className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm font-medium">Quick Tags</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {COMMON_TAGS.map(tag => (
            <Badge
              key={tag}
              variant={selectedTags.includes(tag) ? 'default' : 'outline'}
              className="text-xs cursor-pointer select-none"
              onClick={() => toggleTag(tag)}
            >
              {tag}
            </Badge>
          ))}
        </div>
      </div>

      {/* Notes area */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Field Notes — {areaName}</span>
          {hasUnsavedChanges && (
            <Badge variant="secondary" className="text-xs">Unsaved</Badge>
          )}
        </div>
        <Textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder={`Internal notes for ${areaName}… measurements, concerns, client requests, conditions observed…`}
          className="min-h-[150px] text-base"
        />
        <p className="text-xs text-muted-foreground">
          {notes.length} characters • Draft auto-saved locally
        </p>
      </div>

      {/* Save button */}
      <Button
        className="w-full h-12"
        onClick={saveNotes}
        disabled={saving || (!notes.trim() && selectedTags.length === 0) || (!isOnline && !hasUnsavedChanges)}
      >
        {saving ? (
          <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving…</>
        ) : !isOnline ? (
          <><AlertTriangle className="h-4 w-4 mr-2" />Offline — Draft Saved Locally</>
        ) : (
          <><Save className="h-4 w-4 mr-2" />Save Notes</>
        )}
      </Button>
    </div>
  );
}
