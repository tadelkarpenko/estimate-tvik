import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getEstimate, getEstimates } from '@/lib/store';
import { supabase } from '@/integrations/supabase/client';
import type { Estimate } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PWAInstallGuide } from '@/components/PWAInstallGuide';
import { MobilePhotoCapture } from '@/components/mobile/MobilePhotoCapture';
import { MobileVoiceCapture } from '@/components/mobile/MobileVoiceCapture';
import { MobileNotesCapture } from '@/components/mobile/MobileNotesCapture';
import {
  Camera, Mic, MapPin, Plus, ChevronRight, FileText,
  Navigation, CheckCircle, AlertTriangle, Loader2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AreaSummary {
  id: string;
  area_id: string;
  area_name: string;
  area_sequence: number;
  uploaded_photo_count: number;
  voice_capture_status: string;
  voice_transcript_raw: string;
  notes_text: string;
  merged_analysis_status: string;
  confidence: string;
  site_visit_flag: boolean;
  quick_tags: string;
}

type CaptureTab = 'photos' | 'voice' | 'notes';

export default function MobileFieldCapture() {
  const { id: estimateId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [areas, setAreas] = useState<AreaSummary[]>([]);
  const [selectedAreaId, setSelectedAreaId] = useState<string>('');
  const [estimateDbId, setEstimateDbId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<CaptureTab>('photos');
  const [geoStatus, setGeoStatus] = useState<'idle' | 'capturing' | 'done' | 'denied'>('idle');
  const [geoCoords, setGeoCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    const allEst = await getEstimates();
    setEstimates(allEst);

    if (estimateId) {
      const est = await getEstimate(estimateId);
      setEstimate(est || null);
      if (est) {
        const { data: dbEst } = await supabase.from('estimates').select('id').eq('estimate_id', estimateId).maybeSingle();
        if (dbEst) {
          setEstimateDbId(dbEst.id);
          const { data: areaData } = await supabase.from('estimate_areas')
            .select('id,area_id,area_name,area_sequence,uploaded_photo_count,voice_capture_status,voice_transcript_raw,notes_text,merged_analysis_status,confidence,site_visit_flag,quick_tags')
            .eq('estimate_id', dbEst.id)
            .order('area_sequence');
          setAreas((areaData || []) as AreaSummary[]);
          if (areaData && areaData.length > 0 && !selectedAreaId) {
            setSelectedAreaId(areaData[0].area_id);
          }
        }
      }
    }
    setLoading(false);
  }, [estimateId, selectedAreaId]);

  useEffect(() => { loadData(); }, [loadData]);

  const captureLocation = useCallback(() => {
    if (!navigator.geolocation) {
      toast({ title: 'Geolocation not available', description: 'Use manual address entry instead.', variant: 'destructive' });
      setGeoStatus('denied');
      return;
    }
    setGeoStatus('capturing');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoStatus('done');
        toast({ title: 'Location captured', description: `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}` });
      },
      () => {
        setGeoStatus('denied');
        toast({ title: 'Location denied', description: 'You can still create estimates without location.', variant: 'destructive' });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [toast]);

  const selectedArea = areas.find(a => a.area_id === selectedAreaId);

  // Handlers for capture components
  const handlePhotoUploaded = useCallback(async (url: string, caption: string) => {
    if (!estimateDbId || !selectedArea) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('estimate_media').insert({
      estimate_id: estimateDbId,
      media_id: crypto.randomUUID(),
      file_url: url,
      caption,
      user_id: user.id,
    });

    // Increment area photo count
    await supabase.from('estimate_areas')
      .update({ uploaded_photo_count: (selectedArea.uploaded_photo_count || 0) + 1 })
      .eq('id', selectedArea.id);

    // Refresh area data
    loadData();
  }, [estimateDbId, selectedArea, loadData]);

  const handleSaveTranscript = useCallback(async (transcript: string) => {
    if (!selectedArea) return;
    await supabase.from('estimate_areas')
      .update({
        voice_transcript_raw: transcript,
        voice_capture_status: 'Captured',
        voice_last_updated_at: new Date().toISOString(),
      })
      .eq('id', selectedArea.id);
    loadData();
  }, [selectedArea, loadData]);

  const handleSaveNotes = useCallback(async (notes: string, tags: string[]) => {
    if (!selectedArea) return;
    await supabase.from('estimate_areas')
      .update({
        notes_text: notes,
        quick_tags: tags.join(', '),
      })
      .eq('id', selectedArea.id);
    loadData();
  }, [selectedArea, loadData]);

  if (loading) return <div className="py-8 text-center text-muted-foreground">Loading…</div>;

  // No estimate selected — show picker
  if (!estimateId || !estimate) {
    return (
      <div className="space-y-4 pb-20">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Field Capture</h1>
          <Badge variant={isOnline ? 'default' : 'destructive'} className="text-xs">
            {isOnline ? 'Online' : 'Offline'}
          </Badge>
        </div>
        <PWAInstallGuide />
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Select an Estimate</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {estimates.filter(e => e.status === 'Draft' || e.status === 'Ready').slice(0, 10).map(e => (
              <Button key={e.estimate_id} variant="outline" className="w-full justify-between h-auto py-3 text-left"
                onClick={() => navigate(`/field/${e.estimate_id}`)}>
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{e.project_name || e.estimate_id}</p>
                  <p className="text-xs text-muted-foreground truncate">{e.client_name} · {e.city}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Button>
            ))}
            {estimates.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No estimates yet</p>}
          </CardContent>
        </Card>
        <Button variant="gold" className="w-full h-12 text-base" onClick={() => navigate('/estimates/new')}>
          <Plus className="h-4 w-4 mr-2" />New Estimate
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-lg font-bold truncate">{estimate.project_name || estimate.estimate_id}</h1>
          <p className="text-xs text-muted-foreground truncate">{estimate.client_name} · {estimate.city}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge variant={isOnline ? 'default' : 'destructive'} className="text-xs">
            {isOnline ? 'Online' : 'Offline'}
          </Badge>
          <Badge variant="secondary" className="text-xs">{estimate.status}</Badge>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-2">
        <MiniStat label="Areas" value={areas.length} />
        <MiniStat label="Photos" value={areas.reduce((s, a) => s + a.uploaded_photo_count, 0)} />
        <MiniStat label="Voice" value={areas.filter(a => a.voice_capture_status !== 'Not Started').length} />
      </div>

      {/* Location Capture */}
      <Card>
        <CardContent className="py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">
              {geoStatus === 'done' && geoCoords ? `${geoCoords.lat.toFixed(4)}, ${geoCoords.lng.toFixed(4)}` :
               geoStatus === 'denied' ? 'Location denied' : 'Capture site location'}
            </span>
          </div>
          <Button variant="outline" size="sm" className="h-8"
            onClick={captureLocation} disabled={geoStatus === 'capturing'}>
            {geoStatus === 'capturing' ? <Loader2 className="h-3 w-3 animate-spin" /> :
             geoStatus === 'done' ? <CheckCircle className="h-3 w-3 text-primary" /> :
             <Navigation className="h-3 w-3" />}
            <span className="ml-1.5 text-xs">{geoStatus === 'done' ? 'Recapture' : 'Capture'}</span>
          </Button>
        </CardContent>
      </Card>

      {/* Area Selector */}
      <Card>
        <CardContent className="py-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Current Area</span>
            <Button variant="ghost" size="sm" className="h-7 text-xs"
              onClick={() => navigate(`/estimates/${estimate.estimate_id}`)}>
              Full Estimate <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
          {areas.length > 0 ? (
            <Select value={selectedAreaId} onValueChange={setSelectedAreaId}>
              <SelectTrigger className="h-12 text-base">
                <SelectValue placeholder="Select area…" />
              </SelectTrigger>
              <SelectContent>
                {areas.map(a => (
                  <SelectItem key={a.area_id} value={a.area_id} className="py-2">
                    <span className="flex items-center gap-2">
                      {a.area_name || `Area ${a.area_sequence + 1}`}
                      {a.site_visit_flag && <AlertTriangle className="h-3 w-3 text-destructive" />}
                      <Badge variant="secondary" className="text-xs ml-1">{a.uploaded_photo_count} 📷</Badge>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-2">
              No areas yet. Open the full estimate to add areas.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Selected Area Quick Tags */}
      {selectedArea && selectedArea.quick_tags && (
        <div className="flex flex-wrap gap-1.5">
          {selectedArea.quick_tags.split(',').filter(Boolean).map(tag => (
            <Badge key={tag} variant="outline" className="text-xs">{tag.trim()}</Badge>
          ))}
        </div>
      )}

      {/* Capture Content Area */}
      {selectedArea && estimateDbId && (
        <div className="min-h-[200px]">
          {activeTab === 'photos' && (
            <MobilePhotoCapture
              estimateDbId={estimateDbId}
              areaId={selectedArea.area_id}
              areaName={selectedArea.area_name || `Area ${selectedArea.area_sequence + 1}`}
              onPhotoUploaded={handlePhotoUploaded}
              isOnline={isOnline}
            />
          )}
          {activeTab === 'voice' && (
            <MobileVoiceCapture
              estimateDbId={estimateDbId}
              areaId={selectedArea.area_id}
              areaName={selectedArea.area_name || `Area ${selectedArea.area_sequence + 1}`}
              existingTranscript={selectedArea.voice_transcript_raw || ''}
              onSaveTranscript={handleSaveTranscript}
              isOnline={isOnline}
            />
          )}
          {activeTab === 'notes' && (
            <MobileNotesCapture
              estimateDbId={estimateDbId}
              areaId={selectedArea.area_id}
              areaName={selectedArea.area_name || `Area ${selectedArea.area_sequence + 1}`}
              existingNotes={selectedArea.notes_text || ''}
              quickTags={selectedArea.quick_tags ? selectedArea.quick_tags.split(',').map(t => t.trim()).filter(Boolean) : []}
              onSaveNotes={handleSaveNotes}
              isOnline={isOnline}
            />
          )}
        </div>
      )}

      {!selectedArea && areas.length > 0 && (
        <Card>
          <CardContent className="py-6 text-center text-muted-foreground text-sm">
            Select an area above to start capturing.
          </CardContent>
        </Card>
      )}

      {/* Sticky Bottom Tab Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-2 flex gap-1 z-50 safe-area-pb">
        <TabButton active={activeTab === 'photos'} onClick={() => setActiveTab('photos')} icon={<Camera className="h-5 w-5" />} label="Photos" />
        <TabButton active={activeTab === 'voice'} onClick={() => setActiveTab('voice')} icon={<Mic className="h-5 w-5" />} label="Voice" />
        <TabButton active={activeTab === 'notes'} onClick={() => setActiveTab('notes')} icon={<FileText className="h-5 w-5" />} label="Notes" />
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="py-2 px-3 text-center">
        <p className="text-lg font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex flex-col items-center gap-0.5 py-2 rounded-lg transition-colors text-sm ${
        active
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-muted'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
