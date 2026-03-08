import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Mic, MicOff, Square, Save, Loader2, AlertTriangle, Keyboard } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface MobileVoiceCaptureProps {
  estimateDbId: string;
  areaId: string;
  areaName: string;
  existingTranscript: string;
  onSaveTranscript: (transcript: string) => Promise<void>;
  isOnline: boolean;
}

const DRAFT_KEY = (estId: string, areaId: string) => `tvik_voice_draft_${estId}_${areaId}`;

// Check Web Speech API support
function getSpeechRecognition(): any {
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function MobileVoiceCapture({
  estimateDbId, areaId, areaName, existingTranscript, onSaveTranscript, isOnline,
}: MobileVoiceCaptureProps) {
  const { toast } = useToast();
  const [transcript, setTranscript] = useState(() => {
    // Load draft from localStorage first, fall back to existing
    const draft = localStorage.getItem(DRAFT_KEY(estimateDbId, areaId));
    return draft || existingTranscript || '';
  });
  const [isRecording, setIsRecording] = useState(false);
  const [saving, setSaving] = useState(false);
  const [useFallback, setUseFallback] = useState(false);
  const [interimText, setInterimText] = useState('');
  const recognitionRef = useRef<any>(null);
  const speechSupported = !!getSpeechRecognition();

  // Save draft to localStorage on change
  useEffect(() => {
    if (transcript) {
      localStorage.setItem(DRAFT_KEY(estimateDbId, areaId), transcript);
    }
  }, [transcript, estimateDbId, areaId]);

  // Sync if existingTranscript changes externally
  useEffect(() => {
    const draft = localStorage.getItem(DRAFT_KEY(estimateDbId, areaId));
    if (!draft && existingTranscript) {
      setTranscript(existingTranscript);
    }
  }, [existingTranscript, estimateDbId, areaId]);

  const startRecording = useCallback(() => {
    const SpeechRecClass = getSpeechRecognition();
    if (!SpeechRecClass) {
      setUseFallback(true);
      toast({ title: 'Voice not supported', description: 'Type your notes below instead.' });
      return;
    }

    const recognition = new SpeechRecClass();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript + ' ';
        } else {
          interim += result[0].transcript;
        }
      }
      if (final) {
        setTranscript(prev => (prev ? prev + ' ' : '') + final.trim());
      }
      setInterimText(interim);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'not-allowed') {
        toast({ title: 'Microphone denied', description: 'Grant mic access or type notes manually.', variant: 'destructive' });
        setUseFallback(true);
      } else if (event.error !== 'aborted') {
        toast({ title: 'Speech error', description: `${event.error}. Switching to manual input.` });
        setUseFallback(true);
      }
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
      setInterimText('');
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  }, [toast]);

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop();
    setIsRecording(false);
    setInterimText('');
  }, []);

  const saveTranscript = useCallback(async () => {
    if (!transcript.trim()) return;
    setSaving(true);
    try {
      await onSaveTranscript(transcript.trim());
      localStorage.removeItem(DRAFT_KEY(estimateDbId, areaId));
      toast({ title: 'Transcript saved', description: `Voice notes saved for ${areaName}` });
    } catch (e: any) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }, [transcript, onSaveTranscript, estimateDbId, areaId, areaName, toast]);

  const hasUnsavedChanges = transcript.trim() !== (existingTranscript || '').trim();

  return (
    <div className="space-y-3">
      {/* Record controls */}
      {speechSupported && !useFallback ? (
        <div className="space-y-2">
          <Button
            className={`w-full h-16 text-base ${isRecording ? 'bg-destructive hover:bg-destructive/90' : ''}`}
            onClick={isRecording ? stopRecording : startRecording}
          >
            {isRecording ? (
              <>
                <Square className="h-5 w-5 mr-2 fill-current" />
                Stop Recording
                <span className="ml-2 animate-pulse">●</span>
              </>
            ) : (
              <>
                <Mic className="h-5 w-5 mr-2" />
                Start Voice Recording
              </>
            )}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            onClick={() => setUseFallback(true)}
          >
            <Keyboard className="h-3 w-3 mr-1" />
            Switch to typing
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <Card>
            <CardContent className="py-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {!speechSupported ? 'Voice recording not supported in this browser.' : 'Manual input mode.'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Type your walkthrough notes below. On iPhone, use Safari for voice support.
              </p>
            </CardContent>
          </Card>
          {speechSupported && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              onClick={() => setUseFallback(false)}
            >
              <Mic className="h-3 w-3 mr-1" />
              Switch to voice
            </Button>
          )}
        </div>
      )}

      {/* Interim display */}
      {interimText && (
        <div className="bg-muted/50 rounded-lg px-3 py-2 text-sm text-muted-foreground italic">
          {interimText}…
        </div>
      )}

      {/* Transcript area */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Transcript — {areaName}</span>
          {hasUnsavedChanges && (
            <Badge variant="secondary" className="text-xs">Unsaved changes</Badge>
          )}
        </div>
        <Textarea
          value={transcript}
          onChange={e => setTranscript(e.target.value)}
          placeholder={`Describe what you see in ${areaName}… conditions, materials, measurements, concerns…`}
          className="min-h-[120px] text-base"
        />
        <p className="text-xs text-muted-foreground">
          {transcript.length} characters • Draft auto-saved locally
        </p>
      </div>

      {/* Save button */}
      <Button
        className="w-full h-12"
        onClick={saveTranscript}
        disabled={saving || !transcript.trim() || (!isOnline && !hasUnsavedChanges)}
      >
        {saving ? (
          <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving…</>
        ) : !isOnline ? (
          <><AlertTriangle className="h-4 w-4 mr-2" />Offline — Draft Saved Locally</>
        ) : (
          <><Save className="h-4 w-4 mr-2" />Save Transcript</>
        )}
      </Button>
    </div>
  );
}
