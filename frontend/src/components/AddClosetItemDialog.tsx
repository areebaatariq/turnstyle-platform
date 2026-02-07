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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Upload, X, Plus } from 'lucide-react';
import { addClosetItem, getSubcategories, createSubcategory, Subcategory } from '@/utils/closetStorage';
import { showSuccess, showError } from '@/utils/toast';
import { ItemCategory } from '@/types';

interface AddClosetItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  closetId: string;
  onItemAdded: () => void;
}

const CATEGORIES: { value: ItemCategory; label: string }[] = [
  { value: 'tops', label: 'Tops' },
  { value: 'bottoms', label: 'Bottoms' },
  { value: 'dresses', label: 'Dresses' },
  { value: 'outerwear', label: 'Outerwear' },
  { value: 'shoes', label: 'Shoes' },
  { value: 'accessories', label: 'Accessories' },
  { value: 'bags', label: 'Bags' },
  { value: 'others', label: 'Others' },
];

const AddClosetItemDialog = ({
  open,
  onOpenChange,
  closetId,
  onItemAdded,
}: AddClosetItemDialogProps) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ItemCategory>('tops');
  const [subcategory, setSubcategory] = useState('');
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [showNewSubcategory, setShowNewSubcategory] = useState(false);
  const [newSubcategoryName, setNewSubcategoryName] = useState('');
  const [brand, setBrand] = useState('');
  const [size, setSize] = useState('');
  const [colorTags, setColorTags] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  // Load subcategories when category or dialog open changes
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getSubcategories(category).then((list) => {
      if (!cancelled) setSubcategories(list);
    });
    return () => { cancelled = true; };
  }, [open, category]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      showError('Item name is required');
      return;
    }

    if (!photoUrl.trim() && !photoFile) {
      showError('Photo is required - please upload an image or provide a URL');
      return;
    }

    setLoading(true);

    try {
      let finalPhotoUrl = photoUrl.trim();

      // Convert Google Drive URLs to full-size (avoids thumbnail/cropped display)
      if (finalPhotoUrl && !photoFile) {
        const { toFullSizeImageUrl } = await import('@/utils/fileUpload');
        finalPhotoUrl = toFullSizeImageUrl(finalPhotoUrl);
      }

      // Upload file if provided
      if (photoFile) {
        const { uploadImage } = await import('@/utils/fileUpload');
        finalPhotoUrl = await uploadImage(photoFile);
      }

      const colorTagsArray = colorTags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);

      await addClosetItem({
        closetId,
        name: name.trim(),
        category,
        subcategory: subcategory.trim() || undefined,
        brand: brand.trim() || undefined,
        size: size.trim() || undefined,
        colorTags: colorTagsArray,
        photoUrl: finalPhotoUrl,
        notes: notes.trim() || undefined,
      });

      showSuccess('Item added successfully');
      handleReset();
      onItemAdded();
      onOpenChange(false);
    } catch (error: any) {
      showError(error.message || 'Failed to add item');
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const { validateImageFile } = await import('@/utils/fileUpload');
    const validation = validateImageFile(file);
    if (!validation.valid) {
      showError(validation.error || 'Invalid image file');
      return;
    }

    setPhotoFile(file);
    
    try {
      const { uploadImage } = await import('@/utils/fileUpload');
      const preview = await uploadImage(file);
      setPhotoPreview(preview);
      setPhotoUrl(preview); // Auto-fill URL with uploaded image
    } catch (error: any) {
      showError(error.message || 'Failed to load image preview');
      setPhotoFile(null);
    }
  };

  const handleRemovePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview('');
    setPhotoUrl('');
    const input = document.getElementById('item-photo-upload') as HTMLInputElement;
    if (input) input.value = '';
  };

  const handleReset = () => {
    setName('');
    setCategory('tops');
    setSubcategory('');
    setShowNewSubcategory(false);
    setNewSubcategoryName('');
    setBrand('');
    setSize('');
    setColorTags('');
    setPhotoUrl('');
    setPhotoFile(null);
    setPhotoPreview('');
    setNotes('');
  };

  const handleCategoryChange = (value: ItemCategory) => {
    setCategory(value);
    setSubcategory('');
    setShowNewSubcategory(false);
    setNewSubcategoryName('');
  };

  const handleAddNewSubcategory = async () => {
    const trimmed = newSubcategoryName.trim();
    if (!trimmed) {
      showError('Enter a subcategory name');
      return;
    }
    try {
      const created = await createSubcategory(category, trimmed);
      if (created) {
        setSubcategories((prev) => [...prev.filter((s) => s.name.toLowerCase() !== trimmed.toLowerCase()), created].sort((a, b) => a.name.localeCompare(b.name)));
        setSubcategory(created.name);
        setShowNewSubcategory(false);
        setNewSubcategoryName('');
        showSuccess(`Subcategory "${created.name}" added`);
      }
    } catch (err: any) {
      showError(err.message || 'Failed to add subcategory');
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      handleReset();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[90vw] max-w-[90vw] sm:w-full sm:max-w-[500px] box-border overflow-x-hidden">
        <DialogHeader className="pr-8">
          <DialogTitle>Add Closet Item</DialogTitle>
          <DialogDescription>
            Add a new item to the closet. Fill in the details below.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 min-w-0">
          <div className="space-y-2 min-w-0">
            <Label htmlFor="name">Item Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Blue Denim Jeans"
              className="w-full min-w-0 max-w-full"
              required
            />
          </div>

          <div className="space-y-2 min-w-0">
            <Label htmlFor="category">Category *</Label>
            <Select value={category} onValueChange={(value) => handleCategoryChange(value as ItemCategory)}>
              <SelectTrigger id="category" className="w-full min-w-0 max-w-full">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 min-w-0">
            <Label>Subcategory (optional)</Label>
            {!showNewSubcategory ? (
              <div className="space-y-1.5 min-w-0">
                <Select
                  value={subcategories.some((s) => s.name === subcategory) ? subcategory : '__none__'}
                  onValueChange={(v) => v === '__new__' ? setShowNewSubcategory(true) : setSubcategory(v === '__none__' ? '' : v)}
                >
                  <SelectTrigger className="w-full min-w-0 max-w-full">
                    <SelectValue placeholder="None or add new" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    <SelectItem value="__new__">
                      <span className="flex items-center gap-1">
                        <Plus className="h-3 w-3" /> Add new subcategory…
                      </span>
                    </SelectItem>
                    {/* Only subcategories for the selected category (loaded via getSubcategories(category)) */}
                    {subcategories.map((s) => (
                      <SelectItem key={s.id} value={s.name}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {subcategories.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No subcategories yet. Choose &quot;Add new subcategory…&quot; above to create one (e.g. Blouses, Tanks, Skinny).
                  </p>
                )}
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-2 min-w-0">
                <Input
                  placeholder="New subcategory name"
                  value={newSubcategoryName}
                  onChange={(e) => setNewSubcategoryName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddNewSubcategory())}
                  className="flex-1 min-w-0 max-w-full"
                />
                <Button type="button" variant="secondary" onClick={handleAddNewSubcategory}>
                  Add
                </Button>
                <Button type="button" variant="ghost" size="icon" onClick={() => { setShowNewSubcategory(false); setNewSubcategoryName(''); }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 min-w-0">
            <div className="space-y-2 min-w-0">
              <Label htmlFor="brand">Brand</Label>
              <Input
                id="brand"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="e.g., Zara"
                className="w-full min-w-0 max-w-full"
              />
            </div>

            <div className="space-y-2 min-w-0">
              <Label htmlFor="size">Size</Label>
              <Input
                id="size"
                value={size}
                onChange={(e) => setSize(e.target.value)}
                placeholder="e.g., M, 10"
                className="w-full min-w-0 max-w-full"
              />
            </div>
          </div>

          <div className="space-y-2 min-w-0">
            <Label htmlFor="colors">Color Tags</Label>
            <Input
              id="colors"
              value={colorTags}
              onChange={(e) => setColorTags(e.target.value)}
              placeholder="e.g., blue, navy, denim"
              className="w-full min-w-0 max-w-full"
            />
            <p className="text-xs text-muted-foreground">
              Separate multiple colors with commas
            </p>
          </div>

          <div className="space-y-2 min-w-0">
            <Label htmlFor="photo">Photo *</Label>
            {photoPreview ? (
              <div className="relative">
                <img
                  src={photoPreview}
                  alt="Preview"
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
              <div className="space-y-2">
                <div className="border-2 border-dashed rounded-md p-4 text-center">
                  <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                  <Label htmlFor="item-photo-upload" className="cursor-pointer">
                    <span className="text-sm text-muted-foreground">
                      Click to upload photo
                    </span>
                    <Input
                      id="item-photo-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhotoSelect}
                    />
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    PNG, JPG up to 10MB
                  </p>
                </div>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">Or</span>
                  </div>
                </div>
                <Input
                  id="photo"
                  type="url"
                  value={photoUrl}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className="w-full min-w-0 max-w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Enter a photo URL if you prefer
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2 min-w-0">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes about this item..."
              rows={3}
              className="w-full min-w-0 max-w-full"
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
              {loading ? 'Adding...' : 'Add Item'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddClosetItemDialog;
