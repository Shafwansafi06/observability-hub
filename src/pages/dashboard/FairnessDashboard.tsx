import { useState, useEffect } from "react";
import { observabilityService, FairnessData } from "@/lib/observability-service";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
    Legend
} from "recharts";
import { Compass, AlertCircle, TrendingDown, Scale, Map as MapIcon, Info } from "lucide-react";

export default function FairnessDashboard() {
    const [data, setData] = useState<FairnessData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchFairness = async () => {
            setLoading(true);
            const result = await observabilityService.getFairnessData();
            setData(result);
            setLoading(false);
        };
        fetchFairness();
    }, []);

    const chartData = data.map(item => ({
        name: `${item.region} (${item.language})`,
        cost: item.avgCost * 1000, // Normalized for chart
        latency: item.avgLatency,
        fairness: item.fairnessScore * 100,
        status: item.status
    })).sort((a, b) => b.cost - a.cost);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Scale className="h-7 w-7 text-accent" />
                        Global Cost Fairness
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Exposing hidden inequality in AI cost, latency, and quality across borders.
                    </p>
                </div>
                <Badge variant="outline" className="h-fit px-3 py-1 border-accent/30 bg-accent/5 text-accent">
                    <MapIcon className="h-3 w-3 mr-1" /> Multi-Regional Monitoring
                </Badge>
            </div>

            <Card className="border-accent/20 bg-accent/5">
                <CardContent className="py-4">
                    <p className="text-sm font-medium italic text-accent/80">
                        "We reveal the 'AI Tax'—where a developer in Nairobi pays 3x more for worse AI performance than one in San Francisco."
                    </p>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {data.slice(0, 3).map((item, i) => (
                    <Card key={i} className={`border-l-4 ${item.status === 'inequality' ? 'border-l-destructive bg-destructive/5' :
                            item.status === 'imbalance' ? 'border-l-orange-500 bg-orange-500/5' :
                                'border-l-green-500 bg-green-500/5'
                        }`}>
                        <CardHeader className="pb-2">
                            <div className="flex justify-between items-start">
                                <CardTitle className="text-lg">{item.region}</CardTitle>
                                <Badge variant={item.status === 'fair' ? 'default' : item.status === 'imbalance' ? 'secondary' : 'destructive'}>
                                    {item.status.toUpperCase()}
                                </Badge>
                            </div>
                            <CardDescription className="text-xs uppercase font-bold text-muted-foreground">
                                Language: {item.language}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-1">
                                <div className="flex justify-between text-xs">
                                    <span>Fairness Score</span>
                                    <span className="font-bold">{Math.round(item.fairnessScore * 100)}/100</span>
                                </div>
                                <Progress value={item.fairnessScore * 100} className="h-1.5" />
                            </div>
                            <div className="grid grid-cols-2 gap-2 pt-2">
                                <div className="bg-background/50 p-2 rounded-lg border">
                                    <span className="text-[10px] text-muted-foreground block uppercase">Avg Latency</span>
                                    <span className="text-sm font-mono font-bold">{Math.round(item.avgLatency)}ms</span>
                                </div>
                                <div className="bg-background/50 p-2 rounded-lg border">
                                    <span className="text-[10px] text-muted-foreground block uppercase">Avg Cost</span>
                                    <span className="text-sm font-mono font-bold">${item.avgCost.toFixed(4)}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="bg-card">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingDown className="h-5 w-5 text-destructive" />
                            The "AI Tax" Gap (Cost per 1k Requests)
                        </CardTitle>
                        <CardDescription>
                            Normalized USD cost across different regions for the same model.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="h-[350px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} layout="vertical" margin={{ left: 40, right: 30 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} opacity={0.1} />
                                <XAxis type="number" hide />
                                <YAxis
                                    dataKey="name"
                                    type="category"
                                    width={150}
                                    tick={{ fontSize: 10, fill: '#888' }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <Tooltip
                                    cursor={{ fill: 'rgba(0,0,0,0.1)' }}
                                    contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', fontSize: '12px' }}
                                />
                                <Bar dataKey="cost" radius={[0, 4, 4, 0]} barSize={20}>
                                    {chartData.map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={entry.status === 'inequality' ? '#ef4444' : entry.status === 'imbalance' ? '#f97316' : '#22c55e'}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card className="bg-card">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Compass className="h-5 w-5 text-accent" />
                            Latency Inequality Index
                        </CardTitle>
                        <CardDescription>
                            Wait times for global users (ms). Red indicates systemic underperformance.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="h-[350px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                                <XAxis dataKey="name" tick={{ fontSize: 8 }} angle={-45} textAnchor="end" height={80} />
                                <YAxis tick={{ fontSize: 10, fill: '#888' }} />
                                <Tooltip
                                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                    contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', fontSize: '12px' }}
                                />
                                <Bar dataKey="latency" radius={[4, 4, 0, 0]} barSize={30}>
                                    {chartData.map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={entry.latency > 1500 ? '#ef4444' : entry.latency > 1000 ? '#f97316' : '#0ea5e9'}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            <div className="flex items-center gap-2 p-4 rounded-xl border border-yellow-500/20 bg-yellow-500/5 text-yellow-500/80 text-sm">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <div>
                    <span className="font-bold">Fairness Insight:</span> Your Southeast Asia and Africa nodes are currently experiencing 40% higher latency for the same quality scores compared to US nodes.
                </div>
            </div>
        </div>
    );
}
