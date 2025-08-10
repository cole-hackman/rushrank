import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Camera } from 'lucide-react';
import { insertPNMSchema, type InsertPNM } from '@shared/schema';
import { apiRequest } from '@/lib/queryClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ObjectUploader } from '@/components/ObjectUploader';
import { useToast } from '@/hooks/use-toast';
import type { UploadResult } from '@uppy/core';

interface AddPNMModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const availableTags = ['Athlete', 'Legacy', 'Funny', 'Smart', 'Outgoing', 'Creative'];

export function AddPNMModal({ open, onOpenChange }: AddPNMModalProps) {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [uploadedPhotoPath, setUploadedPhotoPath] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<InsertPNM>({
    resolver: zodResolver(insertPNMSchema),
    defaultValues: {
      name: '',
      major: '',
      hometown: '',
      year: '',
      photoPath: '',
      tags: [],
      walkoutSong: '',
      weirdestTalent: '',
      chickFilAOrder: '',
    },
  });

  const createPNMMutation = useMutation({
    mutationFn: async (data: InsertPNM) => {
      const response = await apiRequest('POST', '/api/pnms', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pnms'] });
      toast({
        title: "Success",
        description: "PNM added successfully!",
      });
      handleClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to add PNM. Please try again.",
        variant: "destructive",
      });
      console.error('Error creating PNM:', error);
    },
  });

  const updatePNMPhotoMutation = useMutation({
    mutationFn: async ({ photoURL, pnmId }: { photoURL: string; pnmId: string }) => {
      const response = await apiRequest('PUT', '/api/pnm-photos', { photoURL, pnmId });
      return response.json();
    },
  });

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const handleGetUploadParameters = async () => {
    const response = await apiRequest('POST', '/api/objects/upload');
    const data = await response.json();
    return {
      method: 'PUT' as const,
      url: data.uploadURL,
    };
  };

  const handleUploadComplete = (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    if (result.successful && result.successful[0]) {
      const uploadURL = result.successful[0].uploadURL;
      setUploadedPhotoPath(uploadURL);
      toast({
        title: "Photo uploaded",
        description: "Profile photo uploaded successfully!",
      });
    }
  };

  const handleSubmit = form.handleSubmit((data) => {
    const pnmData: InsertPNM = {
      ...data,
      tags: selectedTags,
      photoPath: uploadedPhotoPath || '',
    };

    createPNMMutation.mutate(pnmData);
  });

  const handleClose = () => {
    form.reset();
    setSelectedTags([]);
    setUploadedPhotoPath(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            Add New PNM
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              data-testid="close-modal"
            >
              <X className="w-4 h-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Photo Upload */}
          <div className="text-center">
            <div className="w-32 h-32 bg-gray-200 rounded-full mx-auto mb-3 flex items-center justify-center border-2 border-dashed border-gray-300">
              {uploadedPhotoPath ? (
                <img
                  src={uploadedPhotoPath}
                  alt="Uploaded photo"
                  className="w-full h-full rounded-full object-cover"
                  data-testid="uploaded-photo"
                />
              ) : (
                <Camera className="w-8 h-8 text-gray-400" />
              )}
            </div>
            <ObjectUploader
              maxNumberOfFiles={1}
              maxFileSize={10485760} // 10MB
              onGetUploadParameters={handleGetUploadParameters}
              onComplete={handleUploadComplete}
            >
              <div className="flex items-center gap-2 text-primary font-medium text-sm">
                <Camera className="w-4 h-4" />
                Upload Photo
              </div>
            </ObjectUploader>
          </div>

          {/* Basic Info */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="name" className="text-sm font-medium text-gray-700">
                Full Name *
              </Label>
              <Input
                id="name"
                {...form.register('name')}
                placeholder="Enter full name"
                className="mt-1"
                data-testid="input-name"
              />
              {form.formState.errors.name && (
                <p className="text-red-500 text-sm mt-1">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="major" className="text-sm font-medium text-gray-700">
                  Major *
                </Label>
                <Input
                  id="major"
                  {...form.register('major')}
                  placeholder="Major"
                  className="mt-1"
                  data-testid="input-major"
                />
                {form.formState.errors.major && (
                  <p className="text-red-500 text-sm mt-1">
                    {form.formState.errors.major.message}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="year" className="text-sm font-medium text-gray-700">
                  Year
                </Label>
                <Select onValueChange={(value) => form.setValue('year', value)}>
                  <SelectTrigger className="mt-1" data-testid="select-year">
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Freshman">Freshman</SelectItem>
                    <SelectItem value="Sophomore">Sophomore</SelectItem>
                    <SelectItem value="Junior">Junior</SelectItem>
                    <SelectItem value="Senior">Senior</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="hometown" className="text-sm font-medium text-gray-700">
                Hometown
              </Label>
              <Input
                id="hometown"
                {...form.register('hometown')}
                placeholder="City, State"
                className="mt-1"
                data-testid="input-hometown"
              />
            </div>

            {/* Tags */}
            <div>
              <Label className="text-sm font-medium text-gray-700 block mb-2">
                Tags
              </Label>
              <div className="flex flex-wrap gap-2">
                {availableTags.map((tag) => (
                  <Button
                    key={tag}
                    type="button"
                    variant={selectedTags.includes(tag) ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleTagToggle(tag)}
                    className="text-xs"
                    data-testid={`tag-${tag.toLowerCase()}`}
                  >
                    {tag}
                  </Button>
                ))}
              </div>
            </div>

            {/* Fun Questions */}
            <div className="space-y-3">
              <h3 className="font-medium text-gray-900">Fun Questions</h3>
              
              <div>
                <Label htmlFor="walkoutSong" className="text-sm text-gray-600">
                  Walkout Song
                </Label>
                <Input
                  id="walkoutSong"
                  {...form.register('walkoutSong')}
                  placeholder="Song title and artist"
                  className="mt-1"
                  data-testid="input-walkout-song"
                />
              </div>

              <div>
                <Label htmlFor="weirdestTalent" className="text-sm text-gray-600">
                  Weirdest Talent
                </Label>
                <Textarea
                  id="weirdestTalent"
                  {...form.register('weirdestTalent')}
                  placeholder="Describe their unique talent"
                  rows={2}
                  className="mt-1"
                  data-testid="input-weirdest-talent"
                />
              </div>

              <div>
                <Label htmlFor="chickFilAOrder" className="text-sm text-gray-600">
                  Chick-fil-A Order
                </Label>
                <Input
                  id="chickFilAOrder"
                  {...form.register('chickFilAOrder')}
                  placeholder="Their go-to order"
                  className="mt-1"
                  data-testid="input-chick-fil-a-order"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={handleClose}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={createPNMMutation.isPending}
              data-testid="button-save"
            >
              {createPNMMutation.isPending ? "Saving..." : "Save PNM"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
