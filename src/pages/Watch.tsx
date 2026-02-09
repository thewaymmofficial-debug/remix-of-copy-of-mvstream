import { useSearchParams, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

/**
 * Watch page - redirects to external streaming URL.
 * 
 * Note: In-app iframe playback is not possible because:
 * - Streaming URLs are HTTP while the app is served over HTTPS
 * - Browsers block mixed content (HTTPS page embedding HTTP iframe)
 * - This is a browser security restriction, not a code issue
 * 
 * The solution is to redirect to the streaming URL directly,
 * which allows the browser to handle HTTP content properly.
 */
export default function Watch() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const url = searchParams.get('url') || '';

  useEffect(() => {
    if (!url) {
      navigate('/', { replace: true });
      return;
    }

    // Redirect immediately to the streaming URL
    // This is the only way to play HTTP streams from an HTTPS app
    window.location.href = url;
  }, [url, navigate]);

  // Show nothing while redirecting
  return null;
}
