import { Server, ChevronRight, Play, ExternalLink, Download } from 'lucide-react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { useLanguage } from '@/contexts/LanguageContext';
import { useDownloadManager } from '@/contexts/DownloadContext';
import { useNavigate } from 'react-router-dom';

interface ServerDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  streamUrl?: string | null;
  telegramUrl?: string | null;
  megaUrl?: string | null;
  downloadUrl?: string | null;
  type: 'play' | 'download';
  movieInfo?: {
    movieId: string;
    title: string;
    posterUrl: string | null;
    year: number | null;
    resolution: string | null;
    fileSize: string | null;
  };
}

export function ServerDrawer({
  open,
  onOpenChange,
  streamUrl,
  telegramUrl,
  megaUrl,
  downloadUrl,
  type,
  movieInfo,
}: ServerDrawerProps) {
  const { t } = useLanguage();
  const { startDownload } = useDownloadManager();
  const navigate = useNavigate();

  const handleOpen = (url: string, useInAppPlayer: boolean = false) => {
    onOpenChange(false);
    
    // Download mode - trigger native browser download
    if (type === 'download' && movieInfo) {
      startDownload({
        movieId: movieInfo.movieId,
        title: movieInfo.title,
        posterUrl: movieInfo.posterUrl,
        year: movieInfo.year,
        resolution: movieInfo.resolution,
        fileSize: movieInfo.fileSize,
        url,
      });
      // Note: startDownload will redirect to the download URL
      // No need to navigate - browser handles the download
    } else if (useInAppPlayer && type === 'play') {
      // Play mode with in-app redirect
      const title = movieInfo?.title || 'Video';
      navigate(`/watch?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`);
    } else {
      // External link (Telegram, MEGA, etc.)
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const servers = type === 'download'
    ? [
        // In download mode: only show actual download sources, not the stream/watch page
        ...(downloadUrl ? [{ name: 'Main Server', url: downloadUrl, icon: 'download' as const, inApp: false }] : []),
        ...(telegramUrl ? [{ name: 'Telegram', url: telegramUrl, icon: 'telegram' as const, inApp: false }] : []),
        ...(megaUrl ? [{ name: 'MEGA', url: megaUrl, icon: 'mega' as const, inApp: false }] : []),
      ]
    : [
        // In play mode: show streaming sources
        ...(streamUrl ? [{ name: 'Main Server', url: streamUrl, icon: 'main' as const, inApp: true }] : []),
        ...(downloadUrl ? [{ name: 'Direct Download', url: downloadUrl, icon: 'download' as const, inApp: false }] : []),
        ...(telegramUrl ? [{ name: 'Telegram', url: telegramUrl, icon: 'telegram' as const, inApp: false }] : []),
        ...(megaUrl ? [{ name: 'MEGA', url: megaUrl, icon: 'mega' as const, inApp: false }] : []),
      ];

  if (servers.length === 0) return null;

  const title = type === 'play' ? t('chooseServer') : t('chooseDownloader');
  const ActionIcon = type === 'play' ? Play : Download;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="bg-background">
        <DrawerHeader className="text-left">
          <DrawerTitle className="text-2xl font-bold text-foreground">
            {title}
          </DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-8 space-y-3">
          {servers.map((server) => (
            <button
              key={server.name}
              onClick={() => handleOpen(server.url, server.inApp)}
              className="w-full flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Server className="w-6 h-6 text-primary" />
              </div>
              <span className="flex-1 text-left font-medium text-foreground text-lg">
                {server.name}
              </span>
              {type === 'play' ? (
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              ) : (
                <ExternalLink className="w-5 h-5 text-muted-foreground" />
              )}
            </button>
          ))}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
