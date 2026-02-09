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
    const mode = url.searchParams.get("mode") || "resolve"; // "resolve" or "stream"

    console.log(`[download-proxy] ${mode} request for:`, targetUrl);

    if (!targetUrl) {
      return new Response(JSON.stringify({ error: "Missing 'url' parameter" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── STREAM MODE: pipe the file body through to the client ──
    if (mode === "stream") {
      console.log("[download-proxy] Streaming file from:", targetUrl);

      const rangeHeader = req.headers.get("range");
      const fetchHeaders: Record<string, string> = {};
      if (rangeHeader) {
        fetchHeaders["Range"] = rangeHeader;
      }

      const upstream = await fetch(targetUrl, {
        headers: fetchHeaders,
        redirect: "follow",
      });

      if (!upstream.ok && upstream.status !== 206) {
        console.error("[download-proxy] Upstream error:", upstream.status);
        return new Response(JSON.stringify({ error: `Upstream returned ${upstream.status}` }), {
          status: upstream.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Forward relevant headers
      const responseHeaders: Record<string, string> = { ...corsHeaders };
      const ct = upstream.headers.get("Content-Type");
      if (ct) responseHeaders["Content-Type"] = ct;
      const cl = upstream.headers.get("Content-Length");
      if (cl) responseHeaders["Content-Length"] = cl;
      const cr = upstream.headers.get("Content-Range");
      if (cr) responseHeaders["Content-Range"] = cr;
      const cd = upstream.headers.get("Content-Disposition");
      if (cd) responseHeaders["Content-Disposition"] = cd;

      // Access-Control-Expose-Headers so the browser can read Content-Length
      responseHeaders["Access-Control-Expose-Headers"] = "Content-Length, Content-Range, Content-Disposition";

      console.log("[download-proxy] Streaming started, Content-Length:", cl);

      return new Response(upstream.body, {
        status: upstream.status,
        headers: responseHeaders,
      });
    }

    // ── RESOLVE MODE (default): follow redirects and return final URL + metadata ──
    let finalUrl = targetUrl;
    let currentUrl = targetUrl;
    const maxRedirects = 10;

    for (let i = 0; i < maxRedirects; i++) {
      console.log(`[download-proxy] Checking redirect (${i + 1}):`, currentUrl);

      const timeoutSignal = AbortSignal.timeout(8000);
      let response: Response;
      try {
        response = await fetch(currentUrl, {
          method: "HEAD",
          redirect: "manual",
          signal: timeoutSignal,
        });
      } catch {
        console.log("[download-proxy] HEAD failed, trying GET with manual redirect");
        const getSignal = AbortSignal.timeout(8000);
        response = await fetch(currentUrl, {
          method: "GET",
          redirect: "manual",
          signal: getSignal,
        });
        await response.body?.cancel();
      }

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

    console.log("[download-proxy] Max redirects reached, using:", finalUrl);

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
