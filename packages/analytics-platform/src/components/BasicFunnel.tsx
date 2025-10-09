'use client';
import { useState, useEffect } from 'react';
import { Users, MousePointer, Eye, FileText, CheckCircle, ShoppingCart, Package, TrendingDown, ArrowRight } from 'lucide-react';
 
interface FunnelStep {
    step: number;
    event_type: string;
    count: number;
    conversion_rate: number;
    avg_time_to_next_ms: number | null;
}

interface BasicFunnelProps {
    endpoint: string;
    repoId: string;
}

const getEventIcon = (eventType: string) => {
    const iconMap: Record<string, React.ComponentType<any>> = {
        page_view: Eye,
        button_click: MousePointer,
        form_submit: CheckCircle,
        first_touch: Users,
        product_view: Package,
        add_to_cart: ShoppingCart,
        purchase: CheckCircle
    };
    return iconMap[eventType] || FileText;
};

const getGradientColors = (index: number) => {
    const gradients = [
        { from: 'from-blue-500', to: 'to-blue-400', solid: 'bg-blue-500', light: 'bg-blue-100', text: 'text-blue-600' },
        { from: 'from-purple-500', to: 'to-purple-400', solid: 'bg-purple-500', light: 'bg-purple-100', text: 'text-purple-600' },
        { from: 'from-pink-500', to: 'to-pink-400', solid: 'bg-pink-500', light: 'bg-pink-100', text: 'text-pink-600' },
        { from: 'from-indigo-500', to: 'to-indigo-400', solid: 'bg-indigo-500', light: 'bg-indigo-100', text: 'text-indigo-600' },
        { from: 'from-green-500', to: 'to-green-400', solid: 'bg-green-500', light: 'bg-green-100', text: 'text-green-600' },
    ];
    return gradients[index % gradients.length];
};

// Filter to only include events from the product events table
const isProductEvent = (eventType: string): boolean => {
    const productEvents = ['page_view', 'first_touch', 'button_click', 'form_submit'];
    return productEvents.includes(eventType);
};

function VisualFunnel({ steps }: { steps: FunnelStep[] }) {
    // Filter steps to only show product events
    const productSteps = steps.filter(step => isProductEvent(step.event_type));

    if (!productSteps.length) {
        return (
            <div className="bg-white border border-gray-200 rounded-xl p-8">
                <div className="flex items-center gap-2 mb-6">
                    <h3 className="text-lg font-semibold text-gray-900">FUNNEL • LAST 90 DAYS</h3>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-8">Product Conversion Funnel</h2>
                <div className="text-center py-12">
                    <p className="text-gray-400">No product events found</p>
                </div>
            </div>
        );
    }

    const maxCount = Math.max(...productSteps.map(s => s.count));

    return (
        <div className="bg-white border border-gray-200 rounded-xl p-8">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">FUNNEL • LAST 90 DAYS</span>
                        <button className="px-2 py-0.5 bg-gray-100 hover:bg-gray-200 rounded text-xs font-medium">
                            Show details
                        </button>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">Product Conversion Funnel</h2>
                </div>
            </div>

            <div className="space-y-1 mt-8">
                {productSteps.map((step, idx) => {
                    const width = Math.max((step.count / maxCount) * 100, 15);
                    const colors = getGradientColors(idx);
                    const isLast = idx === productSteps.length - 1;
                    
                    // Calculate drop-off from previous step
                    let droppedCount = 0;
                    let droppedPercent = 0;
                    if (idx > 0) {
                        droppedCount = productSteps[idx - 1].count - step.count;
                        droppedPercent = (droppedCount / productSteps[idx - 1].count) * 100;
                    }

                    return (
                        <div key={step.step}>
                            {/* Step Row */}
                            <div className="relative py-3">
                                <div className="flex items-center gap-4">
                                    {/* Step Number */}
                                    <div className="flex-shrink-0 w-8">
                                        <span className="text-2xl font-bold text-gray-900">{idx + 1}</span>
                                    </div>

                                    {/* Funnel Bar */}
                                    <div className="flex-1 relative">
                                        {/* Step Label */}
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-sm font-semibold text-gray-900 capitalize">
                                                {step.event_type.replace(/_/g, ' ')}
                                            </span>
                                            <span className="text-xs text-gray-500">Pageview</span>
                                        </div>

                                        {/* Bar Container */}
                                        <div className="relative">
                                            {/* Background (full width) */}
                                            <div className="w-full h-8 bg-gray-100 rounded-lg overflow-hidden">
                                                {/* Completed portion */}
                                                <div
                                                    className={`h-full bg-gradient-to-r ${colors.from} ${colors.to} transition-all duration-1000`}
                                                    style={{ width: `${width}%` }}
                                                />
                                            </div>
                                            
                                            {/* Percentage label inside bar */}
                                            {width > 20 && (
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <span className="text-sm font-bold text-white">
                                                        {step.conversion_rate.toFixed(1)}%
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Stats Below Bar */}
                                        <div className="flex items-center justify-between mt-2">
                                            <div className="flex items-center gap-2 text-sm">
                                                <ArrowRight className="w-4 h-4 text-green-600" />
                                                <span className="font-semibold text-gray-900">
                                                    {step.count.toLocaleString()} persons
                                                </span>
                                                <span className="text-gray-500">
                                                    ({step.conversion_rate.toFixed(2)}%) completed step
                                                </span>
                                            </div>
                                            
                                            {!isLast && droppedCount > 0 && (
                                                <div className="flex items-center gap-2 text-sm">
                                                    <TrendingDown className="w-4 h-4 text-orange-500" />
                                                    <span className="font-semibold text-gray-900">
                                                        {droppedCount.toLocaleString()} persons
                                                    </span>
                                                    <span className="text-gray-500">
                                                        ({droppedPercent.toFixed(2)}%) dropped off
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export function BasicFunnel({ endpoint, repoId }: BasicFunnelProps) {
    const [steps, setSteps] = useState<FunnelStep[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`${endpoint}/analytics/funnel/graph?full=${repoId}`, { method: 'POST' })
            .then(res => res.json())
            .then(data => {
                setSteps(data.funnel?.steps || []);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [endpoint, repoId]);

    if (loading) return <div className="text-gray-400 font-mono bg-gray-900 border border-gray-800 rounded-xl p-8">Loading product funnel...</div>;

    return <VisualFunnel steps={steps} />;
}