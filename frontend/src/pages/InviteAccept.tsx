import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { apiRequest, ApiResponse } from '@/utils/api';
import { getCurrentUser } from '@/utils/auth';
import { showSuccess, showError } from '@/utils/toast';
import LogoText from '@/components/LogoText';

interface InviteData {
  relationshipId: string;
  stylistName: string;
  stylistEmail: string;
  stylistProfilePhoto?: string;
  clientName: string;
  clientEmail: string;
  status: string;
  createdAt: string;
}

const InviteAccept = () => {
  const { relationshipId } = useParams<{ relationshipId: string }>();
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  
  const [inviteData, setInviteData] = useState<InviteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [declined, setDeclined] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!relationshipId) {
      setError('Invalid invitation link');
      setLoading(false);
      return;
    }

    loadInviteData();
  }, [relationshipId]);

  const loadInviteData = async () => {
    try {
      const response = await apiRequest<ApiResponse<InviteData>>(
        `/invites/${relationshipId}`,
        { method: 'GET' }
      );

      if (response.data) {
        setInviteData(response.data);
        
        // If already accepted, show success state
        if (response.data.status === 'active') {
          setAccepted(true);
        }
      } else {
        setError('Invitation not found');
      }
    } catch (error: any) {
      console.error('Error loading invite:', error);
      setError(error.message || 'Failed to load invitation');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!relationshipId || !inviteData) return;

    setAccepting(true);
    try {
      // Get current user if logged in
      const user = getCurrentUser();
      
      const response = await apiRequest<ApiResponse<{ success: boolean; relationship: any; message: string }>>(
        `/invites/${relationshipId}/accept`,
        {
          method: 'POST',
          body: JSON.stringify({
            userId: user?.id,
            email: inviteData.clientEmail,
          }),
        }
      );

      if (response.data?.success) {
        setAccepted(true);
        showSuccess('Invitation accepted successfully!');
        
        // Redirect to login/signup if not logged in, otherwise to dashboard
        setTimeout(() => {
          if (user) {
            navigate('/dashboard');
          } else {
            // Redirect to signup with email and userType=client for invite acceptance
            navigate(`/signup?email=${encodeURIComponent(inviteData.clientEmail)}&userType=client&invite=${relationshipId}`);
          }
        }, 2000);
      }
    } catch (error: any) {
      console.error('Error accepting invite:', error);
      showError(error.message || 'Failed to accept invitation');
    } finally {
      setAccepting(false);
    }
  };

  const handleDecline = async () => {
    if (!relationshipId) return;
    setDeclining(true);
    try {
      await apiRequest<ApiResponse<{ success: boolean; message: string }>>(
        `/invites/${relationshipId}/decline`,
        { method: 'POST' }
      );
      setDeclined(true);
      showSuccess('Invitation declined.');
      setTimeout(() => navigate('/'), 1500);
    } catch (err: any) {
      showError(err.message || 'Failed to decline invitation');
    } finally {
      setDeclining(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Loading invitation...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="h-5 w-5" />
              Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => navigate('/')} variant="outline" className="w-full">
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!inviteData) {
    return null;
  }

  if (declined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                <XCircle className="h-8 w-8 text-muted-foreground" />
              </div>
            </div>
            <CardTitle>Invitation Declined</CardTitle>
            <CardDescription>
              You have declined {inviteData.stylistName}&apos;s invitation. Redirecting...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (accepted || inviteData.status === 'active') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </div>
            <CardTitle>Invitation Accepted!</CardTitle>
            <CardDescription>
              You've successfully accepted {inviteData.stylistName}'s invitation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-4">
                {currentUser
                  ? 'Redirecting to your dashboard...'
                  : 'Please log in to access your account'}
              </p>
            </div>
            {!currentUser && (
              <div className="space-y-2">
                <Button
                  onClick={() => navigate(`/login?email=${encodeURIComponent(inviteData.clientEmail)}`)}
                  className="w-full"
                >
                  Log In
                </Button>
                <Button
                  onClick={() => navigate(`/signup?email=${encodeURIComponent(inviteData.clientEmail)}&userType=client&invite=${relationshipId}`)}
                  variant="outline"
                  className="w-full"
                >
                  Create Account
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <LogoText width={200} height={24} className="text-black" />
          </div>
          <CardTitle>You've Been Invited!</CardTitle>
          <CardDescription>
            {inviteData.stylistName} has invited you to collaborate
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Stylist Info */}
          <div className="flex items-center gap-4 p-4 bg-white border border-border rounded-lg">
            <Avatar className="h-12 w-12">
              <AvatarImage src={inviteData.stylistProfilePhoto} />
              <AvatarFallback>{getInitials(inviteData.stylistName)}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="font-semibold">{inviteData.stylistName}</p>
              <p className="text-sm text-muted-foreground">Stylist</p>
            </div>
          </div>

          {/* Client Info */}
          <div className="p-4 border rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">Invited as</p>
            <p className="font-semibold">{inviteData.clientName}</p>
            <p className="text-sm text-muted-foreground">{inviteData.clientEmail}</p>
          </div>

          {/* Info */}
          <div className="p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-900">
              By accepting this invitation, you'll be able to:
            </p>
            <ul className="mt-2 space-y-1 text-sm text-blue-800 list-disc list-inside">
              <li>View your closet items</li>
              <li>See styling looks created for you</li>
              <li>Collaborate with your stylist</li>
              <li>Receive styling recommendations</li>
            </ul>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <Button
              onClick={handleAccept}
              disabled={accepting}
              className="w-full"
              size="lg"
            >
              {accepting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Accepting...
                </>
              ) : (
                'Accept Invitation'
              )}
            </Button>
            <Button
              onClick={handleDecline}
              variant="outline"
              className="w-full"
              disabled={accepting || declining}
            >
              {declining ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Declining...
                </>
              ) : (
                'Decline'
              )}
            </Button>
          </div>

          {!currentUser && (
            <p className="text-xs text-center text-muted-foreground">
              You'll need to create an account or log in after accepting
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default InviteAccept;
