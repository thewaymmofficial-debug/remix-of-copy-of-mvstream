import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, range",
  "Access-Control-Expose-Headers":
    "content-length, content-range, accept-ranges, content-disposition, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // GET ?url= → 302 redirect (used by download buttons to bypass mixed-content)
    if (req.method === "GET") {
      const reqUrl = new URL(req.url);
      const target = reqUrl.searchParams.get("url");
      if (target) {
        console.log(`[download-proxy] Redirecting to: ${target}`);
        return new Response(null, {
          status: 302,
          headers: { ...corsHeaders, Location: target },
        });
      }
      return new Response("Missing url parameter", {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({ error: "Missing url" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[download-proxy] Fetching: ${url}`);

    // Forward Range header for pause/resume
    const fetchHeaders: Record<string, string> = {};
    const rangeHeader = req.headers.get("range");
    if (rangeHeader) {
      fetchHeaders["Range"] = rangeHeader;
      console.log(`[download-proxy] Range: ${rangeHeader}`);
    }

    const upstream = await fetch(url, { headers: fetchHeaders });

    if (!upstream.ok && upstream.status !== 206) {
      console.error(`[download-proxy] Upstream error: ${upstream.status}`);
      return new Response(
        JSON.stringify({ error: `Upstream returned ${upstream.status}` }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Build response headers
    const responseHeaders: Record<string, string> = { ...corsHeaders };

    const contentLength = upstream.headers.get("content-length");
    if (contentLength) responseHeaders["Content-Length"] = contentLength;

    const contentRange = upstream.headers.get("content-range");
    if (contentRange) responseHeaders["Content-Range"] = contentRange;

    const contentType =
      upstream.headers.get("content-type") || "application/octet-stream";
    responseHeaders["Content-Type"] = contentType;

    responseHeaders["Accept-Ranges"] = "bytes";

    // Try to extract filename from URL
    const urlPath = new URL(url).pathname;
    const filename = urlPath.split("/").pop() || "download";
    responseHeaders["Content-Disposition"] =
      `attachment; filename="${filename}"`;

    console.log(
      `[download-proxy] Streaming ${contentLength || "unknown"} bytes, status ${upstream.status}`
    );

    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error(`[download-proxy] Error:`, error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
