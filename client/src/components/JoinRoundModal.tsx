import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Users, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface JoinRoundModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJoinSuccess: (roundData: any) => void;
}

export function JoinRoundModal({ open, onOpenChange, onJoinSuccess }: JoinRoundModalProps) {
  const [roomCode, setRoomCode] = useState('');
  const { toast } = useToast();

  const joinRoundMutation = useMutation({
    mutationFn: async (roomCode: string) => {
      const response = await apiRequest('GET', `/api/rounds/code/${roomCode}`);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Joined successfully!",
        description: `Connected to voting round`,
      });
      onJoinSuccess(data);
      handleClose();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to join round",
        description: error.message.includes('404') 
          ? "Room code not found. Please check the code and try again."
          : "Unable to connect to the voting round. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = roomCode.trim().toUpperCase();
    if (code.length !== 6) {
      toast({
        title: "Invalid room code",
        description: "Room code must be 6 characters long.",
        variant: "destructive",
      });
      return;
    }
    joinRoundMutation.mutate(code);
  };

  const handleClose = () => {
    setRoomCode('');
    onOpenChange(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    setRoomCode(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm mx-4">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary bg-opacity-10 rounded-full flex items-center justify-center">
                <Users className="w-4 h-4 text-primary" />
              </div>
              <span>Join Voting Round</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              data-testid="close-join-modal"
            >
              <X className="w-4 h-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="text-center space-y-6">
          <p className="text-gray-600 text-sm">
            Enter the room code shared by your rush chair
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Input
                type="text"
                value={roomCode}
                onChange={handleInputChange}
                placeholder="ABC123"
                className="text-center text-2xl font-mono tracking-widest uppercase"
                maxLength={6}
                data-testid="input-room-code"
              />
            </div>

            <div className="space-y-3">
              <Button
                type="submit"
                className="w-full"
                disabled={roomCode.length !== 6 || joinRoundMutation.isPending}
                data-testid="button-join-round"
              >
                {joinRoundMutation.isPending ? "Joining..." : "Join Round"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleClose}
                data-testid="button-cancel-join"
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
