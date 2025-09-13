
'use client';
import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Users, Activity, Zap, Target } from 'lucide-react';

interface KPI {
    label: string;
    value: string | number;
    change?: string;
    changeType?: 'positive' | 'negative' | 'neutral';
    icon: React.ComponentType<any>;
}

interface TopKPIsProps {
    endpoint: string;
    repoId: string;
}

export function TopKPIs({ endpoint, repoId }: TopKPIsProps) {
    const [kpis, setKpis] = useState<KPI[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            fetch(`${endpoint}/analytics/funnel/graph?full=${repoId}`, { method: 'POST' }),
            fetch(`${endpoint}/analytics/session/daily?full=${repoId}`)
        ])
            .then(async ([funnelRes, sessionsRes]) => {
                const funnel = await funnelRes.json();
                const sessions = await sessionsRes.json();

                const totalSessions = sessions.daily_sessions?.metrics.reduce((sum: number, m: any) => sum + m.sessions, 0) || 0;
                const signupConversion = funnel.funnel?.steps.find((s: any) => s.event_type === 'form_submit')?.conversion_rate || 0;

                setKpis([
                    { 
                        label: 'Total Sessions', 
                        value: totalSessions.toLocaleString(),
                        change: `${funnel.funnel?.unique_users || 0} users`,
                        changeType: 'positive',
                        icon: Users
                    },
                    { 
                        label: 'Total Events', 
                        value: (funnel.funnel?.total_events || 0).toLocaleString(),
                        change: `${funnel.funnel?.steps.length || 0} types`,
                        changeType: 'neutral',
                        icon: Activity
                    },
                    { 
                        label: 'Conversion Rate', 
                        value: `${signupConversion.toFixed(1)}%`,
                        change: signupConversion > 5 ? 'Strong' : 'Moderate',
                        changeType: signupConversion > 5 ? 'positive' : 'neutral',
                        icon: Target
                    },
                    { 
                        label: 'Active Routes', 
                        value: funnel.funnel?.steps.length || 0,
                        change: 'Live tracking',
                        changeType: 'positive',
                        icon: Zap
                    }
                ]);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [endpoint, repoId]);

    if (loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {[...Array(4)].map((_, idx) => (
                    <div key={idx} className="bg-gray-900 border border-gray-800 rounded-xl p-6 animate-pulse">
                        <div className="h-4 bg-gray-800 rounded mb-3"></div>
                        <div className="h-8 bg-gray-800 rounded"></div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {kpis.map((kpi, idx) => {
                const IconComponent = kpi.icon;
                const changeColor = {
                    positive: 'text-emerald-400 bg-emerald-500/10',
                    negative: 'text-red-400 bg-red-500/10',
                    neutral: 'text-blue-400 bg-blue-500/10'
                }[kpi.changeType || 'neutral'];

                return (
                    <div key={idx} className="bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-gray-700 transition-colors">
                        <div className="flex items-center space-x-3 mb-4">
                            <div className="p-2 bg-gray-800 rounded-lg">
                                <IconComponent className="w-4 h-4 text-gray-400" />
                            </div>
                            <div className="text-gray-400 text-sm font-mono font-medium uppercase tracking-wider">
                                {kpi.label}
                            </div>
                        </div>
                        <div className="flex items-end justify-between">
                            <div className="text-white text-3xl font-mono font-bold">
                                {kpi.value}
                            </div>
                            {kpi.change && (
                                <div className={`px-2 py-1 rounded-md font-mono text-xs font-medium ${changeColor}`}>
                                    {kpi.change}
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
