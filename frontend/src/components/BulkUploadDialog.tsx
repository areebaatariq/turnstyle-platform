import { useState, useRef, useEffect } from 'react';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Upload, X, Image as ImageIcon, CheckCircle2, Download, Plus } from 'lucide-react';
import { bulkAddClosetItems, getSubcategories, createSubcategory, Subcategory } from '@/utils/closetStorage';
import { toFullSizeImageUrl } from '@/utils/fileUpload';
import { ItemImageWithPreview } from '@/components/ItemImagePreview';
import { showSuccess, showError } from '@/utils/toast';
import { ItemCategory } from '@/types';

interface BulkUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  closetId: string;
  onItemsAdded: () => void;
}

interface PendingItem {
  id: string;
  file?: File;
  photoUrl: string;
  name: string;
  category: ItemCategory;
  subcategory?: string;
  brand?: string;
  size?: string;
  colorTags: string[];
  notes?: string;
  sizeTop?: string;
  sizeBottom?: string;
  sizeDress?: string;
  sizeShoes?: string;
  csvMatched?: boolean; // Indicates if this item matched with CSV data
  originalFileName?: string; // Store original filename for display
}

interface CSVRow {
  filename?: string;
  name?: string;
  category?: string;
  subcategory?: string;
  brand?: string;
  size?: string;
  sizeTop?: string;
  sizeBottom?: string;
  sizeDress?: string;
  sizeShoes?: string;
  colorTags?: string;
  notes?: string;
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

const BulkUploadDialog = ({
  open,
  onOpenChange,
  closetId,
  onItemsAdded,
}: BulkUploadDialogProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [commonBrand, setCommonBrand] = useState('');
  const [commonCategory, setCommonCategory] = useState<ItemCategory>('tops');
  const [commonSubcategory, setCommonSubcategory] = useState('');
  const [subcategoriesByCategory, setSubcategoriesByCategory] = useState<Partial<Record<ItemCategory, Subcategory[]>>>({});
  const [showNewSubcategoryBulk, setShowNewSubcategoryBulk] = useState(false);
  const [newSubcategoryNameBulk, setNewSubcategoryNameBulk] = useState('');
  const [commonColorTags, setCommonColorTags] = useState('');
  // Ref ensures file select handler always uses latest category (avoids stale closure)
  const commonCategoryRef = useRef(commonCategory);
  commonCategoryRef.current = commonCategory;
  const commonSubcategoryRef = useRef(commonSubcategory);
  commonSubcategoryRef.current = commonSubcategory;
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [csvData, setCsvData] = useState<Map<string, CSVRow>>(new Map());

  // Load subcategories for all categories when dialog is open (for both common and per-item dropdowns)
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const loadAll = async () => {
      const entries = await Promise.all(
        CATEGORIES.map(async (cat) => {
          const list = await getSubcategories(cat.value);
          return [cat.value, list] as const;
        })
      );
      if (!cancelled) {
        setSubcategoriesByCategory(Object.fromEntries(entries));
      }
    };
    loadAll();
    return () => { cancelled = true; };
  }, [open]);

  // Improved CSV parser that handles quoted fields
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          current += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // End of field
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    // Add last field
    result.push(current.trim());
    return result;
  };

  const parseCSV = (csvText: string): Map<string, CSVRow> => {
    const lines = csvText.split(/\r?\n/).map(line => line.trim()).filter(line => line);
    if (lines.length < 2) return new Map();

    // Parse header with improved parser
    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/^"|"$/g, ''));
    const filenameIndex = headers.findIndex(h => h.includes('filename') || (h.includes('file') && !h.includes('name')));
    const nameIndex = headers.findIndex(h => h.includes('name') && !h.includes('file'));
    const categoryIndex = headers.findIndex(h => h.includes('category'));
    const brandIndex = headers.findIndex(h => h.includes('brand'));
    const sizeIndex = headers.findIndex(h => h === 'size' || (h.includes('size') && !h.includes('top') && !h.includes('bottom') && !h.includes('dress') && !h.includes('shoes')));
    const sizeTopIndex = headers.findIndex(h => h.includes('size_top') || h.includes('sizetop') || (h.includes('top') && h.includes('size')));
    const sizeBottomIndex = headers.findIndex(h => h.includes('size_bottom') || h.includes('sizebottom') || (h.includes('bottom') && h.includes('size')));
    const sizeDressIndex = headers.findIndex(h => h.includes('size_dress') || h.includes('sizedress') || (h.includes('dress') && h.includes('size')));
    const sizeShoesIndex = headers.findIndex(h => h.includes('size_shoes') || h.includes('sizeshoes') || (h.includes('shoes') && h.includes('size')));
    const colorTagsIndex = headers.findIndex(h => h.includes('color') || h.includes('tags'));
    const notesIndex = headers.findIndex(h => h.includes('notes'));
    const subcategoryIndex = headers.findIndex(h => h.includes('subcategory') || h.includes('sub_category'));

    const csvMap = new Map<string, CSVRow>();

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]).map(v => v.replace(/^"|"$/g, ''));
      const filename = filenameIndex >= 0 ? values[filenameIndex] : undefined;
      
      if (filename) {
        // Normalize filename (remove extension and special chars for matching)
        const normalizedFilename = filename
          .toLowerCase()
          .replace(/\.[^/.]+$/, '')
          .replace(/[^a-z0-9]/g, '');
        csvMap.set(normalizedFilename, {
          filename,
          name: nameIndex >= 0 ? values[nameIndex] : undefined,
          category: categoryIndex >= 0 ? values[categoryIndex] : undefined,
          subcategory: subcategoryIndex >= 0 ? values[subcategoryIndex] : undefined,
          brand: brandIndex >= 0 ? values[brandIndex] : undefined,
          size: sizeIndex >= 0 ? values[sizeIndex] : undefined,
          sizeTop: sizeTopIndex >= 0 ? values[sizeTopIndex] : undefined,
          sizeBottom: sizeBottomIndex >= 0 ? values[sizeBottomIndex] : undefined,
          sizeDress: sizeDressIndex >= 0 ? values[sizeDressIndex] : undefined,
          sizeShoes: sizeShoesIndex >= 0 ? values[sizeShoesIndex] : undefined,
          colorTags: colorTagsIndex >= 0 ? values[colorTagsIndex] : undefined,
          notes: notesIndex >= 0 ? values[notesIndex] : undefined,
        });
      }
    }

    return csvMap;
  };

  const handleCSVSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const csvText = event.target?.result as string;
      const parsed = parseCSV(csvText);
      setCsvData(parsed);
      
      // Auto-apply CSV data to existing items
      if (parsed.size > 0 && pendingItems.length > 0) {
        const updatedItems = pendingItems.map(item => {
          const fileName = item.file?.name.toLowerCase().replace(/\.[^/.]+$/, '') || '';
          const csvRow = parsed.get(fileName);
          
          if (csvRow) {
            const colorTagsArray = csvRow.colorTags
              ? csvRow.colorTags.split(/[,\s]+/).map(tag => tag.trim()).filter(tag => tag.length > 0)
              : item.colorTags;

            // Validate category from CSV
            let validatedCategory = item.category;
            if (csvRow.category) {
              const csvCategory = csvRow.category.toLowerCase().trim();
              const validCategory = CATEGORIES.find(cat => cat.value === csvCategory || cat.label.toLowerCase() === csvCategory);
              validatedCategory = validCategory ? validCategory.value : item.category;
            }

            // Determine size - prioritize specific size fields
            const finalSize = csvRow.sizeTop || csvRow.sizeBottom || csvRow.sizeDress || csvRow.sizeShoes || csvRow.size || item.size;

            return {
              ...item,
              name: csvRow.name || item.name,
              category: validatedCategory,
              subcategory: csvRow.subcategory?.trim() || item.subcategory,
              brand: csvRow.brand || item.brand,
              size: finalSize,
              sizeTop: csvRow.sizeTop,
              sizeBottom: csvRow.sizeBottom,
              sizeDress: csvRow.sizeDress,
              sizeShoes: csvRow.sizeShoes,
              colorTags: colorTagsArray,
              notes: csvRow.notes || item.notes,
              csvMatched: true, // Mark as matched
            };
          }
          return item;
        });
        setPendingItems(updatedItems);
        const matchedCount = updatedItems.filter(item => item.csvMatched).length;
        showSuccess(`CSV imported. ${matchedCount} of ${updatedItems.length} existing item(s) matched with CSV data.`);
      } else if (parsed.size > 0) {
        showSuccess(`CSV imported with ${parsed.size} row(s). Upload images to automatically match them with CSV data.`);
      }
    };
    reader.onerror = () => {
      showError('Failed to read CSV file');
    };
    reader.readAsText(file);
  };

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    // Filter to image files only (folder upload may include non-image files)
    const imageFiles = Array.from(files).filter((file) =>
      file.type.startsWith('image/')
    );

    if (imageFiles.length === 0) {
      showError('No image files found. Please select or drop image files only.');
      return;
    }

    if (imageFiles.length > 200) {
      showError('Maximum 200 images allowed');
      return;
    }

    // Validate all files
    const { validateImageFile } = await import('@/utils/fileUpload');
    for (const file of imageFiles) {
      const validation = validateImageFile(file);
      if (!validation.valid) {
        showError(`${file.name}: ${validation.error}`);
        return;
      }
    }

    const newItems: PendingItem[] = imageFiles.map((file, index) => {
      const photoUrl = URL.createObjectURL(file); // Use blob URL for preview
      // Normalize filename for matching (same as CSV parsing)
      const fileName = file.name
        .toLowerCase()
        .replace(/\.[^/.]+$/, '')
        .replace(/[^a-z0-9]/g, '');
      
      // Try to match with CSV data
      const csvRow = csvData.get(fileName);
      
      // Determine size - prioritize specific size fields, then general size, then undefined
      let finalSize: string | undefined = undefined;
      if (csvRow) {
        // Priority: sizeTop, sizeBottom, sizeDress, sizeShoes, then size
        finalSize = csvRow.sizeTop || csvRow.sizeBottom || csvRow.sizeDress || csvRow.sizeShoes || csvRow.size;
      }
      
      const colorTagsArray = csvRow?.colorTags
        ? csvRow.colorTags.split(/[,\s]+/).map(tag => tag.trim()).filter(tag => tag.length > 0)
        : commonColorTags
          .split(/[,\s]+/)
          .map(tag => tag.trim())
          .filter(tag => tag.length > 0);

      return {
        id: `pending_${Date.now()}_${index}`,
        file,
        photoUrl,
        name: csvRow?.name || file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ') || `Item ${index + 1}`,
        category: (() => {
          // Validate category from CSV or use selected common category (use ref for latest value)
          const selectedCategory = commonCategoryRef.current;
          if (csvRow?.category) {
            const csvCategory = csvRow.category.toLowerCase().trim();
            const validCategory = CATEGORIES.find(cat => cat.value === csvCategory || cat.label.toLowerCase() === csvCategory);
            return validCategory ? validCategory.value : selectedCategory;
          }
          return selectedCategory;
        })(),
        subcategory: csvRow?.subcategory?.trim() || commonSubcategoryRef.current?.trim() || undefined,
        brand: csvRow?.brand || commonBrand.trim() || undefined,
        size: finalSize,
        sizeTop: csvRow?.sizeTop,
        sizeBottom: csvRow?.sizeBottom,
        sizeDress: csvRow?.sizeDress,
        sizeShoes: csvRow?.sizeShoes,
        colorTags: colorTagsArray,
        notes: csvRow?.notes,
        csvMatched: !!csvRow, // Mark if matched with CSV
        originalFileName: file.name, // Store original filename
      };
    });

    setPendingItems((prev) => [...prev, ...newItems]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleRemoveItem = (id: string) => {
    setPendingItems((prev) => {
      const item = prev.find((p) => p.id === id);
      if (item?.photoUrl.startsWith('blob:')) {
        URL.revokeObjectURL(item.photoUrl);
      }
      return prev.filter((p) => p.id !== id);
    });
  };

  const handleUpdateItem = (id: string, updates: Partial<PendingItem>) => {
    setPendingItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, ...updates } : item
      )
    );
  };

  const handleAddNewSubcategoryBulk = async () => {
    const trimmed = newSubcategoryNameBulk.trim();
    if (!trimmed) {
      showError('Enter a subcategory name');
      return;
    }
    try {
      const created = await createSubcategory(commonCategory, trimmed);
      if (created) {
        setSubcategoriesByCategory((prev) => {
          const list = prev[commonCategory] ?? [];
          const next = [...list.filter((s) => s.name.toLowerCase() !== trimmed.toLowerCase()), created].sort((a, b) =>
            a.name.localeCompare(b.name)
          );
          return { ...prev, [commonCategory]: next };
        });
        setCommonSubcategory(created.name);
        commonSubcategoryRef.current = created.name;
        setShowNewSubcategoryBulk(false);
        setNewSubcategoryNameBulk('');
        showSuccess(`Subcategory "${created.name}" added`);
      }
    } catch (err: any) {
      showError(err.message || 'Failed to add subcategory');
    }
  };

  const applyCommonFields = () => {
    const colorTagsArray = commonColorTags
      .split(/[,\s]+/)
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);

    setPendingItems((prev) =>
      prev.map((item) => ({
        ...item,
        category: commonCategory,
        subcategory: commonSubcategory.trim() || undefined,
        brand: commonBrand.trim() || undefined,
        colorTags: colorTagsArray.length > 0 ? colorTagsArray : item.colorTags,
      }))
    );

    showSuccess('Common fields applied to all items');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (pendingItems.length === 0) {
      showError('Please upload at least one image');
      return;
    }

    setLoading(true);

    try {
      // Upload all images first with better error handling
      showSuccess(`Uploading ${pendingItems.length} image(s)...`);
      
      const uploadResults = await Promise.allSettled(
        pendingItems.map(async (item) => {
          let photoUrl = item.photoUrl;
          
          // Upload file if it exists (not already a data URL)
          if (item.file && item.photoUrl.startsWith('blob:')) {
            try {
              const { uploadImage } = await import('@/utils/fileUpload');
              photoUrl = await uploadImage(item.file);
              // Clean up blob URL
              URL.revokeObjectURL(item.photoUrl);
            } catch (error: any) {
              console.error(`Error uploading image ${item.name}:`, error);
              throw new Error(`Failed to upload ${item.name || 'image'}: ${error.message || 'Unknown error'}`);
            }
          }

          // Determine final size - use specific size fields if available, otherwise use general size
          const finalSize = item.sizeTop || item.sizeBottom || item.sizeDress || item.sizeShoes || item.size;

          return {
            closetId,
            name: item.name.trim() || 'Untitled Item',
            category: item.category,
            subcategory: item.subcategory?.trim() || undefined,
            brand: item.brand?.trim() || undefined,
            size: finalSize || undefined,
            colorTags: item.colorTags.length > 0 ? item.colorTags : [],
            photoUrl,
            notes: item.notes?.trim() || undefined,
          };
        })
      );

      // Separate successful and failed uploads
      const successful: any[] = [];
      const failed: Array<{ item: PendingItem; error: string }> = [];

      uploadResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          successful.push(result.value);
        } else {
          failed.push({
            item: pendingItems[index],
            error: result.reason?.message || 'Unknown error',
          });
        }
      });

      // If some failed, show warning but continue with successful ones
      if (failed.length > 0) {
        console.warn('Some images failed to upload:', failed);
        showError(`${failed.length} image(s) failed to upload. Continuing with ${successful.length} item(s)...`);
      }

      // Only proceed if we have at least one successful upload
      if (successful.length === 0) {
        throw new Error('All image uploads failed. Please try again.');
      }

      // Bulk add successful items
      const addedItems = await bulkAddClosetItems(successful);

      // Clean up any remaining blob URLs
      pendingItems.forEach((item) => {
        if (item.photoUrl.startsWith('blob:')) {
          URL.revokeObjectURL(item.photoUrl);
        }
      });

      if (failed.length > 0) {
        showSuccess(`${addedItems.length} item(s) added successfully. ${failed.length} item(s) failed.`);
      } else {
        showSuccess(`${addedItems.length} item(s) added successfully`);
      }

      handleReset();
      onItemsAdded();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error in bulk upload:', error);
      showError(error.message || 'Failed to add items. Please try again.');
      
      // Clean up blob URLs on error
      pendingItems.forEach((item) => {
        if (item.photoUrl.startsWith('blob:')) {
          URL.revokeObjectURL(item.photoUrl);
        }
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    // Clean up blob URLs
    pendingItems.forEach((item) => {
      if (item.photoUrl.startsWith('blob:')) {
        URL.revokeObjectURL(item.photoUrl);
      }
    });

    setPendingItems([]);
    setCommonBrand('');
    setCommonCategory('tops');
    setCommonSubcategory('');
    setShowNewSubcategoryBulk(false);
    setNewSubcategoryNameBulk('');
    setCommonColorTags('');
    setIsDragging(false);
    setCsvData(new Map());

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (csvInputRef.current) {
      csvInputRef.current.value = '';
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
      <DialogContent className="w-[90vw] max-w-[90vw] sm:w-full sm:max-w-[800px] h-[90vh] max-h-[90vh] flex flex-col p-0 box-border overflow-x-hidden">
        <DialogHeader className="px-4 sm:px-6 pt-6 pb-4 flex-shrink-0 pr-10">
          <DialogTitle>Bulk Upload Closet Items</DialogTitle>
          <DialogDescription>
            Upload multiple images and add them to the closet. You can apply common fields to all items or edit them individually.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 min-w-0">
          <ScrollArea className="flex-1 px-4 sm:px-6 min-h-0 min-w-0">
            <div className="space-y-4 pb-4 pr-2 sm:pr-4 min-w-0">
          {/* CSV Import */}
          <div className="p-4 border rounded-md bg-blue-50 dark:bg-blue-950 min-w-0">
            <Label htmlFor="csv-upload" className="mb-2 block font-medium">
              Import CSV Metadata (Optional)
            </Label>
            <div className="text-sm text-muted-foreground mb-3 space-y-2">
              <p>Add metadata for your images. Filename column must match your image filenames (without extension).</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                asChild
              >
                <a
                  href="/sample-closet-items-import.csv"
                  download="sample-closet-items-import.csv"
                  className="flex items-center gap-2 w-fit"
                >
                  <Download className="h-4 w-4" />
                  Download sample CSV
                </a>
              </Button>
            </div>
            <Input
              id="csv-upload"
              type="file"
              accept=".csv"
              ref={csvInputRef}
              onChange={handleCSVSelect}
              className="cursor-pointer"
            />
            {csvData.size > 0 && (
              <div className="mt-2 space-y-1">
                <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                  ✓ CSV loaded with {csvData.size} row(s)
                </p>
                {pendingItems.length === 0 ? (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    👉 Add images below — CSV metadata will apply when filenames match (e.g. shirt-blue.jpg → shirt-blue)
                  </p>
                ) : (
                  <div className="text-xs space-y-1">
                    <p className="text-muted-foreground">
                      <span className="font-medium text-green-600 dark:text-green-400">
                        {pendingItems.filter(item => item.csvMatched).length}
                      </span> of{' '}
                      <span className="font-medium">{pendingItems.length}</span> image(s) matched with CSV data
                    </p>
                    {pendingItems.filter(item => !item.csvMatched).length > 0 && (
                      <p className="text-amber-600 dark:text-amber-400">
                        ⚠️ {pendingItems.filter(item => !item.csvMatched).length} image(s) not matched - will use default/common fields
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Common Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 border rounded-md bg-white min-w-0">
            <div className="space-y-2 min-w-0">
              <Label>Common Category</Label>
              <Select
                value={commonCategory}
                onValueChange={(value) => {
                setCommonCategory(value as ItemCategory);
                setCommonSubcategory('');
                setShowNewSubcategoryBulk(false);
                setNewSubcategoryNameBulk('');
              }}
              >
                <SelectTrigger className="w-full min-w-0 max-w-full">
                  <SelectValue />
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
              <Label>Common Subcategory</Label>
              {!showNewSubcategoryBulk ? (
                <div className="space-y-1.5 min-w-0">
                  <Select
                    value={
                      (() => {
                        const list = subcategoriesByCategory[commonCategory] ?? [];
                        const valid = list.some((s) => s.name === commonSubcategory);
                        return valid ? commonSubcategory : '__none__';
                      })()
                    }
                    onValueChange={(v) => {
                      if (v === '__new__') setShowNewSubcategoryBulk(true);
                      else setCommonSubcategory(v === '__none__' ? '' : v);
                    }}
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
                      {/* Only subcategories for the selected Common Category */}
                      {(subcategoriesByCategory[commonCategory] ?? []).map((s) => (
                        <SelectItem key={s.id} value={s.name}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {(subcategoriesByCategory[commonCategory] ?? []).length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Choose &quot;Add new subcategory…&quot; to create one for this category.
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-2 min-w-0">
                  <Input
                    placeholder="New subcategory name"
                    value={newSubcategoryNameBulk}
                    onChange={(e) => setNewSubcategoryNameBulk(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddNewSubcategoryBulk())}
                    className="w-full min-w-0 max-w-full"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="secondary" onClick={handleAddNewSubcategoryBulk}>
                      Add
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setShowNewSubcategoryBulk(false);
                        setNewSubcategoryNameBulk('');
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2 min-w-0">
              <Label>Common Brand</Label>
              <Input
                value={commonBrand}
                onChange={(e) => setCommonBrand(e.target.value)}
                placeholder="e.g., Zara"
                className="w-full min-w-0 max-w-full"
              />
            </div>

            <div className="space-y-2 min-w-0">
              <Label>Common Color Tags</Label>
              <Input
                value={commonColorTags}
                onChange={(e) => setCommonColorTags(e.target.value)}
                placeholder="e.g., blue, navy, red"
                className="w-full min-w-0 max-w-full"
              />
              <p className="text-xs text-muted-foreground">
                Separate multiple colors with commas
              </p>
            </div>

            {pendingItems.length > 0 && (
              <div className="col-span-1 sm:col-span-2 lg:col-span-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={applyCommonFields}
                  className="w-full"
                >
                  Apply to All Items
                </Button>
              </div>
            )}
          </div>

          {/* File Upload Area */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`border-2 border-dashed rounded-lg p-4 sm:p-8 text-center transition-colors min-w-0 ${
              isDragging
                ? 'border-primary bg-primary/10'
                : 'border-muted-foreground/25 hover:border-primary/50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={(e) => { handleFileSelect(e.target.files); e.target.value = ''; }}
              className="hidden"
            />
            <input
              ref={folderInputRef}
              type="file"
              multiple
              accept="image/*"
              // @ts-expect-error webkitdirectory is supported for folder selection in modern browsers
              webkitdirectory=""
              onChange={(e) => { handleFileSelect(e.target.files); e.target.value = ''; }}
              className="hidden"
            />
            <ImageIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-sm font-medium mb-2">
              Drag and drop images here, or{' '}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-primary underline"
              >
                browse files
              </button>
              {' '}or{' '}
              <button
                type="button"
                onClick={() => folderInputRef.current?.click()}
                className="text-primary underline"
              >
                upload folder
              </button>
            </p>
            <p className="text-xs text-muted-foreground mb-2">
              Select <strong>Common Category</strong> and <strong>Common Subcategory</strong> above first — all uploaded images will be assigned to them. Supports up to 200 images; only image files are used.
            </p>
            <p className="text-xs text-muted-foreground mb-1">
              Folder upload: choose a folder and all images inside it (including subfolders in some browsers) will be added with the selected category and subcategory.
            </p>
            {csvData.size > 0 && (
              <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                💡 Images will automatically match with CSV rows by filename (without extension)
              </p>
            )}
          </div>

          {/* Pending Items List */}
          {pendingItems.length > 0 && (
            <div className="flex flex-col min-w-0" style={{ minHeight: '400px', maxHeight: '600px' }}>
              <div className="flex items-center justify-between mb-2 flex-shrink-0 min-w-0 gap-2">
                <Label className="min-w-0 truncate">{pendingItems.length} item(s) ready to upload</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setPendingItems([])}
                  className="text-xs"
                >
                  Clear All
                </Button>
              </div>
              <div className="border rounded-md overflow-hidden min-w-0" style={{ height: '600px' }}>
                <ScrollArea className="h-full w-full min-w-0">
                  <div className="p-4 min-w-0">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 min-w-0">
                  {pendingItems.map((item) => (
                    <Card key={item.id} className={`p-3 space-y-2 ${item.csvMatched ? 'border-green-500 border-2' : ''}`}>
                      <div className="relative">
                        <ItemImageWithPreview
                          photoUrl={item.photoUrl}
                          alt={item.name}
                          caption={item.name}
                          className="w-full h-32 object-contain bg-muted rounded"
                        />
                        {item.csvMatched && (
                          <div className="absolute top-1 left-1 bg-green-500 text-white rounded-full p-1" title="Matched with CSV data">
                            <CheckCircle2 className="h-3 w-3" />
                          </div>
                        )}
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-1 right-1 h-6 w-6"
                          onClick={() => handleRemoveItem(item.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                      {item.originalFileName && (
                        <p className="text-xs text-muted-foreground truncate" title={item.originalFileName}>
                          📁 {item.originalFileName}
                        </p>
                      )}

                      <Input
                        value={item.name}
                        onChange={(e) =>
                          handleUpdateItem(item.id, { name: e.target.value })
                        }
                        placeholder="Item name"
                        className="text-sm"
                      />

                      <Select
                        value={item.category}
                        onValueChange={(value) =>
                          handleUpdateItem(item.id, { category: value as ItemCategory, subcategory: undefined })
                        }
                      >
                        <SelectTrigger className="text-xs h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map((cat) => (
                            <SelectItem key={cat.value} value={cat.value}>
                              {cat.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select
                        value={(() => {
                          const list = subcategoriesByCategory[item.category] ?? [];
                          const valid = item.subcategory && list.some((s) => s.name === item.subcategory);
                          return valid ? item.subcategory! : '__none__';
                        })()}
                        onValueChange={(v) =>
                          handleUpdateItem(item.id, { subcategory: v === '__none__' ? undefined : v })
                        }
                      >
                        <SelectTrigger className="text-xs h-8">
                          <SelectValue placeholder="Subcategory" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">None</SelectItem>
                          {/* Only subcategories for this item's category */}
                          {(subcategoriesByCategory[item.category] ?? []).map((s) => (
                            <SelectItem key={s.id} value={s.name}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Input
                        value={item.brand || ''}
                        onChange={(e) =>
                          handleUpdateItem(item.id, { brand: e.target.value })
                        }
                        placeholder="Brand"
                        className="text-xs h-8"
                      />

                      <Input
                        value={item.colorTags.join(', ')}
                        onChange={(e) => {
                          const colorTagsArray = e.target.value
                            .split(/[,\s]+/)
                            .map(tag => tag.trim())
                            .filter(tag => tag.length > 0);
                          handleUpdateItem(item.id, { colorTags: colorTagsArray });
                        }}
                        placeholder="Color tags"
                        className="text-xs h-8"
                      />
                    </Card>
                  ))}
                    </div>
                  </div>
                </ScrollArea>
              </div>
            </div>
          )}
            </div>
          </ScrollArea>

          <DialogFooter className="flex-shrink-0 px-4 sm:px-6 pb-6 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || pendingItems.length === 0}>
              {loading ? 'Uploading...' : `Upload ${pendingItems.length} Item(s)`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default BulkUploadDialog;
