import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Camera } from 'lucide-react';
import { getCurrentUser } from '@/utils/auth';
import { updateUserProfile } from '@/utils/users';
import { updateCurrentUser } from '@/utils/auth';
import { toFullSizeImageUrl } from '@/utils/fileUpload';
import { showSuccess, showError } from '@/utils/toast';

const ProfileSetup = () => {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  
  const [name, setName] = useState(currentUser?.name || '');
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [location, setLocation] = useState(currentUser?.location || '');
  const [photoUrl, setPhotoUrl] = useState(currentUser?.profilePhotoUrl || '');
  const [loading, setLoading] = useState(false);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const { validateImageFile, uploadImage } = await import('@/utils/fileUpload');
      const validation = validateImageFile(file);
      if (!validation.valid) {
        showError(validation.error || 'Invalid image file');
        return;
      }

      // Upload and get URL
      const uploadedUrl = await uploadImage(file);
      setPhotoUrl(uploadedUrl);
    } catch (error: any) {
      showError(error.message || 'Failed to upload image');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      showError('Name is required');
      return;
    }
    
    setLoading(true);

    try {
      const updatedUser = await updateUserProfile({
        name: name.trim(),
        bio: bio.trim() || undefined,
        location: location.trim() || undefined,
        profilePhotoUrl: photoUrl.trim() || undefined,
      });
      
      if (updatedUser) {
        // Update local storage user
        updateCurrentUser({
          name: updatedUser.name,
          bio: updatedUser.bio,
          location: updatedUser.location,
          profilePhotoUrl: updatedUser.profilePhotoUrl,
        });
      }
      
      showSuccess('Profile updated successfully');
      navigate('/dashboard');
    } catch (error: any) {
      showError(error.message || 'Failed to update profile');
    } finally {
      setLoading(false);
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-2xl">Complete Your Profile</CardTitle>
          <CardDescription>
            Tell us a bit about yourself to get started
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex flex-col items-center space-y-4">
              <div className="relative">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={photoUrl ? toFullSizeImageUrl(photoUrl) : undefined} />
                  <AvatarFallback className="text-2xl">
                    {getInitials(name)}
                  </AvatarFallback>
                </Avatar>
                <label
                  htmlFor="photo-upload"
                  className="absolute bottom-0 right-0 bg-primary text-primary-foreground rounded-full p-2 cursor-pointer hover:bg-primary/90 transition-colors"
                >
                  <Camera className="h-4 w-4" />
                  <input
                    id="photo-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoUpload}
                  />
                </label>
              </div>
              <p className="text-sm text-muted-foreground">
                Upload a professional photo
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jessica Smith"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Los Angeles, CA"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell clients about your styling experience and specialties..."
                rows={4}
              />
              <p className="text-sm text-muted-foreground">
                This will be visible to your clients
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/dashboard')}
                className="flex-1"
              >
                Skip for now
              </Button>
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? 'Saving...' : 'Complete Setup'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfileSetup;
