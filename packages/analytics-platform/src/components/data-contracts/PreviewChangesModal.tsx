'use client';

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDataContractsStore } from '@/lib/useDataContractsStore';

export function PreviewChangesModal() {
  const {
    showPreview,
    setShowPreview,
    previewData,
    setShowCreatePR,
    setPRTitle,
    setPRDescription,
    editingEvent,
  } = useDataContractsStore();

  const closePreview = () => {
    setShowPreview(false);
  };

  const createPR = () => {
    // Generate PR title and description
    const title = `Analytics: Update ${editingEvent?.name} event`;
    const description = generatePRDescription();

    setPRTitle(title);
    setPRDescription(description);
    setShowPreview(false);
    setShowCreatePR(true);
  };

  const generatePRDescription = () => {
    if (!previewData || !editingEvent) return '';

    const sections = [];

    sections.push('## Summary');
    sections.push(
      `Updated event tracking for \`${editingEvent.name}\` event.`
    );
    sections.push('');

    sections.push('## Changes');
    if (previewData.addedFields.length > 0) {
      sections.push(`- **Added fields**: ${previewData.addedFields.join(', ')}`);
    }
    if (previewData.modifiedFields.length > 0) {
      sections.push(
        `- **Modified fields**: ${previewData.modifiedFields.join(', ')}`
      );
    }
    sections.push(
      `- **Impact**: ~${previewData.eventFrequency} events/day`
    );
    sections.push('');

    if (previewData.affectedDashboards.length > 0) {
      sections.push('## Affected Dashboards');
      previewData.affectedDashboards.forEach((dashboard) => {
        sections.push(`- ${dashboard}`);
      });
      sections.push('');
    }

    sections.push('## Files Modified');
    sections.push('- `public/tracker.js`');
    sections.push('- `analytics-schema.json`');
    sections.push('- `CHANGELOG.md`');
    sections.push('');

    sections.push('## Testing');
    sections.push('- [ ] Event extraction validated');
    sections.push('- [ ] Sample events verified');
    sections.push('- [ ] Dashboard compatibility checked');

    return sections.join('\n');
  };

  const generateTrackerDiff = () => {
    if (!editingEvent || !previewData) return '';

    const transforms = previewData.schemaDiff?.transforms || [];
    const lines = [];
    
    lines.push(`// Event: ${editingEvent.name}`);
    lines.push(`// Transformation Pipeline`);
    lines.push(`function transformEvent(rawData) {`);
    lines.push(`  const transformed = { ...rawData };`);
    lines.push(``);
    
    // Show field transformations
    transforms.forEach((transform: any) => {
      if (transform.originalName !== transform.newName) {
        lines.push(`+ // Rename: ${transform.originalName} → ${transform.newName}`);
        lines.push(`+ transformed['${transform.newName}'] = transformed['${transform.originalName}'];`);
        lines.push(`+ delete transformed['${transform.originalName}'];`);
      }
      
      if (transform.valueMappings && transform.valueMappings.length > 0) {
        lines.push(`+ // Value mappings for ${transform.newName || transform.originalName}`);
        lines.push(`+ const ${transform.originalName}Mappings = {`);
        transform.valueMappings.forEach((mapping: any) => {
          lines.push(`+   '${mapping.from}': '${mapping.to}',`);
        });
        lines.push(`+ };`);
        lines.push(`+ if (${transform.originalName}Mappings[transformed['${transform.newName || transform.originalName}']]) {`);
        lines.push(`+   transformed['${transform.newName || transform.originalName}'] = ${transform.originalName}Mappings[transformed['${transform.newName || transform.originalName}']];`);
        lines.push(`+ }`);
      }
      
      if (transform.enrichmentRule) {
        lines.push(`+ // Enrichment: ${transform.enrichmentRule}`);
        lines.push(`+ transformed['${transform.newName || transform.originalName}'] = ${transform.enrichmentRule};`);
      }
    });
    
    lines.push(``);
    lines.push(`  return transformed;`);
    lines.push(`}`);

    return lines.join('\n');
  };

  if (!showPreview || !previewData || !editingEvent) return null;

  return (
    <Dialog open={showPreview} onOpenChange={(open) => !open && closePreview()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Preview Schema Changes</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Summary */}
          <Alert>
            <AlertDescription className="space-y-1">
              <div>• Modified: <strong>{editingEvent.name}</strong> event</div>
              {previewData.addedFields.length > 0 && (
                <div>
                  • Added fields:{' '}
                  <strong>{previewData.addedFields.join(', ')}</strong>
                </div>
              )}
              {previewData.modifiedFields.length > 0 && (
                <div>
                  • Modified fields:{' '}
                  <strong>{previewData.modifiedFields.join(', ')}</strong>
                </div>
              )}
              <div>
                • Impact: ~<strong>{previewData.eventFrequency}</strong> events/day
              </div>
              {previewData.affectedDashboards.length > 0 && (
                <div>
                  • Dashboards affected:{' '}
                  <strong>{previewData.affectedDashboards.length}</strong>
                </div>
              )}
            </AlertDescription>
          </Alert>

          {/* Files Changed */}
          <div>
            <Label className="mb-2 block">Files to be Changed</Label>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">public/tracker.js</Badge>
              <Badge variant="secondary">analytics-schema.json</Badge>
              <Badge variant="secondary">CHANGELOG.md</Badge>
            </div>
          </div>

          {/* Code Diff */}
          <Tabs defaultValue="tracker">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="tracker">tracker.js</TabsTrigger>
              <TabsTrigger value="schema">schema.json</TabsTrigger>
            </TabsList>
            <TabsContent value="tracker">
              <pre className="bg-gray-900 text-gray-100 p-4 rounded text-xs font-mono overflow-x-auto">
                {generateTrackerDiff()
                  .split('\n')
                  .map((line, i) => {
                    let className = '';
                    if (line.startsWith('+')) {
                      className = 'text-green-400';
                    } else if (line.startsWith('-')) {
                      className = 'text-red-400';
                    } else if (line.startsWith('~')) {
                      className = 'text-yellow-400';
                    }
                    return (
                      <div key={i} className={className}>
                        {line}
                      </div>
                    );
                  })}
              </pre>
            </TabsContent>
            <TabsContent value="schema">
              <pre className="bg-gray-900 text-green-400 p-4 rounded text-xs font-mono overflow-x-auto">
                {JSON.stringify(previewData.schemaDiff, null, 2)}
              </pre>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={closePreview}>
            Cancel
          </Button>
          <Button onClick={createPR}>Create Pull Request</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

