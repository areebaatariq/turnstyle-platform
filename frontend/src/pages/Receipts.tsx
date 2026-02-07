import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import AddReceiptDialog from '@/components/AddReceiptDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, Receipt, Search, MoreVertical, Trash2, Edit, Calendar } from 'lucide-react';
import { getReceipts, deleteReceipt } from '@/utils/receipts';
import { getStylistClients } from '@/utils/clientStorage';
import { showSuccess, showError } from '@/utils/toast';
import { Receipt as ReceiptType, Client } from '@/types';
import { format } from 'date-fns';

const Receipts = () => {
  const [receipts, setReceipts] = useState<ReceiptType[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadData();
  }, [selectedClientId]);

  const loadData = async () => {
    try {
      const [receiptsData, clientsData] = await Promise.all([
        getReceipts(selectedClientId === 'all' ? undefined : selectedClientId),
        getStylistClients(),
      ]);
      setReceipts(receiptsData);
      setClients(clientsData);
    } catch (error) {
      console.error('Error loading data:', error);
      showError('Failed to load receipts');
    }
  };

  const filteredReceipts = receipts.filter(receipt => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const client = clients.find(c => c.id === receipt.clientId);
      return (
        receipt.storeName.toLowerCase().includes(query) ||
        client?.name.toLowerCase().includes(query) ||
        receipt.notes?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const getClient = (clientId: string): Client | undefined => {
    return clients.find(c => c.id === clientId);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleDeleteReceipt = async (receipt: ReceiptType) => {
    if (window.confirm(`Are you sure you want to delete receipt from ${receipt.storeName}?`)) {
      const success = await deleteReceipt(receipt.id);
      if (success) {
        showSuccess('Receipt deleted');
        await loadData();
      } else {
        showError('Failed to delete receipt');
      }
    }
  };

  const ReceiptCard = ({ receipt }: { receipt: ReceiptType }) => {
    const client = getClient(receipt.clientId);

    return (
      <Card className="hover:shadow-lg transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {receipt.receiptPhotoUrl ? (
                <img
                  src={receipt.receiptPhotoUrl}
                  alt={receipt.storeName}
                  className="w-16 h-16 object-cover rounded flex-shrink-0"
                />
              ) : (
                <div className="w-16 h-16 bg-gray-100 rounded flex items-center justify-center flex-shrink-0">
                  <Receipt className="h-8 w-8 text-gray-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold truncate">{receipt.storeName}</h3>
                <p className="text-sm text-muted-foreground truncate">
                  {client?.name || 'Unknown Client'}
                </p>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => showSuccess('Edit coming soon')}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleDeleteReceipt(receipt)}
                  className="text-red-600"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">
                {format(new Date(receipt.purchaseDate), 'MMM d, yyyy')}
              </span>
            </div>

            <div className="text-lg font-semibold">
              ${receipt.totalAmount.toFixed(2)}
            </div>

            {receipt.itemsList && receipt.itemsList.length > 0 && (
              <div className="text-sm text-muted-foreground">
                <p className="font-medium mb-1">Items:</p>
                <ul className="list-disc list-inside space-y-1">
                  {receipt.itemsList.slice(0, 3).map((item, index) => (
                    <li key={index} className="text-xs">{item}</li>
                  ))}
                  {receipt.itemsList.length > 3 && (
                    <li className="text-xs text-muted-foreground">
                      +{receipt.itemsList.length - 3} more
                    </li>
                  )}
                </ul>
              </div>
            )}

            {receipt.notes && (
              <p className="text-sm text-muted-foreground line-clamp-2">{receipt.notes}</p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Receipts</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Track shopping receipts for your clients
            </p>
          </div>
          <Button onClick={() => setAddDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Receipt
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by store, client, or notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={selectedClientId} onValueChange={setSelectedClientId}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Filter by client" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Clients</SelectItem>
              {clients.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {filteredReceipts.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Receipt className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No receipts yet</h3>
              <p className="text-muted-foreground text-center mb-6">
                {searchQuery || selectedClientId !== 'all'
                  ? 'No receipts match your search'
                  : 'Start tracking receipts by adding your first one'}
              </p>
              {!searchQuery && selectedClientId === 'all' && (
                <Button onClick={() => setAddDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Receipt
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredReceipts.map((receipt) => (
              <ReceiptCard key={receipt.id} receipt={receipt} />
            ))}
          </div>
        )}
      </div>

      <AddReceiptDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onReceiptAdded={loadData}
      />
    </DashboardLayout>
  );
};

export default Receipts;
