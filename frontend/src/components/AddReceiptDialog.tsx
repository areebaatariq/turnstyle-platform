import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Receipt, Upload, X } from 'lucide-react';
import { createReceipt } from '@/utils/receipts';
import { getStylistClients } from '@/utils/clientStorage';
import { showSuccess, showError } from '@/utils/toast';
import { Client } from '@/types';

interface AddReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReceiptAdded: () => void;
}

const AddReceiptDialog = ({
  open,
  onOpenChange,
  onReceiptAdded,
}: AddReceiptDialogProps) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState('');
  const [storeName, setStoreName] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [itemsList, setItemsList] = useState('');
  const [notes, setNotes] = useState('');
  const [receiptPhotoFile, setReceiptPhotoFile] = useState<File | null>(null);
  const [receiptPhotoPreview, setReceiptPhotoPreview] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadClients = async () => {
      try {
        const loadedClients = await getStylistClients();
        setClients(loadedClients);
      } catch (error) {
        console.error('Error loading clients:', error);
      }
    };
    
    loadClients();
  }, []);

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    const { validateImageFile } = await import('@/utils/fileUpload');
    const validation = validateImageFile(file);
    if (!validation.valid) {
      showError(validation.error || 'Invalid image file');
      return;
    }

    setReceiptPhotoFile(file);
    
    // Create preview
    try {
      const preview = await uploadImage(file);
      setReceiptPhotoPreview(preview);
    } catch (error: any) {
      showError(error.message || 'Failed to load image preview');
      setReceiptPhotoFile(null);
    }
  };

  const handleRemovePhoto = () => {
    setReceiptPhotoFile(null);
    setReceiptPhotoPreview('');
    // Reset file input
    const input = document.getElementById('receipt-photo-upload') as HTMLInputElement;
    if (input) input.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!clientId) {
      showError('Please select a client');
      return;
    }

    if (!storeName.trim()) {
      showError('Store name is required');
      return;
    }

    if (!purchaseDate) {
      showError('Purchase date is required');
      return;
    }

    if (!totalAmount || parseFloat(totalAmount) <= 0) {
      showError('Please enter a valid total amount');
      return;
    }

    setLoading(true);

    try {
      // Upload receipt photo if provided
      let receiptPhotoUrl: string | undefined;
      if (receiptPhotoFile) {
        const { uploadImage } = await import('@/utils/fileUpload');
        receiptPhotoUrl = await uploadImage(receiptPhotoFile);
      }

      // Parse items list (comma-separated or newline-separated)
      const items = itemsList
        .split(/[,\n]/)
        .map(item => item.trim())
        .filter(item => item.length > 0);

      await createReceipt({
        clientId,
        storeName: storeName.trim(),
        purchaseDate,
        totalAmount: parseFloat(totalAmount),
        itemsList: items,
        receiptPhotoUrl,
        notes: notes.trim() || undefined,
      });

      showSuccess('Receipt added successfully');
      handleReset();
      onReceiptAdded();
      onOpenChange(false);
    } catch (error: any) {
      showError(error.message || 'Failed to add receipt');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setClientId('');
    setStoreName('');
    setPurchaseDate('');
    setTotalAmount('');
    setItemsList('');
    setNotes('');
    setReceiptPhotoFile(null);
    setReceiptPhotoPreview('');
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      handleReset();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Receipt</DialogTitle>
          <DialogDescription>
            Record a shopping receipt for tracking purposes
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="client">Client *</Label>
            <Select value={clientId} onValueChange={setClientId} required>
              <SelectTrigger id="client">
                <SelectValue placeholder="Select a client" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="storeName">Store Name *</Label>
            <Input
              id="storeName"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              placeholder="e.g., Nordstrom, Zara"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="purchaseDate">Purchase Date *</Label>
              <Input
                id="purchaseDate"
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="totalAmount">Total Amount *</Label>
              <Input
                id="totalAmount"
                type="number"
                step="0.01"
                min="0"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="receiptPhoto">Receipt Photo</Label>
            {receiptPhotoPreview ? (
              <div className="relative">
                <img
                  src={receiptPhotoPreview}
                  alt="Receipt preview"
                  className="w-full h-48 object-contain border rounded-md bg-white"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={handleRemovePhoto}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="border-2 border-dashed rounded-md p-8 text-center">
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <Label htmlFor="receipt-photo-upload" className="cursor-pointer">
                  <span className="text-sm text-muted-foreground">
                    Click to upload receipt photo
                  </span>
                  <Input
                    id="receipt-photo-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoSelect}
                  />
                </Label>
                <p className="text-xs text-muted-foreground mt-2">
                  PNG, JPG up to 10MB
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="itemsList">Items (one per line or comma-separated)</Label>
            <Textarea
              id="itemsList"
              value={itemsList}
              onChange={(e) => setItemsList(e.target.value)}
              placeholder="Item 1, Item 2, Item 3..."
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              List items purchased (optional)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes about this purchase..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Adding...' : 'Add Receipt'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddReceiptDialog;
