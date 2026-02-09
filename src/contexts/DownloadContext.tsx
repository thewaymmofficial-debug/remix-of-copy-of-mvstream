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

function triggerNativeDownload(url: string, filename: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => document.body.removeChild(a), 1000);
  toast.success('Download started', { description: 'Check your browser downloads.', duration: 4000 });
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

  const PROXY_BASE = 'https://icnfjixjohbxjxqbnnac.supabase.co/functions/v1/download-proxy';
  const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljbmZqaXhqb2hieGp4cWJubmFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzMTYyNjMsImV4cCI6MjA4NTg5MjI2M30.aiU8qAgb1wicSC17EneEs4qAlLtFZbYeyMnhi4NHI7Y';

  const performDownload = useCallback(async (id: string, url: string, filename: string) => {
    const controller = new AbortController();
    abortControllers.current.set(id, controller);

    try {
      // Step 1: Resolve redirects and get content info
      let resolvedUrl = url;
      let totalBytes = 0;

      try {
        const proxyUrl = `${PROXY_BASE}?url=${encodeURIComponent(url)}`;
        const timeoutController = new AbortController();
        const timeout = setTimeout(() => timeoutController.abort(), 15000);

        const proxyRes = await fetch(proxyUrl, {
          headers: { 'apikey': ANON_KEY },
          signal: timeoutController.signal,
        });
        clearTimeout(timeout);

        if (proxyRes.ok) {
          const proxyData = await proxyRes.json();
          resolvedUrl = proxyData.resolvedUrl || url;
          totalBytes = proxyData.contentLength || 0;
        }
      } catch (proxyErr) {
        console.warn('[DownloadManager] Resolve failed, using original URL:', proxyErr);
      }

      if (totalBytes > 0) {
        updateEntry(id, { totalBytes });
      }

      // Step 2: Determine fetch URL
      // For HTTP URLs, stream through our HTTPS proxy to avoid mixed-content blocking
      const isHttpUrl = resolvedUrl.startsWith('http://');
      const fetchUrl = isHttpUrl
        ? `${PROXY_BASE}?mode=stream&url=${encodeURIComponent(resolvedUrl)}`
        : resolvedUrl;

      const fetchHeaders: Record<string, string> = {};
      if (isHttpUrl) {
        fetchHeaders['apikey'] = ANON_KEY;
      }

      let response: Response;
      try {
        response = await fetch(fetchUrl, {
          signal: controller.signal,
          headers: fetchHeaders,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
      } catch (fetchErr: unknown) {
        if (controller.signal.aborted) throw fetchErr;
        triggerNativeDownload(resolvedUrl, filename);
        updateEntry(id, { status: 'complete', progress: 100, downloadedBytes: totalBytes });
        abortControllers.current.delete(id);
        return;
      }

      // Step 3: Stream body with progress
      const reader = response.body?.getReader();
      if (!reader) throw new Error('ReadableStream not supported');

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
        throttledUpdate(id, { downloadedBytes: loaded, progress, speed, eta });
      }

      // Step 4: Save file locally
      const blob = new Blob(chunks);
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(objectUrl); }, 1000);

      updateEntry(id, {
        status: 'complete', progress: 100,
        downloadedBytes: loaded, totalBytes: actualTotal || loaded,
        speed: 0, eta: 0,
      });

      toast.success('Download complete', { description: filename, duration: 4000 });
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        updateEntry(id, { status: 'cancelled', speed: 0, eta: 0 });
        return;
      }
      // If streaming failed (e.g. edge function timeout for large files),
      // fall back to native browser download
      console.warn('[DownloadManager] Stream failed, falling back to native download:', err);
      triggerNativeDownload(url, filename);
      updateEntry(id, { status: 'complete', progress: 100, speed: 0, eta: 0 });
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
