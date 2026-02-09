import { useState } from 'react';
import { Home, Bookmark, Crown, User, LogOut, Settings, Search } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePendingRequestCount } from '@/hooks/usePendingRequests';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { LoginModal } from './LoginModal';

export function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, role, isAdmin, signOut } = useAuth();
  const pendingCount = usePendingRequestCount();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [profileSheetOpen, setProfileSheetOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    setProfileSheetOpen(false);
    navigate('/auth');
  };

  const navItems = [
    { icon: Home, label: 'Home', path: '/', show: true },
    { icon: Search, label: 'Search', path: '/search', show: true },
    { icon: Bookmark, label: 'Watchlist', path: '/watchlist', show: !!user && !isAdmin },
    { icon: Crown, label: 'Admin', path: '/admin', show: isAdmin, badge: true },
  ].filter(item => item.show);

  const isActive = (path: string) => 
    location.pathname === path || 
    (path === '/admin' && location.pathname.startsWith('/admin'));

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-xl border-t border-border safe-area-bottom overflow-hidden">
        <div className="flex items-center justify-around h-16 px-1">
          {navItems.map((item) => {
            const active = isActive(item.path);
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 py-2 px-1 flex-1 min-w-0 rounded-lg transition-all",
                  active 
                    ? "text-cineverse-red" 
                    : "text-cineverse-gray hover:text-foreground"
                )}
              >
                <div className="relative">
                  <item.icon 
                    className={cn(
                      "w-[18px] h-[18px] transition-all",
                      active && "fill-cineverse-red"
                    )} 
                    fill={active ? "currentColor" : "none"}
                  />
                  {item.badge && pendingCount > 0 && (
                    <span className="absolute -top-1.5 -right-2 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-0.5">
                      {pendingCount > 99 ? '99+' : pendingCount}
                    </span>
                  )}
                </div>
                <span className={cn(
                  "text-[10px] font-medium truncate w-full text-center",
                  active && "text-cineverse-red"
                )}>
                  {item.label}
                </span>
              </Link>
            );
          })}

          {/* Profile Button with Sheet */}
          {user ? (
            <Sheet open={profileSheetOpen} onOpenChange={setProfileSheetOpen}>
              <SheetTrigger asChild>
                <button
                  className={cn(
                    "flex flex-col items-center justify-center gap-0.5 py-2 px-1 flex-1 min-w-0 rounded-lg transition-all",
                    (location.pathname === '/profile') 
                      ? "text-cineverse-red" 
                      : "text-cineverse-gray hover:text-foreground"
                  )}
                >
                  <User 
                    className={cn(
                      "w-[18px] h-[18px] transition-all",
                      location.pathname === '/profile' && "fill-cineverse-red"
                    )} 
                    fill={location.pathname === '/profile' ? "currentColor" : "none"}
                  />
                  <span className={cn(
                    "text-[10px] font-medium truncate w-full text-center",
                    location.pathname === '/profile' && "text-cineverse-red"
                  )}>
                    Profile
                  </span>
                </button>
              </SheetTrigger>
              <SheetContent side="bottom" className="rounded-t-xl">
                <SheetHeader className="text-left pb-4">
                  <SheetTitle>Account</SheetTitle>
                </SheetHeader>
                <div className="space-y-2">
                  {/* User Info */}
                  <div className="flex items-center gap-3 p-3 bg-muted rounded-lg mb-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      {profile?.avatar_url ? (
                        <img
                          src={profile.avatar_url}
                          alt={profile.display_name || 'Avatar'}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        <User className="w-5 h-5 text-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{profile?.display_name || 'User'}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                    <span className={cn(
                      "text-xs px-2 py-1 rounded-full flex-shrink-0",
                      role === 'admin' ? 'bg-cg-gold/20 text-cg-gold' :
                      role === 'premium' ? 'bg-cg-premium/20 text-cg-premium' :
                      'bg-muted-foreground/20 text-muted-foreground'
                    )}>
                      {role === 'admin' ? 'Admin' : role === 'premium' ? 'Premium' : 'Free'}
                    </span>
                  </div>

                  {/* Menu Items */}
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 h-12"
                    onClick={() => {
                      setProfileSheetOpen(false);
                      navigate('/profile');
                    }}
                  >
                    <User className="w-5 h-5" />
                    My Profile
                  </Button>

                  {isAdmin && (
                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-3 h-12"
                      onClick={() => {
                        setProfileSheetOpen(false);
                        navigate('/admin');
                      }}
                    >
                      <Settings className="w-5 h-5" />
                      Admin Dashboard
                    </Button>
                  )}

                  <div className="border-t border-border my-2" />

                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 h-12 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={handleSignOut}
                  >
                    <LogOut className="w-5 h-5" />
                    Sign Out
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          ) : (
            <Link
              to="/auth"
              className="flex flex-col items-center justify-center gap-0.5 py-2 px-1 flex-1 min-w-0 rounded-lg transition-all text-cineverse-gray hover:text-foreground"
            >
              <User className="w-[18px] h-[18px]" />
              <span className="text-[10px] font-medium">Login</span>
            </Link>
          )}
        </div>
      </nav>

      <LoginModal open={showLoginModal} onOpenChange={setShowLoginModal} />
    </>
  );
}