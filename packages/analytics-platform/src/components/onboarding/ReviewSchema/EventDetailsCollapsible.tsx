// packages/analytics-platform/src/components/ReviewSchema/EventDetailsCollapsible.tsx
'use client';
import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Code2, Globe, Square, FileCode2, Eye, Activity, Circle, ToggleLeft, ToggleRight } from 'lucide-react';

interface EventDetailsProps {
    event: any;
    enabled?: boolean;
    onToggle?: (eventType: string, enabled: boolean) => void;
}

export function EventDetailsCollapsible({ event, enabled = true, onToggle }: EventDetailsProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isEnabled, setIsEnabled] = useState(enabled);

    // Debug: Log event structure to console
    React.useEffect(() => {
        console.log(`🔍 Event ${event.event_type}:`, {
            has_data_field_variants: !!event.data_field_variants,
            variants_length: event.data_field_variants?.length || 0,
            has_data_fields: !!event.data_fields,
            data_fields_length: event.data_fields?.length || 0,
            event_keys: Object.keys(event)
        });
    }, [event]);

    const getEventIcon = (eventType: string) => {
        const icons: Record<string, any> = {
            'PAGE_VIEW': Globe,
            'BUTTON_CLICK': Square,
            'FORM_INTERACTION': FileCode2,
            'ELEMENT_VISIBILITY': Eye,
            'SCROLL_INTERACTION': Activity
        };
        return icons[eventType] || Circle;
    };

    const EventIcon = getEventIcon(event.event_type);

    const handleToggle = () => {
        const newState = !isEnabled;
        setIsEnabled(newState);
        if (onToggle) {
            onToggle(event.event_type, newState);
        }
    };

    return (
        <div className={`border rounded-lg transition-all ${isEnabled ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'}`}>
            <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg ${isEnabled ? 'bg-indigo-100' : 'bg-gray-100'}`}>
                        <EventIcon className={`w-4 h-4 ${isEnabled ? 'text-indigo-600' : 'text-gray-400'}`} />
                    </div>
                    <div>
                        <h4 className="font-semibold text-gray-900">{event.event_type}</h4>
                        <p className="text-sm text-gray-500">
                            {event.data_field_variants?.length || event.data_fields?.required?.length || event.data_fields?.length || 0} {event.data_field_variants ? 'component variants' : 'fields tracked'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center space-x-3">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleToggle();
                        }}
                        className="p-1.5 rounded-lg hover:bg-gray-100"
                    >
                        {isEnabled ? (
                            <ToggleRight className="w-5 h-5 text-green-600" />
                        ) : (
                            <ToggleLeft className="w-5 h-5 text-gray-400" />
                        )}
                    </button>
                    {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                </div>
            </div>

            {isExpanded && (
                <div className="px-4 pb-4 border-t border-gray-100">
                    {/* New variant-based schema format */}
                    {event.data_field_variants && event.data_field_variants.length > 0 ? (
                        <div className="mt-4 space-y-4">
                            {event.data_field_variants.map((variant: any, vIdx: number) => (
                                <div key={vIdx} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                                    <div className="flex items-center justify-between mb-3">
                                        <div>
                                            <h5 className="font-semibold text-sm text-gray-900">{variant.component}</h5>
                                            <p className="text-xs text-gray-500 mt-1">
                                                Locations: {variant.locations?.join(', ') || 'unknown'}
                                            </p>
                                            {variant.pattern_type && (
                                                <span className="inline-block mt-1 px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">
                                                    {variant.pattern_type}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    
                                    {variant.data_structure && (
                                        <div className="space-y-2">
                                            {Object.entries(variant.data_structure).map(([field, type]: [string, any], fIdx: number) => (
                                                <div key={fIdx} className="flex items-center justify-between py-1.5 px-2 bg-white rounded">
                                                    <div className="flex items-center space-x-2">
                                                        <Code2 className="w-3 h-3 text-gray-400" />
                                                        <span className="font-mono text-xs text-gray-700">{field}</span>
                                                    </div>
                                                    <span className="text-xs text-gray-500 font-mono truncate max-w-xs">
                                                        {typeof type === 'object' ? 'object' : type}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        /* Old schema format fallback */
                        <div className="mt-4 space-y-3">
                            {(event.data_fields?.required || event.data_fields || []).map((field: string, idx: number) => {
                                const fieldType = event.properties?.[field] || 'string';
                                const isRequired = event.data_fields?.required?.includes(field) ?? true;

                                return (
                                    <div key={idx} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                                        <div className="flex items-center space-x-2">
                                            <Code2 className="w-4 h-4 text-gray-400" />
                                            <span className="font-mono text-sm text-gray-700">{field}</span>
                                            {isRequired && (
                                                <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded">Required</span>
                                            )}
                                        </div>
                                        <span className="text-sm text-gray-500 font-mono">{fieldType}</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}