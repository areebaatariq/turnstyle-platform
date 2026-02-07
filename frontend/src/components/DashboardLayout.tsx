import { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Users, Shirt, MessageSquare, Receipt, LogOut, Settings, Sparkles } from 'lucide-react';
import { getCurrentUser, logout } from '@/utils/auth';
import { showSuccess } from '@/utils/toast';
import LogoText from '@/components/LogoText';
import LogoIcon from '@/components/LogoIcon';
import DataLoader from '@/components/DataLoader';

interface DashboardLayoutProps {
  children: ReactNode;
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = getCurrentUser();

  const handleLogout = () => {
    logout();
    showSuccess('Logged out successfully');
    navigate('/login');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const isStylist = currentUser?.userType === 'stylist';
  
  const navItems = isStylist ? [
    { path: '/dashboard', label: 'Clients', icon: Users },
    { path: '/closets', label: 'Closets', icon: Shirt },
    { path: '/looks', label: 'Looks', icon: Sparkles },
    { path: '/look-requests', label: 'Requests', icon: Sparkles },
    { path: '/messages', label: 'Messages', icon: MessageSquare },
    // { path: '/receipts', label: 'Receipts', icon: Receipt }, // Hidden for now
  ] : [
    { path: '/dashboard', label: 'Dashboard', icon: Sparkles },
    { path: '/closets', label: 'My Closet', icon: Shirt },
    { path: '/looks', label: 'Looks', icon: Sparkles },
    { path: '/messages', label: 'Messages', icon: MessageSquare },
  ];

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header: black background, white logo; height unchanged, logo slightly smaller */}
      <header className="bg-black border-b border-white/10 sticky top-0 z-50 flex-shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14 sm:h-16">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center text-white hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black rounded"
              aria-label="Go to dashboard"
            >
              <div className="md:hidden flex items-center">
                <LogoIcon width={24} height={38} className="text-white shrink-0" />
              </div>
              <div className="hidden md:flex items-center">
                <LogoText width={120} height={14} className="text-white shrink-0" />
              </div>
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-10 w-10 rounded-full text-white hover:bg-white/10 hover:text-white focus:bg-white/10 focus:text-white"
                >
                  <Avatar className="ring-2 ring-white/20">
                    <AvatarImage src={currentUser?.profilePhotoUrl} />
                    <AvatarFallback className="bg-white/20 text-white border border-white/30">
                      {currentUser ? getInitials(currentUser.name) : 'U'}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{currentUser?.name}</p>
                    <p className="text-xs text-muted-foreground">{currentUser?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/profile-setup')}>
                  <Settings className="mr-2 h-4 w-4" />
                  Profile Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Content - padding bottom so content isn't hidden behind fixed footer */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6 pb-20 sm:pb-20">
        <DataLoader>{children}</DataLoader>
      </main>

      {/* Fixed bottom navigation bar - standard mobile bottom nav behavior */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      >
        <div className="max-w-7xl mx-auto flex justify-around items-stretch min-h-[56px] sm:min-h-[60px] py-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                type="button"
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center justify-center flex-1 gap-0.5 min-w-0 py-2 px-1 transition-colors touch-manipulation ${
                  isActive
                    ? 'text-black font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className="h-5 w-5 sm:h-5 sm:w-5 shrink-0" aria-hidden />
                <span className="text-[10px] sm:text-xs truncate max-w-full">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default DashboardLayout;