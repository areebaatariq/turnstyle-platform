import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import AddClientDialog from '@/components/AddClientDialog';
import EditClientDialog from '@/components/EditClientDialog';
import ImportCSVDialog from '@/components/ImportCSVDialog';
import InviteClientDialog from '@/components/InviteClientDialog';
import ClientMoreInfoModal from '@/components/ClientMoreInfoModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, Search, Upload, Mail, MoreVertical, Send, Trash2, Users, Edit, MessageSquare, Sparkles } from 'lucide-react';
import { deleteClient } from '@/utils/clientStorage';
import { showSuccess, showError } from '@/utils/toast';
import { Client } from '@/types';
import { getCurrentUser } from '@/utils/auth';
import { useClients, useLooks, useRefresh } from '@/hooks/useQueries';
import { useDebounce } from '@/hooks/useDebounce';

const Dashboard = () => {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const isStylist = currentUser?.userType === 'stylist';
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [moreSheetOpen, setMoreSheetOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientForMore, setClientForMore] = useState<Client | null>(null);

  // React Query hooks - data is cached and automatically refreshed
  const { data: clients = [], isLoading: clientsLoading } = useClients();
  const { data: looks = [], isLoading: looksLoading } = useLooks();
  const { refreshClients } = useRefresh();

  // Filter clients with debounced search, then sort A → Z by name
  const filteredClients = useMemo(() => {
    const list = debouncedSearch
      ? clients.filter(
          client =>
            client.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
            client.email.toLowerCase().includes(debouncedSearch.toLowerCase())
        )
      : [...clients];
    return list.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }, [clients, debouncedSearch]);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500">Active</Badge>;
      case 'invited':
        return <Badge variant="secondary">Invited</Badge>;
      case 'ended':
        return <Badge variant="outline">Ended</Badge>;
      case 'not_active':
        return <Badge variant="outline">Not Active</Badge>;
      default:
        return null;
    }
  };

  const handleInviteClient = (client: Client, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedClient(client);
    setInviteDialogOpen(true);
  };

  const handleEditClient = (client: Client, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedClient(client);
    setEditDialogOpen(true);
  };

  const handleDeleteClient = async (client: Client, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to remove ${client.name}?`)) {
      const success = await deleteClient(client.id);
      if (success) {
        showSuccess(`${client.name} removed successfully`);
        await refreshClients();
      } else {
        showError('Failed to remove client');
      }
    }
  };

  const handleClientClick = (client: Client) => {
    navigate(`/closets?clientId=${client.id}`);
  };

  // Client Dashboard View
  if (!isStylist) {
    const pendingLooks = looks.filter(l => l.status === 'pending');
    const approvedLooks = looks.filter(l => l.status === 'approved');
    
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Welcome back, {currentUser?.name || 'Client'}!</h1>
            <p className="text-sm sm:text-base text-muted-foreground">View your looks and messages from your stylist</p>
          </div>

          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Looks</p>
                    <p className="text-2xl font-bold">{looks.length}</p>
                  </div>
                  <Sparkles className="h-8 w-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Pending Approval</p>
                    <p className="text-2xl font-bold">{pendingLooks.length}</p>
                  </div>
                  <Sparkles className="h-8 w-8 text-yellow-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Approved</p>
                    <p className="text-2xl font-bold">{approvedLooks.length}</p>
                  </div>
                  <Sparkles className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/looks')}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <Sparkles className="h-8 w-8 text-purple-500" />
                  <div>
                    <h3 className="font-semibold">View All Looks</h3>
                    <p className="text-sm text-muted-foreground">See all your styling looks</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/messages')}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <MessageSquare className="h-8 w-8 text-blue-500" />
                  <div>
                    <h3 className="font-semibold">Messages</h3>
                    <p className="text-sm text-muted-foreground">Chat with your stylist</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Stylist Dashboard View
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Clients</h1>
            <p className="text-sm sm:text-base text-muted-foreground">Manage your clients</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setImportDialogOpen(true)} className="flex-1 sm:flex-none">
              <Upload className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Import CSV</span>
              <span className="sm:hidden">Import</span>
            </Button>
            <Button onClick={() => setAddDialogOpen(true)} className="flex-1 sm:flex-none">
              <Plus className="mr-2 h-4 w-4" />
              Add Client
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search clients by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Empty State */}
        {clients.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No clients yet</h3>
              <p className="text-muted-foreground text-center mb-6">
                Get started by importing your existing clients or adding them manually
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
                  <Upload className="mr-2 h-4 w-4" />
                  Import CSV
                </Button>
                <Button onClick={() => setAddDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Client
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Client List */}
        {filteredClients.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredClients.map((client) => (
              <Card 
                key={client.id} 
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => handleClientClick(client)}
              >
                <CardContent className="flex flex-col p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="h-12 w-12 shrink-0">
                        {client.profilePhotoUrl && (
                          <AvatarImage src={client.profilePhotoUrl} alt={client.name} />
                        )}
                        <AvatarFallback>{getInitials(client.name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <h3 className="font-semibold truncate">{client.name}</h3>
                        {getStatusBadge(client.relationshipStatus ?? 'not_active')}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" className="shrink-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => handleEditClient(client, e)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit Client
                        </DropdownMenuItem>
                        {client.relationshipStatus !== 'active' && (
                          client.relationshipStatus === 'invited' ? (
                            <DropdownMenuItem disabled>
                              <Send className="mr-2 h-4 w-4" />
                              Invitation pending
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={(e) => handleInviteClient(client, e)}>
                              <Send className="mr-2 h-4 w-4" />
                              Send Invitation
                            </DropdownMenuItem>
                          )
                        )}
                        <DropdownMenuItem 
                          onClick={(e) => handleDeleteClient(client, e)}
                          className="text-red-600"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Remove Client
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                    <Mail className="h-4 w-4 shrink-0" />
                    <span className="truncate">{client.email}</span>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      setClientForMore(client);
                      setMoreSheetOpen(true);
                    }}
                  >
                    More
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <AddClientDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onClientAdded={refreshClients}
      />

      <EditClientDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        client={selectedClient}
        onClientUpdated={refreshClients}
      />

      <ImportCSVDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onClientsImported={refreshClients}
      />

      <InviteClientDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        client={selectedClient}
        onInviteSent={refreshClients}
      />

      <ClientMoreInfoModal
        open={moreSheetOpen}
        onOpenChange={setMoreSheetOpen}
        client={clientForMore}
      />
    </DashboardLayout>
  );
};

export default Dashboard;