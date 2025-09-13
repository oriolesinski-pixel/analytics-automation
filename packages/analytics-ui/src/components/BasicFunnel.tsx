'use client';
import { useState, useEffect } from 'react';
import { Users, MousePointer, Eye, FileText, CheckCircle, ShoppingCart, Package } from 'lucide-react';
 
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
        'from-blue-500 to-blue-600',
        'from-indigo-500 to-purple-600',
        'from-purple-500 to-pink-600',
        'from-pink-500 to-rose-600',
        'from-red-500 to-orange-600',
        'from-orange-500 to-yellow-600',
        'from-green-500 to-emerald-600'
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
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-8">
                <h3 className="text-xl font-mono font-semibold text-white mb-6">Product Conversion Funnel</h3>
                <div className="text-center py-12">
                    <p className="text-gray-400 font-mono">No product events found</p>
                </div>
            </div>
        );
    }

    const maxCount = Math.max(...productSteps.map(s => s.count));

    return (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8">
            <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-mono font-semibold text-white">Product Conversion Funnel</h3>
                <div className="text-sm font-mono text-gray-400">
                    {productSteps.length} steps • {maxCount.toLocaleString()} total events
                </div>
            </div>

            <div className="space-y-4">
                {productSteps.map((step, idx) => {
                    const width = Math.max((step.count / maxCount) * 100, 8);
                    const IconComponent = getEventIcon(step.event_type);
                    const gradientClass = getGradientColors(idx);

                    return (
                        <div key={step.step} className="relative">
                            <div className="bg-gray-800 rounded-lg h-12 flex items-center overflow-hidden border border-gray-700">
                                <div
                                    className={`h-full flex items-center justify-between px-4 rounded-lg bg-gradient-to-r transition-all duration-1000 ${gradientClass}`}
                                    style={{ width: `${width}%` }}
                                >
                                    <div className="flex items-center space-x-3">
                                        <div className="p-1.5 bg-white/10 rounded-md">
                                            <IconComponent className="w-4 h-4 text-white" />
                                        </div>
                                        <div>
                                            <div className="text-white/90 font-mono text-xs font-medium capitalize">
                                                {step.event_type.replace(/_/g, ' ')}
                                            </div>
                                            <div className="text-white font-mono text-sm font-bold">
                                                {step.count.toLocaleString()}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="text-right">
                                        <div className="text-white font-mono text-sm font-bold">
                                            {step.conversion_rate.toFixed(1)}%
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