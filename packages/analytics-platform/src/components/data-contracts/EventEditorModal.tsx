'use client';

import { useState, useEffect } from 'react';
import { Info, Plus, Trash2, ArrowRight } from 'lucide-react';
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
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useDataContractsStore } from '@/lib/useDataContractsStore';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082';

interface FieldTransform {
  id: string;
  originalName: string;
  newName: string;
  valueMappings: {
    from: string;
    to: string;
  }[];
  enrichmentRule?: string;
}

interface EventEditorModalProps {
  appKey: string;
}

export function EventEditorModal({ appKey }: EventEditorModalProps) {
  const {
    editingEvent,
    setEditingEvent,
    setShowPreview,
    setPreviewData,
  } = useDataContractsStore();

  const [fieldTransforms, setFieldTransforms] = useState<FieldTransform[]>([]);
  const [hasBreakingChanges, setHasBreakingChanges] = useState(false);
  const [affectedDashboards, setAffectedDashboards] = useState<string[]>([]);

  useEffect(() => {
    if (editingEvent) {
      // Initialize transforms from existing fields
      const transforms = editingEvent.fields.map((field) => ({
        id: field.id,
        originalName: field.name,
        newName: field.name,
        valueMappings: [],
        enrichmentRule: undefined,
      }));
      setFieldTransforms(transforms);
    }
  }, [editingEvent]);

  const addValueMapping = (fieldId: string) => {
    setFieldTransforms(
      fieldTransforms.map((transform) =>
        transform.id === fieldId
          ? {
              ...transform,
              valueMappings: [
                ...transform.valueMappings,
                { from: '', to: '' },
              ],
            }
          : transform
      )
    );
  };

  const updateValueMapping = (
    fieldId: string,
    mappingIndex: number,
    key: 'from' | 'to',
    value: string
  ) => {
    setFieldTransforms(
      fieldTransforms.map((transform) =>
        transform.id === fieldId
          ? {
              ...transform,
              valueMappings: transform.valueMappings.map((mapping, idx) =>
                idx === mappingIndex ? { ...mapping, [key]: value } : mapping
              ),
            }
          : transform
      )
    );
  };

  const removeValueMapping = (fieldId: string, mappingIndex: number) => {
    setFieldTransforms(
      fieldTransforms.map((transform) =>
        transform.id === fieldId
          ? {
              ...transform,
              valueMappings: transform.valueMappings.filter(
                (_, idx) => idx !== mappingIndex
              ),
            }
          : transform
      )
    );
  };

  const updateFieldName = (fieldId: string, newName: string) => {
    setFieldTransforms(
      fieldTransforms.map((transform) =>
        transform.id === fieldId ? { ...transform, newName } : transform
      )
    );

    // Check for breaking changes
    const originalField = editingEvent?.fields.find((f) => f.id === fieldId);
    if (originalField && originalField.name !== newName) {
      checkBreakingChanges();
    }
  };

  const updateEnrichmentRule = (fieldId: string, rule: string) => {
    setFieldTransforms(
      fieldTransforms.map((transform) =>
        transform.id === fieldId ? { ...transform, enrichmentRule: rule } : transform
      )
    );
  };

  const checkBreakingChanges = async () => {
    const renamedFields = fieldTransforms.filter((transform) => {
      const original = editingEvent?.fields.find((f) => f.id === transform.id);
      return original && original.name !== transform.newName;
    });

    if (renamedFields.length > 0) {
      try {
        const response = await fetch(
          `${API_BASE_URL}/apps/${appKey}/events/${editingEvent?.id}/impact`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ renamedFields }),
          }
        );
        if (response.ok) {
          const data = await response.json();
          setHasBreakingChanges(data.affectedDashboards.length > 0);
          setAffectedDashboards(data.affectedDashboards);
        }
      } catch (error) {
        console.error('Error checking breaking changes:', error);
      }
    } else {
      setHasBreakingChanges(false);
      setAffectedDashboards([]);
    }
  };

  const closeEditor = () => {
    setEditingEvent(null);
  };

  const previewChanges = async () => {
    const renamedFields = fieldTransforms
      .filter((t) => {
        const original = editingEvent?.fields.find((f) => f.id === t.id);
        return original && original.name !== t.newName;
      })
      .map((t) => `${t.originalName} → ${t.newName}`);

    const fieldsWithMappings = fieldTransforms
      .filter((t) => t.valueMappings.length > 0)
      .map((t) => t.newName || t.originalName);

    const fieldsWithEnrichment = fieldTransforms
      .filter((t) => t.enrichmentRule)
      .map((t) => t.newName || t.originalName);

    setPreviewData({
      addedFields: [],
      modifiedFields: [
        ...renamedFields,
        ...fieldsWithMappings,
        ...fieldsWithEnrichment,
      ],
      affectedDashboards,
      eventFrequency: editingEvent?.frequency || '0',
      schemaDiff: {
        event: editingEvent?.name,
        transforms: fieldTransforms,
      },
    });

    setShowPreview(true);
  };

  if (!editingEvent) return null;

  return (
    <Dialog open={!!editingEvent} onOpenChange={(open) => !open && closeEditor()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Edit Schema: {editingEvent.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Context Card */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>AI-Generated Event</strong> • {editingEvent.frequency} events/day •
              Transform and enrich the tracked data below
            </AlertDescription>
          </Alert>

          {/* Trigger Info (Read-only) */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-start justify-between mb-2">
              <div>
                <Label className="text-sm font-semibold">Trigger (Read-only)</Label>
                <p className="text-xs text-gray-500 mt-1">
                  Generated by AI analysis of your codebase
                </p>
              </div>
              <Badge variant="secondary">Auto-detected</Badge>
            </div>
            <div className="font-mono text-xs bg-gray-900 text-green-400 p-3 rounded mt-2">
              <pre>{editingEvent.trigger.description}</pre>
              <pre className="mt-2 text-gray-400">
                Selector: {editingEvent.trigger.selector}
              </pre>
            </div>
          </div>

          {/* Field Transformations */}
          <div className="space-y-4">
            <div>
              <Label className="text-base font-semibold">
                Field Transformations & Enrichment
              </Label>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Rename fields, map values, or add business context to AI-generated data
              </p>
            </div>

            {fieldTransforms.map((transform, idx) => {
              const originalField = editingEvent.fields.find(
                (f) => f.id === transform.id
              );
              if (!originalField) return null;

              return (
                <Card key={transform.id} className="p-4 bg-gray-50 dark:bg-gray-900">
                  <div className="space-y-4">
                    {/* Field Name */}
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        <Label className="text-xs text-gray-600 mb-1">
                          Field Name
                        </Label>
                        <div className="flex items-center gap-2">
                          <Input
                            value={transform.originalName}
                            disabled
                            className="font-mono bg-gray-100 dark:bg-gray-800"
                          />
                          <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <Input
                            value={transform.newName}
                            onChange={(e) =>
                              updateFieldName(transform.id, e.target.value)
                            }
                            placeholder="New field name"
                            className="font-mono"
                          />
                        </div>
                        {transform.originalName !== transform.newName && (
                          <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                            ⚠️ Renaming will affect dashboards using this field
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Extraction Logic (Read-only) */}
                    <div>
                      <Label className="text-xs text-gray-600 mb-1">
                        AI-Generated Extraction
                      </Label>
                      <div className="font-mono text-xs bg-gray-900 text-green-400 p-2 rounded">
                        {originalField.extraction.source}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Sample values: {originalField.sampleValues.join(', ')}
                      </div>
                    </div>

                    {/* Value Mappings */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-xs text-gray-600">
                          Value Transformations
                        </Label>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => addValueMapping(transform.id)}
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Add Mapping
                        </Button>
                      </div>

                      {transform.valueMappings.length > 0 ? (
                        <div className="space-y-2">
                          {transform.valueMappings.map((mapping, mappingIdx) => (
                            <div
                              key={mappingIdx}
                              className="flex items-center gap-2"
                            >
                              <Input
                                value={mapping.from}
                                onChange={(e) =>
                                  updateValueMapping(
                                    transform.id,
                                    mappingIdx,
                                    'from',
                                    e.target.value
                                  )
                                }
                                placeholder="/products/1"
                                className="font-mono text-xs"
                              />
                              <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                              <Input
                                value={mapping.to}
                                onChange={(e) =>
                                  updateValueMapping(
                                    transform.id,
                                    mappingIdx,
                                    'to',
                                    e.target.value
                                  )
                                }
                                placeholder="iPhone 16"
                                className="font-mono text-xs"
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  removeValueMapping(transform.id, mappingIdx)
                                }
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500 italic">
                          No value mappings yet. Add mappings to transform raw values
                          into business-friendly names.
                        </p>
                      )}
                    </div>

                    {/* Enrichment Rule */}
                    <Accordion type="single" collapsible>
                      <AccordionItem value="enrichment">
                        <AccordionTrigger className="text-xs">
                          Advanced: Enrichment Rule
                        </AccordionTrigger>
                        <AccordionContent>
                          <Input
                            value={transform.enrichmentRule || ''}
                            onChange={(e) =>
                              updateEnrichmentRule(transform.id, e.target.value)
                            }
                            placeholder="lookup(product_catalog, path) or regex pattern"
                            className="font-mono text-xs"
                          />
                          <p className="text-xs text-gray-500 mt-2">
                            Define custom transformation logic (e.g., database lookup,
                            regex, API call)
                          </p>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Breaking Changes Warning */}
          {hasBreakingChanges && (
            <Alert variant="destructive">
              <AlertDescription>
                <strong>Breaking Changes Detected</strong>
                <br />
                These changes will affect {affectedDashboards.length} dashboard(s):{' '}
                {affectedDashboards.join(', ')}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={closeEditor}>
            Cancel
          </Button>
          <Button onClick={previewChanges}>Preview Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
