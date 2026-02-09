import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';


export interface DownloadEntry {
  id: string;
  movieId: string;
  title: string;
  posterUrl: string | null;
  year: number | null;
  resolution: string | null;
  fileSize: string | null;
  status: 'downloading' | 'complete' | 'error' | 'cancelled';
  progress: number;
  downloadedBytes: number;
  totalBytes: number;
  speed: number;
  eta: number;
  timestamp: number;
  url: string;
  error?: string;
}

interface DownloadContextType {
  downloads: DownloadEntry[];
  startDownload: (info: {
    movieId: string;
    title: string;
    posterUrl: string | null;
    year: number | null;
    resolution: string | null;
    fileSize: string | null;
    url: string;
  }) => void;
  cancelDownload: (id: string) => void;
  removeDownload: (id: string) => void;
  clearDownloads: () => void;
}

const DownloadContext = createContext<DownloadContextType | null>(null);

const STORAGE_KEY = 'cineverse-downloads';

function getStoredDownloads(): DownloadEntry[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as DownloadEntry[];
    // Reset any in-progress downloads from a previous session
    return parsed.map(d =>
      d.status === 'downloading' ? { ...d, status: 'error' as const, error: 'Download interrupted' } : d
    );
  } catch {
    return [];
  }
}

function saveToStorage(downloads: DownloadEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(downloads));
}

function makeFilename(title: string, year: number | null, resolution: string | null) {
  const y = year || 'XXXX';
  const r = resolution || 'HD';
  return `${title.replace(/\s+/g, '.')}.${y}.${r}.Web-Dl(cineverse).mkv`;
}

export function DownloadProvider({ children }: { children: React.ReactNode }) {
  const [downloads, setDownloads] = useState<DownloadEntry[]>(getStoredDownloads);
  const abortControllers = useRef<Map<string, AbortController>>(new Map());
  const throttleTimers = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    saveToStorage(downloads);
  }, [downloads]);

  const updateEntry = useCallback((id: string, patch: Partial<DownloadEntry>) => {
    setDownloads(prev => prev.map(d => d.id === id ? { ...d, ...patch } : d));
  }, []);

  // Throttled update to avoid excessive re-renders during fast downloads
  const throttledUpdate = useCallback((id: string, patch: Partial<DownloadEntry>) => {
    const now = Date.now();
    const last = throttleTimers.current.get(id) || 0;
    if (now - last >= 500) {
      throttleTimers.current.set(id, now);
      updateEntry(id, patch);
    }
  }, [updateEntry]);

  const performDownload = useCallback(async (id: string, url: string, filename: string) => {
    const controller = new AbortController();
    abortControllers.current.set(id, controller);

    try {
      // Step 1: Resolve redirects and get content info via edge function
      const proxyUrl = `https://icnfjixjohbxjxqbnnac.supabase.co/functions/v1/download-proxy?url=${encodeURIComponent(url)}`;
      const proxyRes = await fetch(proxyUrl, {
        headers: {
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljbmZqaXhqb2hieGp4cWJubmFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzMTYyNjMsImV4cCI6MjA4NTg5MjI2M30.aiU8qAgb1wicSC17EneEs4qAlLtFZbYeyMnhi4NHI7Y',
        },
        signal: controller.signal,
      });

      if (!proxyRes.ok) {
        throw new Error(`Proxy error: ${proxyRes.status}`);
      }

      const proxyData = await proxyRes.json();
      const resolvedUrl: string = proxyData.resolvedUrl;
      const totalBytes: number = proxyData.contentLength || 0;

      if (totalBytes > 0) {
        updateEntry(id, { totalBytes });
      }

      // Step 2: Attempt direct fetch to the resolved URL
      let response: Response;
      let usedFallback = false;

      try {
        response = await fetch(resolvedUrl, { signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
      } catch (fetchErr: unknown) {
        // CORS or network error — fall back to window.open
        if (controller.signal.aborted) throw fetchErr;

        usedFallback = true;
        window.open(resolvedUrl, '_blank', 'noopener,noreferrer');

        updateEntry(id, {
          status: 'complete',
          progress: 100,
          downloadedBytes: totalBytes,
          error: undefined,
        });

        toast.success('Download started', {
          description: 'Opened in browser — check your downloads folder.',
          duration: 4000,
        });

        abortControllers.current.delete(id);
        return;
      }

      if (usedFallback) return;

      // Step 3: Stream the response body and track progress
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('ReadableStream not supported');
      }

      const actualTotal = parseInt(response.headers.get('Content-Length') || '0', 10) || totalBytes;
      if (actualTotal > 0) {
        updateEntry(id, { totalBytes: actualTotal });
      }

      const chunks: ArrayBuffer[] = [];
      let loaded = 0;
      let lastTime = Date.now();
      let lastLoaded = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value.buffer as ArrayBuffer);
        loaded += value.length;

        const now = Date.now();
        const elapsed = (now - lastTime) / 1000;

        let speed = 0;
        let eta = 0;
        if (elapsed > 0.3) {
          speed = (loaded - lastLoaded) / elapsed;
          lastTime = now;
          lastLoaded = loaded;
          const remaining = actualTotal > 0 ? actualTotal - loaded : 0;
          eta = speed > 0 ? remaining / speed : 0;
        }

        const progress = actualTotal > 0 ? Math.round((loaded / actualTotal) * 100) : 0;

        throttledUpdate(id, {
          downloadedBytes: loaded,
          progress,
          speed,
          eta,
        });
      }

      // Step 4: Create blob and trigger save
      const blob = new Blob(chunks);
      const objectUrl = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();

      // Cleanup
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(objectUrl);
      }, 1000);

      updateEntry(id, {
        status: 'complete',
        progress: 100,
        downloadedBytes: loaded,
        totalBytes: actualTotal || loaded,
        speed: 0,
        eta: 0,
      });

      toast.success('Download complete', {
        description: filename,
        duration: 4000,
      });
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        updateEntry(id, { status: 'cancelled', speed: 0, eta: 0 });
        return;
      }

      const message = err instanceof Error ? err.message : 'Download failed';
      console.error('[DownloadManager] Error:', message);
      updateEntry(id, { status: 'error', error: message, speed: 0, eta: 0 });

      toast.error('Download failed', {
        description: message,
        duration: 5000,
      });
    } finally {
      abortControllers.current.delete(id);
      throttleTimers.current.delete(id);
    }
  }, [updateEntry, throttledUpdate]);

  const startDownload = useCallback((info: {
    movieId: string;
    title: string;
    posterUrl: string | null;
    year: number | null;
    resolution: string | null;
    fileSize: string | null;
    url: string;
  }) => {
    // Don't add duplicate entries for the same movie
    const existing = downloads.find(d => d.movieId === info.movieId && d.status === 'downloading');
    if (existing) return;

    // Remove previous error/cancelled entry for this movie if retrying
    setDownloads(prev => prev.filter(d => !(d.movieId === info.movieId && (d.status === 'error' || d.status === 'cancelled'))));

    const id = `${info.movieId}-${Date.now()}`;
    const filename = makeFilename(info.title, info.year, info.resolution);

    const newEntry: DownloadEntry = {
      id,
      movieId: info.movieId,
      title: info.title,
      posterUrl: info.posterUrl,
      year: info.year,
      resolution: info.resolution,
      fileSize: info.fileSize,
      status: 'downloading',
      progress: 0,
      downloadedBytes: 0,
      totalBytes: 0,
      speed: 0,
      eta: 0,
      timestamp: Date.now(),
      url: info.url,
    };

    setDownloads(prev => [newEntry, ...prev]);

    toast.success('Download started', {
      description: 'Fetching file...',
      duration: 3000,
    });

    // Start the actual download
    performDownload(id, info.url, filename);
  }, [downloads, performDownload]);

  const cancelDownload = useCallback((id: string) => {
    const controller = abortControllers.current.get(id);
    if (controller) {
      controller.abort();
    }
    updateEntry(id, { status: 'cancelled', speed: 0, eta: 0 });
  }, [updateEntry]);

  const removeDownload = useCallback((id: string) => {
    // Cancel if still running
    const controller = abortControllers.current.get(id);
    if (controller) {
      controller.abort();
      abortControllers.current.delete(id);
    }
    setDownloads(prev => prev.filter(d => d.id !== id));
  }, []);

  const clearDownloads = useCallback(() => {
    // Cancel all active downloads
    abortControllers.current.forEach(c => c.abort());
    abortControllers.current.clear();
    setDownloads([]);
  }, []);

  return (
    <DownloadContext.Provider value={{
      downloads,
      startDownload,
      cancelDownload,
      removeDownload,
      clearDownloads,
    }}>
      {children}
    </DownloadContext.Provider>
  );
}

export function useDownloadManager() {
  const ctx = useContext(DownloadContext);
  if (!ctx) throw new Error('useDownloadManager must be used within DownloadProvider');
  return ctx;
}
