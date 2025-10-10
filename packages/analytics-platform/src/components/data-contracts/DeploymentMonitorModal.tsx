'use client';

import { CheckCircle2, Loader2, Circle, XCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { useDataContractsStore } from '@/lib/useDataContractsStore';

export function DeploymentMonitorModal() {
  const {
    deploymentInProgress,
    setDeploymentInProgress,
    currentDeployment,
  } = useDataContractsStore();

  const closeMonitor = () => {
    setDeploymentInProgress(false);
  };

  if (!deploymentInProgress || !currentDeployment) return null;

  const completedSteps = currentDeployment.steps.filter(
    (s) => s.status === 'completed'
  ).length;
  const totalSteps = currentDeployment.steps.length;
  const progressPercentage = (completedSteps / totalSteps) * 100;

  return (
    <Dialog
      open={deploymentInProgress}
      onOpenChange={(open) => !open && currentDeployment.status !== 'running' && closeMonitor()}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {currentDeployment.status === 'running'
              ? 'Deployment in Progress'
              : currentDeployment.status === 'success'
              ? 'Deployment Successful'
              : 'Deployment Failed'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Progress Bar */}
          {currentDeployment.status === 'running' && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">
                  Step {completedSteps} of {totalSteps}
                </span>
                <span className="text-gray-600">{Math.round(progressPercentage)}%</span>
              </div>
              <Progress value={progressPercentage} className="h-2" />
            </div>
          )}

          {/* Deployment Steps */}
          <div className="space-y-3">
            {currentDeployment.steps.map((step, i) => (
              <div key={i} className="flex items-center gap-3">
                {step.status === 'completed' && (
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                )}
                {step.status === 'running' && (
                  <Loader2 className="w-5 h-5 animate-spin text-blue-600 flex-shrink-0" />
                )}
                {step.status === 'pending' && (
                  <Circle className="w-5 h-5 text-gray-300 flex-shrink-0" />
                )}
                {step.status === 'failed' && (
                  <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                )}
                <div className="flex-1">
                  <div className="font-medium text-sm">{step.name}</div>
                  {step.duration && (
                    <div className="text-xs text-gray-500">{step.duration}s</div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Real-time Event Monitor */}
          {currentDeployment.status === 'running' && (
            <Card className="p-4 bg-gray-50 dark:bg-gray-900">
              <h4 className="font-medium text-sm mb-3">Event Monitoring</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">
                    Old tracker (v{currentDeployment.oldVersion}):
                  </span>
                  <span className="font-mono font-semibold">
                    {currentDeployment.oldEventCount} events
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">
                    New tracker (v{currentDeployment.newVersion}):
                  </span>
                  <span className="font-mono font-semibold text-green-600">
                    {currentDeployment.newEventCount} events
                  </span>
                </div>
              </div>
            </Card>
          )}

          {/* Success Alert */}
          {currentDeployment.status === 'success' && (
            <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-900 dark:text-green-100">
                Deployment Successful!
              </AlertTitle>
              <AlertDescription className="text-green-800 dark:text-green-200">
                Schema changes are now live.
                {currentDeployment.firstEventTime && (
                  <> First event received at {currentDeployment.firstEventTime}</>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Failed Alert */}
          {currentDeployment.status === 'failed' && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertTitle>Deployment Failed</AlertTitle>
              <AlertDescription>
                The deployment encountered an error. Please check the logs for more details.
              </AlertDescription>
            </Alert>
          )}

          <Button
            variant={currentDeployment.status === 'running' ? 'outline' : 'default'}
            onClick={closeMonitor}
            className="w-full"
            disabled={currentDeployment.status === 'running'}
          >
            {currentDeployment.status === 'running'
              ? 'Continue in Background'
              : 'Done'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

