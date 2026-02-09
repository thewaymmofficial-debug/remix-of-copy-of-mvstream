import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, range, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const targetUrl = url.searchParams.get("url");

    console.log("[download-proxy] Resolve request for:", targetUrl);

    if (!targetUrl) {
      return new Response(JSON.stringify({ error: "Missing 'url' parameter" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 1: Follow redirects manually using HEAD requests (fast, no body)
    let finalUrl = targetUrl;
    let currentUrl = targetUrl;
    const maxRedirects = 10;

    for (let i = 0; i < maxRedirects; i++) {
      console.log(`[download-proxy] Checking redirect (${i + 1}):`, currentUrl);

      // Use HEAD first to avoid downloading the body
      const timeoutSignal = AbortSignal.timeout(8000);
      let response: Response;
      try {
        response = await fetch(currentUrl, {
          method: "HEAD",
          redirect: "manual",
          signal: timeoutSignal,
        });
      } catch {
        // Some servers reject HEAD or timeout, try GET with manual redirect
        console.log("[download-proxy] HEAD failed, trying GET with manual redirect");
        const getSignal = AbortSignal.timeout(8000);
        response = await fetch(currentUrl, {
          method: "GET",
          redirect: "manual",
          signal: getSignal,
        });
        // Immediately discard the body
        await response.body?.cancel();
      }

      // If it's a redirect, follow it
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("Location");
        if (!location) {
          console.log("[download-proxy] Redirect without Location header");
          break;
        }
        await response.body?.cancel();
        currentUrl = location.startsWith("http") ? location : new URL(location, currentUrl).href;
        finalUrl = currentUrl;
        console.log("[download-proxy] Redirected to:", finalUrl);
        continue;
      }

      // Not a redirect — grab headers
      const contentLength = response.headers.get("Content-Length");
      const contentType = response.headers.get("Content-Type");
      await response.body?.cancel();

      console.log("[download-proxy] Final URL:", finalUrl);
      console.log("[download-proxy] Content-Length:", contentLength);

      return new Response(JSON.stringify({
        resolvedUrl: finalUrl,
        contentLength: contentLength ? parseInt(contentLength, 10) : null,
        contentType: contentType || "application/octet-stream",
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Exhausted redirects
    console.log("[download-proxy] Max redirects reached, using:", finalUrl);

    // Do a final HEAD to get content info
    try {
      const headRes = await fetch(finalUrl, { method: "HEAD" });
      const contentLength = headRes.headers.get("Content-Length");
      const contentType = headRes.headers.get("Content-Type");
      await headRes.body?.cancel();

      return new Response(JSON.stringify({
        resolvedUrl: finalUrl,
        contentLength: contentLength ? parseInt(contentLength, 10) : null,
        contentType: contentType || "application/octet-stream",
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch {
      return new Response(JSON.stringify({
        resolvedUrl: finalUrl,
        contentLength: null,
        contentType: "application/octet-stream",
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("[download-proxy] Error:", errMsg);
    return new Response(JSON.stringify({ error: errMsg || "Proxy fetch failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
