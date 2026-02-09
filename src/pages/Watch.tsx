import { useSearchParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { ExternalLink, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Watch() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [attempted, setAttempted] = useState(false);

  const url = searchParams.get('url') || '';
  const title = searchParams.get('title') || 'Video';

  useEffect(() => {
    if (!url) {
      navigate('/', { replace: true });
      return;
    }

    // Try to open in new tab immediately (works better with HTTP URLs from HTTPS)
    // Using a slight delay to ensure the page renders first
    const timer = setTimeout(() => {
      window.open(url, '_blank', 'noopener,noreferrer');
      setAttempted(true);
    }, 100);

    return () => clearTimeout(timer);
  }, [url, navigate]);

  const handleManualOpen = () => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  if (!url) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md space-y-6">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
          <Play className="w-8 h-8 text-primary" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">
            {attempted 
              ? "The player should have opened in a new tab. If it didn't, tap the button below."
              : "Opening player..."}
          </p>
        </div>

        <div className="space-y-3">
          <Button 
            onClick={handleManualOpen}
            className="w-full gap-2"
            size="lg"
          >
            <ExternalLink className="w-4 h-4" />
            Open Player
          </Button>
          
          <Button 
            onClick={handleGoBack}
            variant="outline"
            className="w-full"
          >
            Go Back
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          The video plays on an external server for best compatibility.
        </p>
      </div>
    </div>
  );
}
