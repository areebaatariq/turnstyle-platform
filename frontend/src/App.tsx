import React, { useEffect, Component, ErrorInfo } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useSearchParams, useNavigate, useLocation } from "react-router-dom";
import { getCurrentUser } from "@/utils/auth";
import { setAuthToken } from "@/utils/api";
import Index from "./pages/Index";

class AppErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  state = { hasError: false, error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("App error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-white">
          <h1 className="text-lg font-semibold text-red-600 mb-2">Something went wrong</h1>
          <p className="text-sm text-gray-600 text-center max-w-md mb-4">{this.state.error.message}</p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            className="text-sm text-primary underline"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ProfileSetup from "./pages/ProfileSetup";
import Dashboard from "./pages/Dashboard";
import Closets from "./pages/Closets";
import Looks from "./pages/Looks";
import LookRequests from "./pages/LookRequests";
import Messages from "./pages/Messages";
import Receipts from "./pages/Receipts";
import InviteAccept from "./pages/InviteAccept";
import NotFound from "./pages/NotFound";

// Auth callback component to handle OAuth redirects
const AuthCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get('token');
    const error = searchParams.get('error');
    const provider = searchParams.get('provider');
    const userParam = searchParams.get('user');

    console.log('Auth callback received:', { token: !!token, error, provider, user: !!userParam });

    if (error) {
      // Redirect to login with error message
      console.error('Auth error:', error);
      navigate(`/login?error=${encodeURIComponent(error)}`);
      return;
    }

    if (token) {
      // Store token
      setAuthToken(token);
      
      // Get user info from URL or decode from token
      let user;
      if (userParam) {
        try {
          user = JSON.parse(decodeURIComponent(userParam));
          user.createdAt = new Date().toISOString();
        } catch (e) {
          console.error('Error parsing user info:', e);
        }
      }
      
      // Fallback: decode from JWT token
      if (!user) {
        try {
          const base64Url = token.split('.')[1];
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const jsonPayload = decodeURIComponent(
            atob(base64)
              .split('')
              .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
              .join('')
          );
          const payload = JSON.parse(jsonPayload);
          
          user = {
            id: payload.userId,
            email: payload.email,
            userType: payload.userType,
            name: payload.email.split('@')[0],
            oauthProvider: provider as 'google' | 'apple',
            createdAt: new Date().toISOString(),
          };
        } catch (error) {
          console.error('Error decoding token:', error);
        }
      }
      
      if (user) {
        localStorage.setItem('turnstyle_current_user', JSON.stringify(user));
        console.log('User stored, checking for redirect destination');
        // Check for redirect parameter from login/signup page
        // Also check localStorage for OAuth redirect (set before OAuth flow)
        const redirectTo = searchParams.get('redirect') || localStorage.getItem('oauth_redirect') || '/dashboard';
        localStorage.removeItem('oauth_redirect'); // Clean up
        navigate(redirectTo);
      } else {
        // Still redirect, backend will verify token
        const redirectTo = searchParams.get('redirect') || localStorage.getItem('oauth_redirect') || '/dashboard';
        localStorage.removeItem('oauth_redirect'); // Clean up
        navigate(redirectTo);
      }
    } else {
      console.error('No token in callback');
      navigate('/login');
    }
  }, [searchParams, navigate]);

  return <div className="min-h-screen flex items-center justify-center">Processing authentication...</div>;
};

// Export queryClient so it can be cleared on logout
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data considered fresh for 2 minutes
      staleTime: 2 * 60 * 1000,
      // Cache data for 5 minutes
      gcTime: 5 * 60 * 1000,
      // Retry failed requests once
      retry: 1,
      // Don't refetch on window focus by default
      refetchOnWindowFocus: false,
      // Don't refetch on mount if data is fresh
      refetchOnMount: false,
    },
  },
});

// Protected Route wrapper
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const user = getCurrentUser();
  const location = useLocation();
  if (!user) {
    // Save the current path (with query params) for redirect after login
    const currentPath = location.pathname + location.search;
    return <Navigate to={`/login?redirect=${encodeURIComponent(currentPath)}`} replace />;
  }
  return <>{children}</>;
};

// Public Route wrapper (redirects to dashboard if already logged in)
const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const user = getCurrentUser();
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AppErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route
            path="/login"
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            }
          />
          <Route
            path="/signup"
            element={
              <PublicRoute>
                <Signup />
              </PublicRoute>
            }
          />
          <Route
            path="/profile-setup"
            element={
              <ProtectedRoute>
                <ProfileSetup />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/closets"
            element={
              <ProtectedRoute>
                <Closets />
              </ProtectedRoute>
            }
          />
          <Route
            path="/looks"
            element={
              <ProtectedRoute>
                <Looks />
              </ProtectedRoute>
            }
          />
          <Route
            path="/look-requests"
            element={
              <ProtectedRoute>
                <LookRequests />
              </ProtectedRoute>
            }
          />
          <Route
            path="/messages"
            element={
              <ProtectedRoute>
                <Messages />
              </ProtectedRoute>
            }
          />
          {/* Auth callback route for OAuth redirects */}
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/invite/:relationshipId" element={<InviteAccept />} />
          <Route
            path="/receipts"
            element={
              <ProtectedRoute>
                <Receipts />
              </ProtectedRoute>
            }
          />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
      </AppErrorBoundary>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;