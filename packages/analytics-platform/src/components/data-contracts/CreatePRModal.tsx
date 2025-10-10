'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useDataContractsStore } from '@/lib/useDataContractsStore';
import { useToast } from '@/components/ui/use-toast';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082';

interface CreatePRModalProps {
  appKey: string;
}

export function CreatePRModal({ appKey }: CreatePRModalProps) {
  const router = useRouter();
  const { toast } = useToast();
  const {
    showCreatePR,
    setShowCreatePR,
    prTitle,
    setPRTitle,
    prDescription,
    setPRDescription,
    editingEvent,
    setEditingEvent,
    setCurrentPR,
  } = useDataContractsStore();

  const [repo, setRepo] = useState('user/repo'); // TODO: Get from app config
  const [reviewers, setReviewers] = useState('');
  const [runValidation, setRunValidation] = useState(true);
  const [autoMerge, setAutoMerge] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const cancelPR = () => {
    setShowCreatePR(false);
  };

  const submitPR = async () => {
    if (!prTitle || !prDescription) {
      toast({
        title: 'Missing information',
        description: 'Please provide a title and description',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);

    try {
      const response = await fetch(`${API_BASE_URL}/apps/${appKey}/pull-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: prTitle,
          description: prDescription,
          event: editingEvent,
          reviewers: reviewers
            .split(',')
            .map((r) => r.trim())
            .filter(Boolean),
          options: {
            runValidation,
            autoMerge,
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentPR(data.pr);
        
        toast({
          title: 'Pull Request Created',
          description: `PR #${data.pr.number} has been created successfully`,
        });

        // Close modals
        setShowCreatePR(false);
        setEditingEvent(null);

        // Navigate to PR review page
        router.push(`/data-contracts/pr/${data.pr.number}`);
      } else {
        const error = await response.json();
        toast({
          title: 'Failed to create PR',
          description: error.message || 'An error occurred',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error creating PR:', error);
      toast({
        title: 'Error',
        description: 'Failed to create pull request',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  if (!showCreatePR) return null;

  return (
    <Dialog open={showCreatePR} onOpenChange={(open) => !open && cancelPR()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Pull Request</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Repository */}
          <div>
            <Label htmlFor="repo">Repository</Label>
            <Input
              id="repo"
              value={`github.com/${repo}`}
              disabled
              className="bg-gray-100 dark:bg-gray-800"
            />
          </div>

          {/* PR Title */}
          <div>
            <Label htmlFor="pr-title">PR Title</Label>
            <Input
              id="pr-title"
              value={prTitle}
              onChange={(e) => setPRTitle(e.target.value)}
              placeholder="Analytics: Update BUTTON_CLICK event"
            />
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="pr-description">
              Description (auto-generated, editable)
            </Label>
            <Textarea
              id="pr-description"
              value={prDescription}
              onChange={(e) => setPRDescription(e.target.value)}
              rows={12}
              className="font-mono text-sm"
            />
          </div>

          {/* Reviewers */}
          <div>
            <Label htmlFor="reviewers">Reviewers (optional)</Label>
            <Input
              id="reviewers"
              value={reviewers}
              onChange={(e) => setReviewers(e.target.value)}
              placeholder="@username1, @username2"
            />
            <p className="text-xs text-gray-500 mt-1">
              Comma-separated list of GitHub usernames
            </p>
          </div>

          {/* Post-PR Actions */}
          <div>
            <Label className="mb-3 block">Post-PR Actions</Label>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="validation"
                  checked={runValidation}
                  onCheckedChange={(checked) =>
                    setRunValidation(checked as boolean)
                  }
                />
                <label
                  htmlFor="validation"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Run validation checks
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="automerge"
                  checked={autoMerge}
                  onCheckedChange={(checked) =>
                    setAutoMerge(checked as boolean)
                  }
                />
                <label
                  htmlFor="automerge"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Auto-merge if CI passes
                </label>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={cancelPR} disabled={isCreating}>
            Cancel
          </Button>
          <Button onClick={submitPR} disabled={isCreating}>
            {isCreating ? 'Creating...' : 'Create & Open for Review'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

