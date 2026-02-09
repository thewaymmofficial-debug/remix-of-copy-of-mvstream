import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Trash2, Sun, Moon, AlertCircle, RotateCcw, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useDownloadManager } from '@/contexts/DownloadContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from 'next-themes';
import { MobileBottomNav } from '@/components/MobileBottomNav';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

function formatFilename(title: string, year: number | null, resolution: string | null) {
  const y = year || 'XXXX';
  const r = resolution || 'HD';
  return `${title.replace(/\s+/g, '.')}.${y}.${r}.Web-Dl(cineverse).mkv`;
}

export default function Downloads() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { theme, setTheme } = useTheme();
  const { downloads, removeDownload, clearDownloads, startDownload } = useDownloadManager();

  return (
    <div className="min-h-screen bg-background mobile-nav-spacing">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background border-b border-border">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/')}
              className="h-9 w-9"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-lg font-bold text-foreground">{t('downloadManager')}</h1>
          </div>
          <div className="flex items-center gap-1">
            {downloads.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={clearDownloads}
                className="h-9 w-9 text-destructive hover:text-destructive"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="h-9 w-9"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Downloads list */}
      <div className="px-4 py-4 space-y-3">
        {downloads.length === 0 ? (
          <div className="text-center py-20">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">{t('noDownloads')}</p>
          </div>
        ) : (
          downloads.map((dl) => (
            <div
              key={dl.id}
              className="p-4 rounded-xl bg-card border border-border"
            >
              <div className="flex items-start gap-3">
                {/* File icon */}
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <FileText className="w-5 h-5 text-primary" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground leading-snug break-all">
                    {formatFilename(dl.title, dl.year, dl.resolution)}
                  </p>

                  {/* Size info */}
                  <p className="text-xs text-muted-foreground mt-1">
                    {dl.totalBytes > 0
                      ? formatBytes(dl.totalBytes)
                      : dl.fileSize || 'Waiting...'}
                  </p>

                  {/* Progress bar - hidden since we can't track browser downloads */}
                  {dl.status === 'downloading' && (
                    <Progress value={50} className="h-1.5 mt-2 animate-pulse" />
                  )}

                  {/* Status row */}
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-xs text-muted-foreground">
                      {dl.status === 'downloading'
                        ? 'Starting download...'
                        : dl.status === 'complete'
                          ? 'Sent to browser - check your downloads'
                          : dl.status === 'error'
                            ? 'Error'
                            : ''}
                    </span>
                  </div>
                </div>

                {/* Action button */}
                <div className="flex flex-col gap-1 flex-shrink-0">
                  {dl.status === 'error' && (
                    <button
                      onClick={() => startDownload({
                        movieId: dl.movieId,
                        title: dl.title,
                        posterUrl: dl.posterUrl,
                        year: dl.year,
                        resolution: dl.resolution,
                        fileSize: dl.fileSize,
                        url: dl.url,
                      })}
                      className="w-9 h-9 rounded-full bg-destructive/10 flex items-center justify-center hover:bg-destructive/20 transition-colors"
                      title="Retry"
                    >
                      <RotateCcw className="w-4 h-4 text-destructive" />
                    </button>
                  )}
                  {dl.status === 'complete' && (
                    <button
                      onClick={() => window.open(dl.url, '_blank')}
                      className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors"
                      title="Download again"
                    >
                      <Download className="w-4 h-4 text-primary" />
                    </button>
                  )}
                  <button
                    onClick={() => removeDownload(dl.id)}
                    className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-destructive/10 transition-colors"
                    title="Remove"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </button>
                </div>
              </div>

              {/* Error message */}
              {dl.status === 'error' && dl.error && (
                <div className="flex items-center gap-2 mt-2 text-xs text-destructive">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{dl.error}</span>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <MobileBottomNav />
    </div>
  );
}
