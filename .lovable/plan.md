

## Fetch API Download Manager with Real Progress Tracking

### Problem
Currently, downloads open in a new tab (`window.open`) and fake progress by marking them "complete" after 1.5 seconds. The file never actually downloads through the app -- users see misleading status indicators.

### Solution
Replace the current approach with a **Fetch API + ReadableStream** download pipeline that:
1. Uses the `download-proxy` edge function to resolve the final URL and get content metadata (avoiding CORS issues with direct cross-origin fetch)
2. Fetches the file through the proxy or directly (depending on CORS), reading chunks via `ReadableStream`
3. Tracks real progress (bytes downloaded / total bytes), speed, and ETA
4. Assembles chunks into a `Blob` and triggers a save via a hidden `<a>` tag with the `download` attribute
5. Adds pause/cancel support and proper error handling

### Important Consideration
Since the download URLs are likely **cross-origin HTTP** servers, the browser will block a direct `fetch()` from the HTTPS app. To solve this, the `download-proxy` edge function will be extended to **stream the file body** back to the client (not just resolve the URL). This is the only reliable way to bypass CORS for downloads.

However, Supabase Edge Functions have execution time limits (~60s). For large files, we will use a **hybrid approach**:
- First, resolve the URL via the proxy to get the final direct URL
- Attempt a direct `fetch()` to that resolved URL
- If CORS blocks it, fall back to `window.open()` with proper user messaging

### Technical Plan

#### 1. Update `src/contexts/DownloadContext.tsx`
- Add an `AbortController` ref map to support canceling downloads
- Add `cancelDownload` to the context API
- Replace `window.open()` with an async `performDownload()` function:

```
async performDownload(id, url, filename):
  1. Call download-proxy edge function to resolve redirects & get content-length
  2. fetch(resolvedUrl) with the AbortController signal
  3. Get reader from response.body.getReader()
  4. Loop: read chunks, accumulate into array
     - Update state: downloadedBytes, totalBytes, progress percentage
     - Calculate speed = bytes since last update / time elapsed
     - Calculate ETA = remainingBytes / speed
  5. On complete: create Blob from chunks
     - Create object URL
     - Create hidden <a> with href=objectURL and download=filename
     - Click it programmatically, then revoke URL
     - Update status to 'complete'
  6. On error: update status to 'error' with message
     - If CORS error: fall back to window.open() approach
```

- Use `useRef` for the AbortController map (keyed by download ID) so cancellation works across renders
- Throttle state updates to every 500ms to avoid excessive re-renders during fast downloads

#### 2. Update `src/pages/Downloads.tsx`
- Show **real progress bar** with actual percentage (not pulsing placeholder)
- Display download speed (e.g., "2.5 MB/s")
- Display ETA (e.g., "~30s remaining")
- Show downloaded/total bytes (e.g., "150 MB / 500 MB")
- Add a **cancel/pause button** for active downloads (calls `cancelDownload`)
- Update status messages to reflect real states:
  - "Downloading... 45%" with speed and ETA
  - "Download complete" with file size
  - "Error: CORS blocked - opened in browser" for fallback cases

#### 3. Update context type and add `cancelDownload`
- Add `cancelDownload: (id: string) => void` to `DownloadContextType`
- Add `'cancelled'` to the status union type in `DownloadEntry`

#### 4. Files to modify
- `src/contexts/DownloadContext.tsx` -- core download logic rewrite
- `src/pages/Downloads.tsx` -- UI updates for real progress display

#### 5. Edge cases handled
- **CORS failure**: Catch TypeError from fetch, fall back to `window.open()`, update status to indicate browser download
- **No Content-Length header**: Show indeterminate progress (spinning) with bytes downloaded only
- **Large files**: Stream chunks without loading entire file into memory at once (ReadableStream handles this)
- **User navigates away**: Downloads continue as long as the React tree is mounted (DownloadProvider wraps the app)
- **Duplicate prevention**: Existing logic preserved -- skip if same movieId is already downloading

