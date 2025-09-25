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
                            {event.data_fields?.required?.length || event.data_fields?.length || 0} fields tracked
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
                </div>
            )}
        </div>
    );
}