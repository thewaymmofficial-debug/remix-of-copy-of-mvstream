import { Server, ChevronRight, Play, ExternalLink, Download } from 'lucide-react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

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
  const navigate = useNavigate();

  const handleOpen = (url: string, useInAppPlayer: boolean = false) => {
    onOpenChange(false);
    
    if (useInAppPlayer && type === 'play') {
      const title = movieInfo?.title || 'Video';
      navigate(`/watch?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`);
    } else if (type === 'download') {
      // Direct browser download — bypasses CORS, uses native download manager
      toast.success('Download started', { description: 'Check your browser downloads.' });
      window.location.href = url;
    } else {
      // External links open in new tab
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const servers = type === 'download'
    ? [
        ...(downloadUrl ? [{ name: 'Main Server', url: downloadUrl, icon: 'download' as const, inApp: false }] : []),
        ...(telegramUrl ? [{ name: 'Telegram', url: telegramUrl, icon: 'telegram' as const, inApp: false }] : []),
        ...(megaUrl ? [{ name: 'MEGA', url: megaUrl, icon: 'mega' as const, inApp: false }] : []),
      ]
    : [
        ...(streamUrl ? [{ name: 'Main Server', url: streamUrl, icon: 'main' as const, inApp: true }] : []),
        ...(telegramUrl ? [{ name: 'Telegram', url: telegramUrl, icon: 'telegram' as const, inApp: false }] : []),
        ...(megaUrl ? [{ name: 'MEGA', url: megaUrl, icon: 'mega' as const, inApp: false }] : []),
      ];

  if (servers.length === 0) return null;

  const title = type === 'play' ? t('chooseServer') : t('chooseDownloader');

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
                <Download className="w-5 h-5 text-muted-foreground" />
              )}
            </button>
          ))}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
