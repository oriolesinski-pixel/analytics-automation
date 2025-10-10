'use client';

import { CheckCircle2, Info } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useDataContractsStore } from '@/lib/useDataContractsStore';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/use-toast';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082';

interface MergeConfirmationModalProps {
  appKey: string;
}

export function MergeConfirmationModal({ appKey }: MergeConfirmationModalProps) {
  const router = useRouter();
  const { toast } = useToast();
  const {
    showMergeConfirm,
    setShowMergeConfirm,
    mergeStrategy,
    setMergeStrategy,
    commitMessage,
    setCommitMessage,
    currentPR,
    setDeploymentInProgress,
    setCurrentDeployment,
  } = useDataContractsStore();

  const cancelMerge = () => {
    setShowMergeConfirm(false);
  };

  const confirmMerge = async () => {
    if (!currentPR) return;

    try {
      const response = await fetch(
        `${API_BASE_URL}/apps/${appKey}/pull-requests/${currentPR.number}/merge`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            strategy: mergeStrategy,
            commitMessage,
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();

        toast({
          title: 'Merge Initiated',
          description: 'Deployment pipeline started',
        });

        // Set up deployment monitoring
        setCurrentDeployment(data.deployment);
        setDeploymentInProgress(true);
        setShowMergeConfirm(false);

        // Start polling deployment status
        pollDeploymentStatus(data.deployment.id);
      } else {
        const error = await response.json();
        toast({
          title: 'Merge Failed',
          description: error.message || 'An error occurred',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error merging PR:', error);
      toast({
        title: 'Error',
        description: 'Failed to merge pull request',
        variant: 'destructive',
      });
    }
  };

  const pollDeploymentStatus = async (deploymentId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/apps/${appKey}/deployments/${deploymentId}`
        );
        if (response.ok) {
          const data = await response.json();
          setCurrentDeployment(data.deployment);

          if (
            data.deployment.status === 'success' ||
            data.deployment.status === 'failed'
          ) {
            clearInterval(pollInterval);
          }
        }
      } catch (error) {
        console.error('Error polling deployment:', error);
      }
    }, 3000);
  };

  if (!showMergeConfirm || !currentPR) return null;

  return (
    <Dialog
      open={showMergeConfirm}
      onOpenChange={(open) => !open && cancelMerge()}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ready to Merge</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Success Alert */}
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>All checks have passed</AlertDescription>
          </Alert>

          {/* Merge Strategy */}
          <div>
            <Label className="mb-3 block">Merge Strategy</Label>
            <RadioGroup
              value={mergeStrategy}
              onValueChange={(value) =>
                setMergeStrategy(value as 'squash' | 'merge')
              }
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="squash" id="squash" />
                <Label htmlFor="squash" className="font-normal">
                  Squash and merge (recommended)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="merge" id="merge" />
                <Label htmlFor="merge" className="font-normal">
                  Create merge commit
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Commit Message */}
          <div>
            <Label htmlFor="commit-message">Commit Message</Label>
            <Textarea
              id="commit-message"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              rows={3}
              className="font-mono text-sm"
            />
          </div>

          {/* Deployment Info */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              This will trigger CI/CD deployment (estimated 2-3 min)
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={cancelMerge}>
            Cancel
          </Button>
          <Button onClick={confirmMerge}>Confirm Merge</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

