import { useSearchParams, useNavigate } from 'react-router-dom';
import { useRef, useState, useEffect } from 'react';
import { ArrowLeft, Maximize, Minimize, RotateCcw, ExternalLink } from 'lucide-react';
import { useFullscreenLandscape } from '@/hooks/useFullscreenLandscape';

export default function Watch() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const url = searchParams.get('url') || '';
  const title = searchParams.get('title') || 'Video';

  const { needsCssRotation, isFullscreen } = useFullscreenLandscape(containerRef);

  useEffect(() => {
    if (!url) {
      navigate('/', { replace: true });
    }
  }, [url, navigate]);

  const handleGoBack = () => {
    // Exit fullscreen first if active
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    navigate(-1);
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await containerRef.current.requestFullscreen();
      }
    } catch (e) {
      console.log('Fullscreen toggle failed:', e);
    }
  };

  const handleIframeLoad = () => {
    setLoading(false);
  };

  const handleIframeError = () => {
    setLoading(false);
    setError(true);
  };

  const handleOpenExternal = () => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleRetry = () => {
    setLoading(true);
    setError(false);
    if (iframeRef.current) {
      iframeRef.current.src = url;
    }
  };

  if (!url) return null;

  // CSS rotation styles for portrait fallback
  const rotationStyles = needsCssRotation ? {
    transform: 'rotate(90deg)',
    transformOrigin: 'center center',
    width: '100vh',
    height: '100vw',
    position: 'fixed' as const,
    top: '50%',
    left: '50%',
    marginTop: 'calc(-50vw)',
    marginLeft: 'calc(-50vh)',
  } : {};

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-black flex flex-col"
      style={rotationStyles}
    >
      {/* Header overlay - shows on tap/hover */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent p-4 flex items-center justify-between">
        <button
          onClick={handleGoBack}
          className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        
        <h1 className="text-white font-medium text-sm truncate max-w-[50%]">
          {title}
        </h1>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenExternal}
            className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors"
            title="Open in new tab"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
          <button
            onClick={toggleFullscreen}
            className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors"
          >
            {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Loading overlay */}
      {loading && !error && (
        <div className="absolute inset-0 z-5 bg-black flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-white/70 text-sm">Loading player...</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 z-5 bg-black flex items-center justify-center p-6">
          <div className="flex flex-col items-center gap-4 text-center max-w-sm">
            <p className="text-white text-lg font-medium">Unable to load player</p>
            <p className="text-white/60 text-sm">
              The video may not support embedding. Try opening it externally.
            </p>
            <div className="flex gap-3 mt-2">
              <button
                onClick={handleRetry}
                className="px-4 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Retry
              </button>
              <button
                onClick={handleOpenExternal}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Open External
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Video iframe - embeds the streaming server's player */}
      <iframe
        ref={iframeRef}
        src={url}
        className="flex-1 w-full h-full border-0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
        onLoad={handleIframeLoad}
        onError={handleIframeError}
        style={{ display: error ? 'none' : 'block' }}
      />
    </div>
  );
}
