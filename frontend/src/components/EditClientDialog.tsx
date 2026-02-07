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
import { Upload, X } from 'lucide-react';
import { updateClient } from '@/utils/clientStorage';
import { showSuccess, showError } from '@/utils/toast';
import { Client } from '@/types';

interface EditClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client | null;
  onClientUpdated: () => void;
}

const EditClientDialog = ({
  open,
  onOpenChange,
  client,
  onClientUpdated,
}: EditClientDialogProps) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [sizeTop, setSizeTop] = useState('');
  const [sizeBottom, setSizeBottom] = useState('');
  const [sizeDress, setSizeDress] = useState('');
  const [sizeShoes, setSizeShoes] = useState('');
  const [braSize, setBraSize] = useState('');
  const [colorPreferences, setColorPreferences] = useState('');
  const [featuresYouLove, setFeaturesYouLove] = useState('');
  const [wardrobeColors, setWardrobeColors] = useState('');
  const [personalStyle, setPersonalStyle] = useState('');
  const [dailySchedule, setDailySchedule] = useState('');
  const [featuresYouDislike, setFeaturesYouDislike] = useState('');
  const [styleIcons, setStyleIcons] = useState('');
  const [styleIconsDescription, setStyleIconsDescription] = useState('');
  const [additionalStyleInfo, setAdditionalStyleInfo] = useState('');
  const [instagramHandle, setInstagramHandle] = useState('');
  const [outfitsPerDayEstimate, setOutfitsPerDayEstimate] = useState('');
  const [weekdayOutfitDetails, setWeekdayOutfitDetails] = useState('');
  const [profilePhotoUrl, setProfilePhotoUrl] = useState('');
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Load client data when dialog opens
  useEffect(() => {
    if (client && open) {
      setName(client.name || '');
      setEmail(client.email || '');
      setPhone(client.phone || '');
      setSizeTop(client.sizeTop || '');
      setSizeBottom(client.sizeBottom || '');
      setSizeDress(client.sizeDress || '');
      setSizeShoes(client.sizeShoes || '');
      setBraSize(client.braSize || '');
      setColorPreferences(client.colorPreferences || '');
      setFeaturesYouLove(client.featuresYouLove || '');
      setWardrobeColors(client.wardrobeColors || '');
      setPersonalStyle(client.personalStyle || '');
      setDailySchedule(client.dailySchedule || '');
      setFeaturesYouDislike(client.featuresYouDislike || '');
      setStyleIcons(client.styleIcons || '');
      setStyleIconsDescription(client.styleIconsDescription || '');
      setAdditionalStyleInfo(client.additionalStyleInfo || '');
      setInstagramHandle(client.instagramHandle || '');
      setOutfitsPerDayEstimate(client.outfitsPerDayEstimate || '');
      setWeekdayOutfitDetails(client.weekdayOutfitDetails || '');
      setProfilePhotoUrl(client.profilePhotoUrl || '');
      setProfilePhotoPreview(client.profilePhotoUrl || '');
      setProfilePhotoFile(null);
    }
  }, [client, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!client) {
      showError('No client selected');
      return;
    }

    if (!name.trim()) {
      showError('Client name is required');
      return;
    }

    if (!email.trim()) {
      showError('Client email is required');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      showError('Please enter a valid email address');
      return;
    }

    setLoading(true);

    try {
      let finalProfilePhotoUrl = profilePhotoUrl.trim();
      
      // Upload file if provided
      if (profilePhotoFile) {
        const { uploadImage } = await import('@/utils/fileUpload');
        finalProfilePhotoUrl = await uploadImage(profilePhotoFile);
      }

      const updatedClient = await updateClient(client.id, {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || undefined,
        sizeTop: sizeTop.trim() || undefined,
        sizeBottom: sizeBottom.trim() || undefined,
        sizeDress: sizeDress.trim() || undefined,
        sizeShoes: sizeShoes.trim() || undefined,
        braSize: braSize.trim() || undefined,
        colorPreferences: colorPreferences.trim() || undefined,
        featuresYouLove: featuresYouLove.trim() || undefined,
        wardrobeColors: wardrobeColors.trim() || undefined,
        personalStyle: personalStyle.trim() || undefined,
        dailySchedule: dailySchedule.trim() || undefined,
        featuresYouDislike: featuresYouDislike.trim() || undefined,
        styleIcons: styleIcons.trim() || undefined,
        styleIconsDescription: styleIconsDescription.trim() || undefined,
        additionalStyleInfo: additionalStyleInfo.trim() || undefined,
        instagramHandle: instagramHandle.trim() || undefined,
        outfitsPerDayEstimate: outfitsPerDayEstimate.trim() || undefined,
        weekdayOutfitDetails: weekdayOutfitDetails.trim() || undefined,
        profilePhotoUrl: finalProfilePhotoUrl || undefined,
      });

      if (!updatedClient) {
        throw new Error('Failed to update client');
      }

      showSuccess(`${name} updated successfully`);
      handleReset();
      onClientUpdated();
      onOpenChange(false);
    } catch (error: any) {
      showError(error.message || 'Failed to update client');
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

    setProfilePhotoFile(file);
    
    try {
      const { uploadImage } = await import('@/utils/fileUpload');
      const preview = await uploadImage(file);
      setProfilePhotoPreview(preview);
      setProfilePhotoUrl(preview); // Auto-fill URL with uploaded image
    } catch (error: any) {
      showError(error.message || 'Failed to load image preview');
      setProfilePhotoFile(null);
    }
  };

  const handleRemovePhoto = () => {
    setProfilePhotoFile(null);
    setProfilePhotoPreview('');
    setProfilePhotoUrl('');
    const input = document.getElementById('edit-client-photo-upload') as HTMLInputElement;
    if (input) input.value = '';
  };

  const handleReset = () => {
    if (client) {
      setName(client.name || '');
      setEmail(client.email || '');
      setPhone(client.phone || '');
      setSizeTop(client.sizeTop || '');
      setSizeBottom(client.sizeBottom || '');
      setSizeDress(client.sizeDress || '');
      setSizeShoes(client.sizeShoes || '');
      setBraSize(client.braSize || '');
      setColorPreferences(client.colorPreferences || '');
      setFeaturesYouLove(client.featuresYouLove || '');
      setWardrobeColors(client.wardrobeColors || '');
      setPersonalStyle(client.personalStyle || '');
      setDailySchedule(client.dailySchedule || '');
      setFeaturesYouDislike(client.featuresYouDislike || '');
      setStyleIcons(client.styleIcons || '');
      setStyleIconsDescription(client.styleIconsDescription || '');
      setAdditionalStyleInfo(client.additionalStyleInfo || '');
      setInstagramHandle(client.instagramHandle || '');
      setOutfitsPerDayEstimate(client.outfitsPerDayEstimate || '');
      setWeekdayOutfitDetails(client.weekdayOutfitDetails || '');
      setProfilePhotoUrl(client.profilePhotoUrl || '');
      setProfilePhotoPreview(client.profilePhotoUrl || '');
    }
    setProfilePhotoFile(null);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      handleReset();
    }
    onOpenChange(newOpen);
  };

  if (!client) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[80vw] max-w-[500px] rounded-lg">
        <DialogHeader>
          <DialogTitle>Edit Client</DialogTitle>
          <DialogDescription>
            Update client information, sizes, and profile photo.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Name *</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Jane Smith"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-email">Email *</Label>
            <Input
              id="edit-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@example.com"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-phone">Phone</Label>
            <Input
              id="edit-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 (555) 123-4567"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-photo">Profile Photo</Label>
            {profilePhotoPreview ? (
              <div className="relative">
                <img
                  src={profilePhotoPreview}
                  alt="Profile preview"
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
                  <Label htmlFor="edit-client-photo-upload" className="cursor-pointer">
                    <span className="text-sm text-muted-foreground">
                      Click to upload photo
                    </span>
                    <Input
                      id="edit-client-photo-upload"
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
                  id="edit-photo"
                  type="url"
                  value={profilePhotoUrl}
                  onChange={(e) => {
                    setProfilePhotoUrl(e.target.value);
                    setProfilePhotoPreview(e.target.value || '');
                  }}
                  placeholder="https://example.com/photo.jpg"
                />
                <p className="text-xs text-muted-foreground">
                  Enter a photo URL if you prefer
                </p>
              </div>
            )}
          </div>

          <div className="border-t pt-4">
            <p className="text-sm font-medium mb-3">Sizes (Optional)</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-sizeTop">Top</Label>
                <Input
                  id="edit-sizeTop"
                  value={sizeTop}
                  onChange={(e) => setSizeTop(e.target.value)}
                  placeholder="e.g., M, 10"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-sizeBottom">Bottom</Label>
                <Input
                  id="edit-sizeBottom"
                  value={sizeBottom}
                  onChange={(e) => setSizeBottom(e.target.value)}
                  placeholder="e.g., 32, L"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-sizeDress">Dress</Label>
                <Input
                  id="edit-sizeDress"
                  value={sizeDress}
                  onChange={(e) => setSizeDress(e.target.value)}
                  placeholder="e.g., 8, M"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-sizeShoes">Shoes</Label>
                <Input
                  id="edit-sizeShoes"
                  value={sizeShoes}
                  onChange={(e) => setSizeShoes(e.target.value)}
                  placeholder="e.g., 9, 40"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-braSize">Bra Size</Label>
                <Input
                  id="edit-braSize"
                  value={braSize}
                  onChange={(e) => setBraSize(e.target.value)}
                  placeholder="e.g., 34C"
                />
              </div>
            </div>

            <div className="space-y-2 mt-4">
              <Label htmlFor="edit-colorPreferences">Color Preferences</Label>
              <Input
                id="edit-colorPreferences"
                value={colorPreferences}
                onChange={(e) => setColorPreferences(e.target.value)}
                placeholder="e.g., navy, earth tones, pastels"
              />
            </div>

            <div className="space-y-2 mt-4">
              <Label htmlFor="edit-featuresYouLove">Features you love about yourself (optional)</Label>
              <Input
                id="edit-featuresYouLove"
                value={featuresYouLove}
                onChange={(e) => setFeaturesYouLove(e.target.value)}
                placeholder="e.g., my shoulders, my legs"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-wardrobeColors">Wardrobe colors (optional)</Label>
              <Input
                id="edit-wardrobeColors"
                value={wardrobeColors}
                onChange={(e) => setWardrobeColors(e.target.value)}
                placeholder="e.g., neutrals, black, navy"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-personalStyle">Personal style (optional)</Label>
              <Input
                id="edit-personalStyle"
                value={personalStyle}
                onChange={(e) => setPersonalStyle(e.target.value)}
                placeholder="e.g., eclectic, minimal, clean, edgy"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-dailySchedule">Daily schedule (optional)</Label>
              <Input
                id="edit-dailySchedule"
                value={dailySchedule}
                onChange={(e) => setDailySchedule(e.target.value)}
                placeholder="e.g., wake up, workout, work, dinner"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-featuresYouDislike">Features you don&apos;t like as much (optional)</Label>
              <Input
                id="edit-featuresYouDislike"
                value={featuresYouDislike}
                onChange={(e) => setFeaturesYouDislike(e.target.value)}
                placeholder="e.g., my arms, my midsection"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-styleIcons">Who are your style icons? (optional)</Label>
              <Input
                id="edit-styleIcons"
                value={styleIcons}
                onChange={(e) => setStyleIcons(e.target.value)}
                placeholder="e.g., celebrities, influencers"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-styleIconsDescription">Describe your style icons (optional)</Label>
              <Input
                id="edit-styleIconsDescription"
                value={styleIconsDescription}
                onChange={(e) => setStyleIconsDescription(e.target.value)}
                placeholder="What you love about their style"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-additionalStyleInfo">Anything else about your style? (optional)</Label>
              <Input
                id="edit-additionalStyleInfo"
                value={additionalStyleInfo}
                onChange={(e) => setAdditionalStyleInfo(e.target.value)}
                placeholder="e.g., aversions, sizing, preferred fabrics"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-instagramHandle">Instagram handle (optional)</Label>
              <Input
                id="edit-instagramHandle"
                value={instagramHandle}
                onChange={(e) => setInstagramHandle(e.target.value)}
                placeholder="e.g., @username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-outfitsPerDayEstimate">Outfits per day (optional)</Label>
              <Input
                id="edit-outfitsPerDayEstimate"
                value={outfitsPerDayEstimate}
                onChange={(e) => setOutfitsPerDayEstimate(e.target.value)}
                placeholder="e.g., 1–2"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-weekdayOutfitDetails">Weekday outfits (optional)</Label>
              <Input
                id="edit-weekdayOutfitDetails"
                value={weekdayOutfitDetails}
                onChange={(e) => setWeekdayOutfitDetails(e.target.value)}
                placeholder="e.g., work and/or home typically include"
              />
            </div>
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
              {loading ? 'Updating...' : 'Update Client'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditClientDialog;
