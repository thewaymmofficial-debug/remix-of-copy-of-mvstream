import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

export interface DownloadItem {
  id: string;
  title: string;
  url: string;
  posterUrl: string | null;
  status: 'downloading' | 'paused' | 'completed' | 'error';
  progress: number; // 0-100
  downloaded: number; // bytes
  total: number; // bytes
  speed: number; // bytes per second
  eta: number; // seconds remaining
  error?: string;
}

interface DownloadContextType {
  downloads: DownloadItem[];
  startDownload: (item: { id: string; title: string; url: string; posterUrl: string | null }) => void;
  pauseDownload: (id: string) => void;
  resumeDownload: (id: string) => void;
  cancelDownload: (id: string) => void;
  retryDownload: (id: string) => void;
  clearCompleted: () => void;
}

const DownloadContext = createContext<DownloadContextType | null>(null);

export function useDownloadManager() {
  const ctx = useContext(DownloadContext);
  if (!ctx) throw new Error('useDownloadManager must be used within DownloadProvider');
  return ctx;
}

const PROXY_URL = 'https://icnfjixjohbxjxqbnnac.supabase.co/functions/v1/download-proxy';

export function DownloadProvider({ children }: { children: React.ReactNode }) {
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const controllersRef = useRef<Map<string, AbortController>>(new Map());
  const downloadMetaRef = useRef<Map<string, { startTime: number; startBytes: number }>>(new Map());

  const updateItem = useCallback((id: string, patch: Partial<DownloadItem>) => {
    setDownloads(prev => prev.map(d => d.id === id ? { ...d, ...patch } : d));
  }, []);

  const doFetch = useCallback(async (item: { id: string; title: string; url: string; posterUrl: string | null }, resumeFrom = 0) => {
    const controller = new AbortController();
    controllersRef.current.set(item.id, controller);
    downloadMetaRef.current.set(item.id, { startTime: Date.now(), startBytes: resumeFrom });

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljbmZqaXhqb2hieGp4cWJubmFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzMTYyNjMsImV4cCI6MjA4NTg5MjI2M30.aiU8qAgb1wicSC17EneEs4qAlLtFZbYeyMnhi4NHI7Y',
      };
      if (resumeFrom > 0) {
        headers['Range'] = `bytes=${resumeFrom}-`;
      }

      const resp = await fetch(PROXY_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({ url: item.url }),
        signal: controller.signal,
      });

      if (!resp.ok && resp.status !== 206) {
        const errText = await resp.text();
        throw new Error(`Proxy error ${resp.status}: ${errText}`);
      }

      const contentLength = parseInt(resp.headers.get('content-length') || '0', 10);
      const total = resumeFrom + contentLength;

      updateItem(item.id, { total, status: 'downloading' });

      const reader = resp.body?.getReader();
      if (!reader) throw new Error('No response body');

      const chunks: Uint8Array[] = [];
      let received = resumeFrom;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        received += value.length;

        const meta = downloadMetaRef.current.get(item.id);
        const elapsed = (Date.now() - (meta?.startTime || Date.now())) / 1000;
        const bytesThisSession = received - (meta?.startBytes || 0);
        const speed = elapsed > 0 ? bytesThisSession / elapsed : 0;
        const remaining = total > 0 ? (total - received) / Math.max(speed, 1) : 0;
        const progress = total > 0 ? (received / total) * 100 : 0;

        updateItem(item.id, {
          downloaded: received,
          total,
          progress: Math.min(progress, 100),
          speed,
          eta: remaining,
        });
      }

      // Combine chunks and trigger browser download
      const blob = new Blob(chunks as BlobPart[]);
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = item.title.replace(/[^a-zA-Z0-9._\-\s]/g, '') || 'download';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);

      updateItem(item.id, { status: 'completed', progress: 100, speed: 0, eta: 0 });
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // Paused or cancelled — don't update to error
        return;
      }
      console.error('[DownloadManager] Error:', err);
      updateItem(item.id, { status: 'error', error: err.message, speed: 0, eta: 0 });
    } finally {
      controllersRef.current.delete(item.id);
      downloadMetaRef.current.delete(item.id);
    }
  }, [updateItem]);

  const startDownload = useCallback((item: { id: string; title: string; url: string; posterUrl: string | null }) => {
    // Check if already exists
    setDownloads(prev => {
      const exists = prev.find(d => d.id === item.id);
      if (exists && exists.status === 'downloading') return prev;
      if (exists) {
        return prev.map(d => d.id === item.id
          ? { ...d, status: 'downloading' as const, progress: 0, downloaded: 0, total: 0, speed: 0, eta: 0, error: undefined }
          : d
        );
      }
      return [...prev, {
        ...item,
        status: 'downloading' as const,
        progress: 0,
        downloaded: 0,
        total: 0,
        speed: 0,
        eta: 0,
      }];
    });
    doFetch(item);
  }, [doFetch]);

  const pauseDownload = useCallback((id: string) => {
    const controller = controllersRef.current.get(id);
    if (controller) controller.abort();
    updateItem(id, { status: 'paused', speed: 0, eta: 0 });
  }, [updateItem]);

  const resumeDownload = useCallback((id: string) => {
    setDownloads(prev => {
      const item = prev.find(d => d.id === id);
      if (!item || item.status !== 'paused') return prev;
      updateItem(id, { status: 'downloading' });
      doFetch({ id: item.id, title: item.title, url: item.url, posterUrl: item.posterUrl }, item.downloaded);
      return prev;
    });
  }, [doFetch, updateItem]);

  const cancelDownload = useCallback((id: string) => {
    const controller = controllersRef.current.get(id);
    if (controller) controller.abort();
    setDownloads(prev => prev.filter(d => d.id !== id));
  }, []);

  const retryDownload = useCallback((id: string) => {
    setDownloads(prev => {
      const item = prev.find(d => d.id === id);
      if (!item) return prev;
      startDownload({ id: item.id, title: item.title, url: item.url, posterUrl: item.posterUrl });
      return prev;
    });
  }, [startDownload]);

  const clearCompleted = useCallback(() => {
    setDownloads(prev => prev.filter(d => d.status !== 'completed'));
  }, []);

  return (
    <DownloadContext.Provider value={{ downloads, startDownload, pauseDownload, resumeDownload, cancelDownload, retryDownload, clearCompleted }}>
      {children}
    </DownloadContext.Provider>
  );
}
