
## Simplify Download System: Direct Link Redirect

### What Changes
Remove the entire in-app download manager (proxy, progress tracking, streaming, etc.) and replace it with a simple redirect: when users click "Download", open the admin-configured download URL directly in the browser.

### Files to Delete
- `src/contexts/DownloadContext.tsx` -- the entire download manager context
- `src/hooks/useDownloads.tsx` -- re-export wrapper
- `src/pages/Downloads.tsx` -- the downloads page
- `supabase/functions/download-proxy/index.ts` -- the edge function

### Files to Modify

1. **`src/components/ServerDrawer.tsx`**
   - Remove import and usage of `useDownloadManager`
   - In download mode, simply call `window.open(url, '_blank')` to redirect the user to the download link directly
   - Keep play mode logic unchanged

2. **`src/components/SeasonEpisodeList.tsx`**
   - Update episode download handler: instead of opening ServerDrawer for download, directly open the episode's download URL (`download_url`, `telegram_url`, or `mega_url`) via `window.open()`
   - Or keep the ServerDrawer but it will now just redirect (since ServerDrawer is simplified)

3. **`src/App.tsx`**
   - Remove `DownloadProvider` import and wrapper
   - Remove `Downloads` page import and `/downloads` route

4. **`src/components/MobileBottomNav.tsx`**
   - Remove the Downloads link/icon from the bottom navigation (if it links to `/downloads`)

### How It Works After the Change
- User clicks "Download" on a movie -> ServerDrawer opens showing available servers (Main Server, Telegram, MEGA)
- User picks a server -> browser navigates directly to that URL, triggering the native download
- No in-app progress tracking, no proxy, no edge function involved

### Technical Details
- The ServerDrawer `handleOpen` for `type === 'download'` will simply do `window.open(url, '_blank', 'noopener,noreferrer')` -- same as it already does for Telegram/MEGA links
- The edge function `download-proxy` will be deleted from both code and deployment
- localStorage key `cineverse-downloads` will no longer be used
