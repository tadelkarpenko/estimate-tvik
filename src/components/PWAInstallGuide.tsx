import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Share, Plus, Smartphone, Camera, Mic, MapPin, Wifi, WifiOff } from 'lucide-react';

export function PWAInstallGuide() {
  const [dismissed, setDismissed] = useState(() =>
    localStorage.getItem('tvik_pwa_guide_dismissed') === 'true'
  );
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as any).standalone === true;
    setIsStandalone(standalone);
    setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent));
  }, []);

  const dismiss = () => {
    setDismissed(true);
    localStorage.setItem('tvik_pwa_guide_dismissed', 'true');
  };

  if (dismissed) return null;

  return (
    <Card className="border-primary/20 bg-primary/5 relative">
      <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-7 w-7" onClick={dismiss}>
        <X className="h-4 w-4" />
      </Button>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Smartphone className="h-4 w-4 text-primary" />
          {isStandalone ? 'Field App Active' : 'Install as Field App'}
          {isStandalone && <Badge className="bg-primary text-primary-foreground text-xs">Installed</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isStandalone ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              You're running TVIK Estimator as a field app. All features are available.
            </p>
            <div className="flex flex-wrap gap-2">
              <FeatureChip icon={<Camera className="h-3 w-3" />} label="Camera" />
              <FeatureChip icon={<Mic className="h-3 w-3" />} label="Voice" />
              <FeatureChip icon={<MapPin className="h-3 w-3" />} label="Location" />
              <FeatureChip icon={<WifiOff className="h-3 w-3" />} label="Draft Offline" />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              For the best field experience, add this app to your Home Screen.
            </p>
            {isIOS ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">iPhone / iPad:</p>
                <ol className="text-sm text-muted-foreground space-y-1.5 list-none pl-0">
                  <li className="flex items-start gap-2">
                    <Badge variant="outline" className="shrink-0 text-xs mt-0.5">1</Badge>
                    <span>Tap the <Share className="inline h-3.5 w-3.5 -mt-0.5" /> Share button in Safari</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Badge variant="outline" className="shrink-0 text-xs mt-0.5">2</Badge>
                    <span>Scroll down and tap <strong>"Add to Home Screen"</strong></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Badge variant="outline" className="shrink-0 text-xs mt-0.5">3</Badge>
                    <span>Tap <strong>Add</strong> — open from your Home Screen icon</span>
                  </li>
                </ol>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-medium">Android / Chrome:</p>
                <ol className="text-sm text-muted-foreground space-y-1.5 list-none pl-0">
                  <li className="flex items-start gap-2">
                    <Badge variant="outline" className="shrink-0 text-xs mt-0.5">1</Badge>
                    <span>Tap the browser menu (⋮)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Badge variant="outline" className="shrink-0 text-xs mt-0.5">2</Badge>
                    <span>Tap <strong>"Install app"</strong> or <strong>"Add to Home Screen"</strong></span>
                  </li>
                </ol>
              </div>
            )}
            <div className="pt-1">
              <p className="text-xs text-muted-foreground">
                Installed app gives you: full-screen mode, camera capture, voice recording, location, and offline drafts.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FeatureChip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <Badge variant="secondary" className="text-xs flex items-center gap-1 px-2 py-1">
      {icon}{label}
    </Badge>
  );
}
