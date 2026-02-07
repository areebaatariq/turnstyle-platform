import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { loginWithGoogle, loginWithApple } from '@/utils/auth';
import { showSuccess, showError } from '@/utils/toast';
import { redirectToAppleSignIn } from '@/utils/oauth';
import { authApi, setAuthToken } from '@/utils/api';
import { User } from '@/types';
import LogoText from '@/components/LogoText';

const GOOGLE_CLIENT_ID = '34555252915-tvs12mnigj36gn1jrtu1386jo3bsvfsd.apps.googleusercontent.com';

const Signup = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [name, setName] = useState('');
  const emailFromUrl = searchParams.get('email') || '';
  const [email, setEmail] = useState(emailFromUrl);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const userTypeFromUrl = searchParams.get('userType') as 'stylist' | 'client' | null;
  const redirectTo = searchParams.get('redirect') || '/profile-setup';
  
  // If email came from URL (look approval link), it must match the client record
  const isEmailFromLookLink = !!emailFromUrl && userTypeFromUrl === 'client';

  useEffect(() => {
    // Initialize Google Sign-In when component mounts
    if (typeof window !== 'undefined' && (window as any).google) {
      (window as any).google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleResponse,
      });
    }

    // Listen for Google script load
    const checkGoogle = setInterval(() => {
      if ((window as any).google) {
        (window as any).google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleResponse,
        });
        clearInterval(checkGoogle);
      }
    }, 100);

    return () => clearInterval(checkGoogle);
  }, []);

  const handleGoogleResponse = async (response: { credential: string }) => {
    setLoading(true);
    try {
      const user = await loginWithGoogle(response.credential);
      showSuccess('Account created with Google');
      navigate('/profile-setup');
    } catch (error: any) {
      showError(error.message || 'Google signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthSignup = async (provider: 'google' | 'apple') => {
    if (provider === 'apple') {
      showError('Apple Sign-In coming soon!');
      return;
    }
    
    // Save redirect destination for after OAuth completes
    if (redirectTo) {
      localStorage.setItem('oauth_redirect', redirectTo);
    }
    
    if (provider === 'google') {
      // Use redirect flow for better UX with button clicks
      window.location.href = `${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/auth/google`;
    }
  };

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // Use userType from URL if provided, otherwise let backend determine from client records
      // Don't default to 'stylist' here - let backend check if email belongs to a client
      const response = await authApi.signup(email, password, name, userTypeFromUrl || undefined);
      setAuthToken(response.token);
      
      const user: User = {
        id: response.user.id,
        email: response.user.email,
        name: response.user.name,
        userType: response.user.userType as 'stylist' | 'client',
        profilePhotoUrl: response.user.profilePhotoUrl,
        createdAt: new Date().toISOString(),
      };
      
      localStorage.setItem('turnstyle_current_user', JSON.stringify(user));
      showSuccess('Account created successfully');
      // Redirect to the original destination or profile-setup
      navigate(redirectTo);
    } catch (error: any) {
      showError(error.message || 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-4">
            <LogoText width={200} height={23} className="text-black" />
          </div>
          <CardDescription className="text-center">
            Start managing your styling business professionally
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => handleOAuthSignup('google')}
              disabled={loading}
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Sign up with Google
            </Button>
            
            <Button
              variant="outline"
              className="w-full"
              onClick={() => handleOAuthSignup('apple')}
              disabled={loading}
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
              </svg>
              Sign up with Apple
            </Button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or sign up with email
              </span>
            </div>
          </div>

          <form onSubmit={handleEmailSignup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="Jessica Smith"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isEmailFromLookLink}
                required
              />
              {isEmailFromLookLink && (
                <p className="text-xs text-muted-foreground">
                  This email matches your client record. You must use this email to access your looks.
                </p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Creating account...' : 'Create account'}
            </Button>
          </form>

          <div className="text-center text-sm">
            <span className="text-muted-foreground">Already have an account? </span>
            <Button
              variant="link"
              className="p-0 h-auto font-normal"
              onClick={() => navigate('/login')}
            >
              Log in
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Signup;