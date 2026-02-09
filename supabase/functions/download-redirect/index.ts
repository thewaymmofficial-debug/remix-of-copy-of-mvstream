import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const target = url.searchParams.get("url");

    if (!target) {
      return new Response("Missing url parameter", {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    console.log(`[download-redirect] Redirecting to: ${target}`);

    // 302 redirect — browser follows natively, no timeout risk
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        Location: target,
      },
    });
  } catch (error) {
    console.error(`[download-redirect] Error:`, error);
    return new Response(String(error), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "text/plain" },
    });
  }
});
