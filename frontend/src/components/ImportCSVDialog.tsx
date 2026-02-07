import { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, X, Download } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { bulkImportClients } from '@/utils/clientStorage';
import { toFullSizeImageUrl } from '@/utils/fileUpload';
import { showSuccess, showError } from '@/utils/toast';
import { Client } from '@/types';

interface ImportCSVDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClientsImported: () => void;
}

interface ParsedClient {
  name: string;
  email: string;
  phone?: string;
  sizeTop?: string;
  sizeBottom?: string;
  sizeDress?: string;
  sizeShoes?: string;
  braSize?: string;
  colorPreferences?: string;
  profilePhotoUrl?: string;
  featuresYouLove?: string;
  wardrobeColors?: string;
  personalStyle?: string;
  dailySchedule?: string;
  featuresYouDislike?: string;
  styleIcons?: string;
  styleIconsDescription?: string;
  additionalStyleInfo?: string;
  instagramHandle?: string;
  outfitsPerDayEstimate?: string;
  weekdayOutfitDetails?: string;
}

const ImportCSVDialog = ({
  open,
  onOpenChange,
  onClientsImported,
}: ImportCSVDialogProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsedClients, setParsedClients] = useState<ParsedClient[]>([]);
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const parseCSV = (csvText: string): ParsedClient[] => {
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length === 0) return [];

    // Helper function to parse CSV line with proper quote handling
    const parseCSVLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
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

    // Parse header row
    const headerLine = lines[0];
    const headers = parseCSVLine(headerLine).map(h => h.replace(/^"|"$/g, '').trim().toLowerCase());
    
    // Find column indices (with flexible matching)
    const nameIndex = headers.findIndex(h => h === 'name' || h.includes('name'));
    const emailIndex = headers.findIndex(h => h === 'email' || h.includes('email'));
    const phoneIndex = headers.findIndex(h => h === 'phone' || h.includes('phone'));
    const profilePhotoIndex = headers.findIndex(h => 
      h === 'profile_photo_url' || h === 'profilephotourl' || h === 'profile_photo' || 
      h === 'photo_url' || h === 'photourl' || h === 'photo' || 
      (h.includes('profile') && h.includes('photo')) || (h.includes('photo') && h.includes('url'))
    );
    const sizeTopIndex = headers.findIndex(h => 
      h === 'size_top' || h === 'sizetop' || (h.includes('size') && h.includes('top')) || h === 'top'
    );
    const sizeBottomIndex = headers.findIndex(h => 
      h === 'size_bottom' || h === 'sizebottom' || (h.includes('size') && h.includes('bottom')) || h === 'bottom'
    );
    const sizeDressIndex = headers.findIndex(h => 
      h === 'size_dress' || h === 'sizedress' || (h.includes('size') && h.includes('dress')) || h === 'dress'
    );
    const sizeShoesIndex = headers.findIndex(h => 
      h === 'size_shoes' || h === 'sizeshoes' || (h.includes('size') && h.includes('shoes')) || h === 'shoes'
    );
    const braSizeIndex = headers.findIndex(h => 
      h === 'bra_size' || h === 'brasize' || (h.includes('bra') && h.includes('size'))
    );
    const colorPreferencesIndex = headers.findIndex(h => 
      h === 'color_preferences' || h === 'colorpreferences' || 
      (h.includes('color') && h.includes('preference')) || h === 'colors'
    );
    const featuresYouLoveIndex = headers.findIndex(h => 
      h === 'features_you_love' || h === 'featuresyoulove' || (h.includes('features') && h.includes('love'))
    );
    const wardrobeColorsIndex = headers.findIndex(h => 
      h === 'wardrobe_colors' || h === 'wardrobecolors' || (h.includes('wardrobe') && h.includes('color'))
    );
    const personalStyleIndex = headers.findIndex(h => 
      h === 'personal_style' || h === 'personalstyle' || (h.includes('personal') && h.includes('style'))
    );
    const dailyScheduleIndex = headers.findIndex(h => 
      h === 'daily_schedule' || h === 'dailyschedule' || (h.includes('daily') && h.includes('schedule'))
    );
    const featuresYouDislikeIndex = headers.findIndex(h => 
      h === 'features_you_dont_like' || h === 'featuresyoudontlike' || (h.includes('features') && h.includes('dont') && h.includes('like'))
    );
    const styleIconsIndex = headers.findIndex(h => 
      h === 'style_icons' || h === 'styleicons' || (h.includes('style') && h.includes('icon'))
    );
    const styleIconsDescriptionIndex = headers.findIndex(h => 
      h === 'describe_style_icons' || h === 'describestyleicons' || (h.includes('describe') && h.includes('style') && h.includes('icon'))
    );
    const additionalStyleInfoIndex = headers.findIndex(h => 
      h === 'additional_style_info' || h === 'additionalstyleinfo' || (h.includes('anything') && h.includes('style')) || (h.includes('style') && h.includes('share'))
    );
    const instagramHandleIndex = headers.findIndex(h => 
      h === 'instagram_handle' || h === 'instagramhandle' || h === 'instagram' || h.includes('instagram')
    );
    const outfitsPerDayEstimateIndex = headers.findIndex(h => 
      h === 'outfits_per_day' || h === 'outfitsperday' || (h.includes('outfit') && h.includes('day'))
    );
    const weekdayOutfitDetailsIndex = headers.findIndex(h => 
      h === 'weekday_outfits' || h === 'weekdayoutfits' || (h.includes('weekday') && h.includes('outfit'))
    );

    // Validate required columns
    if (nameIndex === -1 || emailIndex === -1) {
      showError('CSV must have "name" and "email" columns');
      return [];
    }

    const clients: ParsedClient[] = [];
    const errors: string[] = [];

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      try {
        const values = parseCSVLine(lines[i]).map(v => v.replace(/^"|"$/g, '').trim());
        
        if (values.length <= Math.max(nameIndex, emailIndex)) {
          errors.push(`Row ${i + 1}: Not enough columns`);
          continue;
        }

        const name = values[nameIndex];
        const email = values[emailIndex];

        // Skip empty rows
        if (!name && !email) continue;

        // Validate required fields
        if (!name) {
          errors.push(`Row ${i + 1}: Missing name`);
          continue;
        }

        if (!email) {
          errors.push(`Row ${i + 1}: Missing email`);
          continue;
        }

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          errors.push(`Row ${i + 1}: Invalid email format: ${email}`);
          continue;
        }

        const rawProfilePhoto = profilePhotoIndex !== -1 && values[profilePhotoIndex] ? values[profilePhotoIndex].trim() : undefined;
        clients.push({
          name: name.trim(),
          email: email.toLowerCase().trim(),
          phone: phoneIndex !== -1 && values[phoneIndex] ? values[phoneIndex].trim() : undefined,
          profilePhotoUrl: rawProfilePhoto ? toFullSizeImageUrl(rawProfilePhoto) : undefined,
          sizeTop: sizeTopIndex !== -1 && values[sizeTopIndex] ? values[sizeTopIndex].trim() : undefined,
          sizeBottom: sizeBottomIndex !== -1 && values[sizeBottomIndex] ? values[sizeBottomIndex].trim() : undefined,
          sizeDress: sizeDressIndex !== -1 && values[sizeDressIndex] ? values[sizeDressIndex].trim() : undefined,
          sizeShoes: sizeShoesIndex !== -1 && values[sizeShoesIndex] ? values[sizeShoesIndex].trim() : undefined,
          braSize: braSizeIndex !== -1 && values[braSizeIndex] ? values[braSizeIndex].trim() : undefined,
          colorPreferences: colorPreferencesIndex !== -1 && values[colorPreferencesIndex] ? values[colorPreferencesIndex].trim() : undefined,
          featuresYouLove: featuresYouLoveIndex !== -1 && values[featuresYouLoveIndex] ? values[featuresYouLoveIndex].trim() : undefined,
          wardrobeColors: wardrobeColorsIndex !== -1 && values[wardrobeColorsIndex] ? values[wardrobeColorsIndex].trim() : undefined,
          personalStyle: personalStyleIndex !== -1 && values[personalStyleIndex] ? values[personalStyleIndex].trim() : undefined,
          dailySchedule: dailyScheduleIndex !== -1 && values[dailyScheduleIndex] ? values[dailyScheduleIndex].trim() : undefined,
          featuresYouDislike: featuresYouDislikeIndex !== -1 && values[featuresYouDislikeIndex] ? values[featuresYouDislikeIndex].trim() : undefined,
          styleIcons: styleIconsIndex !== -1 && values[styleIconsIndex] ? values[styleIconsIndex].trim() : undefined,
          styleIconsDescription: styleIconsDescriptionIndex !== -1 && values[styleIconsDescriptionIndex] ? values[styleIconsDescriptionIndex].trim() : undefined,
          additionalStyleInfo: additionalStyleInfoIndex !== -1 && values[additionalStyleInfoIndex] ? values[additionalStyleInfoIndex].trim() : undefined,
          instagramHandle: instagramHandleIndex !== -1 && values[instagramHandleIndex] ? values[instagramHandleIndex].trim() : undefined,
          outfitsPerDayEstimate: outfitsPerDayEstimateIndex !== -1 && values[outfitsPerDayEstimateIndex] ? values[outfitsPerDayEstimateIndex].trim() : undefined,
          weekdayOutfitDetails: weekdayOutfitDetailsIndex !== -1 && values[weekdayOutfitDetailsIndex] ? values[weekdayOutfitDetailsIndex].trim() : undefined,
        });
      } catch (error) {
        errors.push(`Row ${i + 1}: Error parsing row`);
      }
    }

    // Show warnings for rows with errors, but continue with valid rows
    if (errors.length > 0 && clients.length > 0) {
      console.warn('CSV parsing warnings:', errors);
    } else if (errors.length > 0 && clients.length === 0) {
      showError(`CSV parsing failed: ${errors.slice(0, 3).join('; ')}${errors.length > 3 ? '...' : ''}`);
      return [];
    }

    return clients;
  };

  const handleFileSelect = (file: File | null) => {
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      showError('Please select a CSV file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      try {
        const clients = parseCSV(text);
        if (clients.length === 0) {
          showError('No valid client data found in CSV');
          return;
        }
        setParsedClients(clients);
      } catch (error) {
        showError('Failed to parse CSV file');
      }
    };
    reader.onerror = () => {
      showError('Failed to read file');
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    handleFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (parsedClients.length === 0) {
      showError('Please import a CSV file first');
      return;
    }

    setLoading(true);

    try {
      // The backend now handles relationship creation automatically
      const response = await bulkImportClients(parsedClients);
      
      // Check if response includes metadata (new backend response format)
      const importedCount = Array.isArray(response) ? response.length : (response as any).data?.length || 0;
      const skippedCount = (response as any).skipped || 0;
      
      let message = `${importedCount} client(s) imported successfully`;
      if (skippedCount > 0) {
        message += ` (${skippedCount} skipped - already exist)`;
      }
      
      if (importedCount === 0) {
        showError('No clients were imported. All clients already exist.');
      } else {
        showSuccess(message);
        handleReset();
        onClientsImported();
        onOpenChange(false);
      }
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to import clients';
      showError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setParsedClients([]);
    setIsDragging(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
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
      <DialogContent className="w-[80vw] max-w-[80vw] sm:w-full sm:max-w-[700px] max-h-[90vh] flex flex-col p-0 box-border overflow-x-hidden">
        <DialogHeader className="px-4 sm:px-6 pt-6 pb-4 flex-shrink-0 pr-10">
          <DialogTitle>Import Clients from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file with client information. Download the sample file to see the expected format.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col min-w-0">
          {parsedClients.length === 0 ? (
            <div className="px-4 sm:px-6 pb-6 flex-shrink-0">
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
                accept=".csv"
                onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                className="hidden"
              />
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm font-medium mb-2 text-center">
                Drag and drop a CSV file here, or{' '}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-primary underline"
                >
                  browse
                </button>
              </p>
              <div className="flex justify-center mt-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  asChild
                >
                  <a
                    href="/sample-clients-import.csv"
                    download="sample-clients-import.csv"
                    className="flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Download sample CSV
                  </a>
                </Button>
              </div>
            </div>
            </div>
          ) : (
            <div className="flex flex-col min-w-0 space-y-4 px-4 sm:px-6 pb-4">
              <Card className="flex flex-col min-w-0 p-4 overflow-hidden">
                <div className="flex items-center justify-between mb-4 flex-shrink-0 min-w-0 gap-2">
                  <Label>{parsedClients.length} client(s) ready to import</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setParsedClients([]);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                      }
                    }}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Clear All
                  </Button>
                </div>

                <div className="border rounded-md overflow-auto min-w-0" style={{ maxHeight: 'min(400px, 50vh)' }}>
                  <div className="h-full min-w-0 overflow-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(0, 0, 0, 0.3) transparent' }}>
                    <style>{`
                      div[style*="scrollbarWidth"]::-webkit-scrollbar {
                        width: 8px;
                        height: 8px;
                      }
                      div[style*="scrollbarWidth"]::-webkit-scrollbar-track {
                        background: transparent;
                      }
                      div[style*="scrollbarWidth"]::-webkit-scrollbar-thumb {
                        background-color: rgba(0, 0, 0, 0.3);
                        border-radius: 4px;
                      }
                      div[style*="scrollbarWidth"]::-webkit-scrollbar-thumb:hover {
                        background-color: rgba(0, 0, 0, 0.5);
                      }
                      div[style*="scrollbarWidth"]::-webkit-scrollbar-corner {
                        background: transparent;
                      }
                    `}</style>
                    <Table className="min-w-full">
                      <TableHeader className="sticky top-0 bg-white z-10">
                        <TableRow>
                          <TableHead className="w-16 whitespace-nowrap">Photo</TableHead>
                          <TableHead className="whitespace-nowrap min-w-[120px]">Name</TableHead>
                          <TableHead className="whitespace-nowrap min-w-[180px]">Email</TableHead>
                          <TableHead className="whitespace-nowrap min-w-[120px]">Phone</TableHead>
                          <TableHead className="whitespace-nowrap min-w-[200px]">Sizes</TableHead>
                          <TableHead className="w-16 text-center whitespace-nowrap">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parsedClients.map((client, index) => {
                          const getInitials = (name: string) => {
                            return name
                              .split(' ')
                              .map(n => n[0])
                              .join('')
                              .toUpperCase()
                              .slice(0, 2);
                          };
                          
                          const handleRemoveClient = () => {
                            setParsedClients(prev => prev.filter((_, i) => i !== index));
                          };
                          
                          return (
                            <TableRow key={index}>
                              <TableCell className="whitespace-nowrap">
                                <Avatar className="h-8 w-8">
                                  {client.profilePhotoUrl && (
                                    <AvatarImage src={client.profilePhotoUrl ? toFullSizeImageUrl(client.profilePhotoUrl) : undefined} alt={client.name} />
                                  )}
                                  <AvatarFallback>{getInitials(client.name)}</AvatarFallback>
                                </Avatar>
                              </TableCell>
                              <TableCell className="font-medium whitespace-nowrap">{client.name}</TableCell>
                              <TableCell className="whitespace-nowrap">{client.email}</TableCell>
                              <TableCell className="whitespace-nowrap">{client.phone || '-'}</TableCell>
                              <TableCell className="text-xs whitespace-nowrap">
                                {[
                                  client.sizeTop && `Top: ${client.sizeTop}`,
                                  client.sizeBottom && `Bottom: ${client.sizeBottom}`,
                                  client.sizeDress && `Dress: ${client.sizeDress}`,
                                  client.sizeShoes && `Shoes: ${client.sizeShoes}`,
                                ]
                                  .filter(Boolean)
                                  .join(', ') || '-'}
                              </TableCell>
                              <TableCell className="whitespace-nowrap">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={handleRemoveClient}
                                  title="Remove client"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        </TableBody>
                      </Table>
                    </div>
                </div>
              </Card>
            </div>
          )}

          <DialogFooter className="flex-shrink-0 px-4 sm:px-6 pb-6 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || parsedClients.length === 0}>
              {loading ? 'Importing...' : `Import ${parsedClients.length} Client(s)`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ImportCSVDialog;
