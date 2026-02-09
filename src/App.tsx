import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider, QueryCache } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/hooks/useAuth";
import { FilterProvider } from "@/contexts/FilterContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { DownloadProvider } from "@/contexts/DownloadContext";

import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DevicePresenceMonitor } from "@/components/DevicePresenceMonitor";
import { useNetworkRefresh } from "@/hooks/useNetworkRefresh";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import MovieDetails from "./pages/MovieDetails";
import ActorDetail from "./pages/ActorDetail";
import Profile from "./pages/Profile";
import Watchlist from "./pages/Watchlist";
import History from "./pages/History";
import PremiumRenewal from "./pages/PremiumRenewal";
import MovieRequest from "./pages/MovieRequest";
import TvChannels from "./pages/TvChannels";
import Browse from "./pages/Browse";
import SearchPage from "./pages/Search";
import Welcome from "./pages/Welcome";

import Watch from "./pages/Watch";
import Downloads from "./pages/Downloads";
import Support from "./pages/Support";
import AdminLayout from "./pages/admin/AdminLayout";
import Dashboard from "./pages/admin/Dashboard";
import MoviesAdmin from "./pages/admin/MoviesAdmin";
import SeriesAdmin from "./pages/admin/SeriesAdmin";
import CategoriesAdmin from "./pages/admin/CategoriesAdmin";
import UsersAdmin from "./pages/admin/UsersAdmin";
import SettingsAdmin from "./pages/admin/SettingsAdmin";
import Analytics from "./pages/admin/Analytics";
import SlidesAdmin from "./pages/admin/SlidesAdmin";
import PaymentSettingsAdmin from "./pages/admin/PaymentSettingsAdmin";
import PremiumRequestsAdmin from "./pages/admin/PremiumRequestsAdmin";
import MovieRequestsAdmin from "./pages/admin/MovieRequestsAdmin";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: false,
      refetchOnMount: true,
    },
  },
  queryCache: new QueryCache({
    onError: (error, query) => {
      console.error('Query error:', query.queryKey, error);
    },
  }),
});

function NetworkRefreshMonitor() {
  useNetworkRefresh();
  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <LanguageProvider>
        <AuthProvider>
          <FilterProvider>
            <DownloadProvider>
            <NetworkRefreshMonitor />
            <DevicePresenceMonitor />
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <Routes>
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/" element={<Index />} />
                  <Route path="/movie/:id" element={<MovieDetails />} />
                  <Route path="/browse/:filter" element={<Browse />} />
                  <Route path="/search" element={<SearchPage />} />
                  <Route path="/welcome" element={<ProtectedRoute><Welcome /></ProtectedRoute>} />
                  
                  <Route path="/watch" element={<Watch />} />
                  <Route path="/downloads" element={<Downloads />} />
                  <Route path="/support" element={<Support />} />
                  <Route path="/ask-ai" element={<Support />} />
                  <Route path="/actor/:id" element={<ActorDetail />} />
                  <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                  <Route path="/watchlist" element={<ProtectedRoute><Watchlist /></ProtectedRoute>} />
                  <Route path="/history" element={<ProtectedRoute><History /></ProtectedRoute>} />
                  <Route path="/premium-renewal" element={<ProtectedRoute><PremiumRenewal /></ProtectedRoute>} />
                  <Route path="/request" element={<ProtectedRoute><MovieRequest /></ProtectedRoute>} />
                  <Route path="/tv-channels" element={<ProtectedRoute><TvChannels /></ProtectedRoute>} />
                  <Route path="/admin" element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
                    <Route index element={<Dashboard />} />
                    <Route path="movies" element={<MoviesAdmin />} />
                    <Route path="series/:movieId" element={<SeriesAdmin />} />
                    <Route path="categories" element={<CategoriesAdmin />} />
                    <Route path="users" element={<UsersAdmin />} />
                    <Route path="settings" element={<SettingsAdmin />} />
                    <Route path="slides" element={<SlidesAdmin />} />
                    <Route path="payment-settings" element={<PaymentSettingsAdmin />} />
                    <Route path="premium-requests" element={<PremiumRequestsAdmin />} />
                    <Route path="movie-requests" element={<MovieRequestsAdmin />} />
                    <Route path="analytics" element={<Analytics />} />
                  </Route>
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </TooltipProvider>
            </DownloadProvider>
          </FilterProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
