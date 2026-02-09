import { useDownloadManager, DownloadItem } from '@/contexts/DownloadContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Navbar } from '@/components/Navbar';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Pause, Play, X, RotateCcw, Trash2, Download, CheckCircle, AlertCircle } from 'lucide-react';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatEta(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return '--';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

function DownloadCard({ item, onPause, onResume, onCancel, onRetry }: {
  item: DownloadItem;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onRetry: () => void;
}) {
  const statusIcon = {
    downloading: <Download className="w-5 h-5 text-primary animate-pulse" />,
    paused: <Pause className="w-5 h-5 text-yellow-500" />,
    completed: <CheckCircle className="w-5 h-5 text-green-500" />,
    error: <AlertCircle className="w-5 h-5 text-destructive" />,
  }[item.status];

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-start gap-3">
        {/* Poster */}
        {item.posterUrl && (
          <img src={item.posterUrl} alt="" className="w-12 h-16 rounded-lg object-cover shrink-0" />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {statusIcon}
            <h3 className="font-semibold text-foreground text-sm truncate">{item.title}</h3>
          </div>

          {/* Progress bar */}
          {(item.status === 'downloading' || item.status === 'paused') && (
            <div className="mt-2 space-y-1">
              <Progress value={item.progress} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{formatBytes(item.downloaded)} / {item.total > 0 ? formatBytes(item.total) : '...'}</span>
                <span>{item.progress.toFixed(1)}%</span>
              </div>
            </div>
          )}

          {/* Speed & ETA */}
          {item.status === 'downloading' && (
            <div className="flex gap-4 text-xs text-muted-foreground mt-1">
              <span>⚡ {formatBytes(item.speed)}/s</span>
              <span>⏱ {formatEta(item.eta)}</span>
            </div>
          )}

          {item.status === 'completed' && (
            <p className="text-xs text-green-500 mt-1">Download complete — {formatBytes(item.total)}</p>
          )}

          {item.status === 'error' && (
            <p className="text-xs text-destructive mt-1">{item.error || 'Download failed'}</p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 justify-end">
        {item.status === 'downloading' && (
          <>
            <Button variant="outline" size="sm" onClick={onPause} className="gap-1">
              <Pause className="w-3.5 h-3.5" /> Pause
            </Button>
            <Button variant="outline" size="sm" onClick={onCancel} className="gap-1 text-destructive">
              <X className="w-3.5 h-3.5" /> Cancel
            </Button>
          </>
        )}
        {item.status === 'paused' && (
          <>
            <Button variant="outline" size="sm" onClick={onResume} className="gap-1">
              <Play className="w-3.5 h-3.5" /> Resume
            </Button>
            <Button variant="outline" size="sm" onClick={onCancel} className="gap-1 text-destructive">
              <X className="w-3.5 h-3.5" /> Cancel
            </Button>
          </>
        )}
        {item.status === 'error' && (
          <Button variant="outline" size="sm" onClick={onRetry} className="gap-1">
            <RotateCcw className="w-3.5 h-3.5" /> Retry
          </Button>
        )}
      </div>
    </div>
  );
}

export default function Downloads() {
  const { downloads, pauseDownload, resumeDownload, cancelDownload, retryDownload, clearCompleted } = useDownloadManager();

  const hasCompleted = downloads.some(d => d.status === 'completed');

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container max-w-2xl mx-auto px-4 pt-20 pb-24">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-foreground">Downloads</h1>
          {hasCompleted && (
            <Button variant="ghost" size="sm" onClick={clearCompleted} className="gap-1 text-muted-foreground">
              <Trash2 className="w-4 h-4" /> Clear completed
            </Button>
          )}
        </div>

        {downloads.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Download className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No active downloads</p>
          </div>
        ) : (
          <div className="space-y-3">
            {downloads.map(item => (
              <DownloadCard
                key={item.id}
                item={item}
                onPause={() => pauseDownload(item.id)}
                onResume={() => resumeDownload(item.id)}
                onCancel={() => cancelDownload(item.id)}
                onRetry={() => retryDownload(item.id)}
              />
            ))}
          </div>
        )}
      </div>
      <MobileBottomNav />
    </div>
  );
}
