import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import CreateLookDialog from '@/components/CreateLookDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Sparkles, Calendar, Check } from 'lucide-react';
import { format } from 'date-fns';
import { getCurrentUser } from '@/utils/auth';
import { api } from '@/utils/api';
import { useLookRequests, useRefresh } from '@/hooks/useQueries';
import { toFullSizeImageUrl } from '@/utils/fileUpload';
import { ItemImageWithPreview } from '@/components/ItemImagePreview';
import { showSuccess, showError } from '@/utils/toast';
import { LookRequest, ClosetItem } from '@/types';

interface EnrichedLookRequest extends LookRequest {
  client?: { id: string; name: string; email?: string } | null;
  items?: ClosetItem[];
}

const LookRequests = () => {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const isStylist = currentUser?.userType === 'stylist';
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<EnrichedLookRequest | null>(null);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  const { data: requests = [], isLoading: loading, refetch: refetchRequests } = useLookRequests() as {
    data: EnrichedLookRequest[];
    isLoading: boolean;
    refetch: () => void;
  };
  const { refreshLookRequests, refreshLooks } = useRefresh();

  const refetchLookRequests = async () => {
    await refreshLookRequests();
    refetchRequests();
  };

  if (!isStylist) {
    return (
      <DashboardLayout>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Only stylists can view look requests.</p>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      case 'in_progress':
        return <Badge className="bg-blue-500">In Progress</Badge>;
      case 'completed':
        return <Badge className="bg-green-500">Request Fulfilled</Badge>;
      case 'declined':
        return <Badge variant="destructive">Declined</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleAccept = async (req: EnrichedLookRequest) => {
    setAcceptingId(req.id);
    try {
      await api.patch(`/look-requests/${req.id}`, { status: 'in_progress' });
      showSuccess('Request accepted. You can now create a look from it.');
      await refetchLookRequests();
    } catch (err: any) {
      console.error('Failed to accept request:', err);
      showError(err?.message || err?.response?.data?.error?.message || 'Failed to accept request');
    } finally {
      setAcceptingId(null);
    }
  };

  const handleCreateLook = (req: EnrichedLookRequest) => {
    setSelectedRequest(req);
    setCreateDialogOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Look Requests</h1>
            <p className="text-sm text-muted-foreground">
              Clients have requested looks using items from their closets
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : requests.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No look requests yet</h3>
              <p className="text-muted-foreground text-center max-w-md">
                When clients select items from their closet and request a look, those requests will appear here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {requests.map((req) => (
              <Card key={req.id}>
                <CardContent className="p-4 flex flex-col gap-4">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-12 w-12 flex-shrink-0">
                      <AvatarImage src={req.client?.email} />
                      <AvatarFallback>
                        {req.client?.name?.slice(0, 2).toUpperCase() || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold">{req.client?.name || 'Unknown Client'}</h3>
                      <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4 flex-shrink-0" />
                        {format(new Date(req.createdAt), 'MMM d, yyyy')}
                      </div>
                      {req.message && (
                        <p className="text-sm mt-1 text-muted-foreground">{req.message}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {getStatusBadge(req.status)}
                        <span className="text-sm text-muted-foreground">
                          {req.itemIds.length} item{req.itemIds.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  </div>

                  {(req.items || []).length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">Items in this request</p>
                      <div className="flex flex-wrap gap-3">
                        {(req.items || []).map((item) => (
                          <div
                            key={item.id}
                            className="w-32 h-32 sm:w-28 sm:h-28 rounded-xl overflow-hidden flex-shrink-0 bg-muted border shadow-sm"
                          >
                            <ItemImageWithPreview
                              photoUrl={item.photoUrl}
                              alt={item.name}
                              caption={item.name}
                              className="w-full h-full object-contain"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(req.status === 'pending' || req.status === 'in_progress') && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t">
                      {req.status === 'pending' && (
                        <>
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleAccept(req)}
                            disabled={!!acceptingId}
                            className="flex items-center gap-1 bg-green-600 hover:bg-green-700"
                          >
                            <Check className="h-4 w-4" />
                            {acceptingId === req.id ? 'Accepting...' : 'Accept'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCreateLook(req)}
                            className="flex items-center gap-1"
                          >
                            <Sparkles className="h-4 w-4" />
                            Create Look
                          </Button>
                        </>
                      )}
                      {req.status === 'in_progress' && (
                        <Button
                          size="sm"
                          onClick={() => handleCreateLook(req)}
                          className="flex items-center gap-1"
                        >
                          <Sparkles className="h-4 w-4" />
                          Create Look
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {selectedRequest && (
        <CreateLookDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          preselectedClientId={selectedRequest.clientId}
          preselectedName={selectedRequest.message ?? ''}
          preselectedItems={selectedRequest.items}
          onLookCreated={async (_look) => {
            if (selectedRequest?.id) {
              try {
                await api.patch(`/look-requests/${selectedRequest.id}`, { status: 'completed' });
              } catch (err) {
                console.error('Failed to mark request as fulfilled:', err);
              }
            }
            await refreshLooks();
            setCreateDialogOpen(false);
            setSelectedRequest(null);
            await refetchLookRequests();
            navigate('/looks');
          }}
        />
      )}
    </DashboardLayout>
  );
};

export default LookRequests;
