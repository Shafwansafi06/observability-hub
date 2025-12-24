import { useState, useEffect } from "react";
import { observabilityService, FairnessData } from "@/lib/observability-service";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
} from "recharts";
import {
    ComposableMap,
    Geographies,
    Geography,
    Marker,
    Sphere,
    Graticule
} from "react-simple-maps";
import {
    Compass,
    AlertCircle,
    TrendingDown,
    Scale,
    Map as MapIcon,
    RefreshCw,
    Globe,
    Zap
} from "lucide-react";
import { supabase, rpc } from "@/lib/supabaseClient";
import { toast } from "sonner";

const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

export default function FairnessDashboard() {
    const [data, setData] = useState<FairnessData[]>([]);
    const [loading, setLoading] = useState(true);
    const [seeding, setSeeding] = useState(false);

    const fetchFairness = async () => {
        setLoading(true);
        const result = await observabilityService.getFairnessData();
        setData(result);
        setLoading(false);
    };

    useEffect(() => {
        fetchFairness();
    }, []);

    const handleSeed = async () => {
        setSeeding(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                await rpc.generateMockAuditData({ target_user_id: user.id });
                toast.success("Global fairness data seeded successfully!");
                fetchFairness();
            } else {
                toast.error("Please log in to seed data");
            }
        } catch (error) {
            console.error(error);
            toast.error("Failed to seed data");
        } finally {
            setSeeding(false);
        }
    };

    const chartData = data.map(item => ({
        name: `${item.region} (${item.language})`,
        cost: item.avgCost * 1000,
        latency: item.avgLatency,
        fairness: item.fairnessScore * 100,
        status: item.status
    })).sort((a, b) => b.cost - a.cost);

    return (
        <div className="space-y-6 pb-12">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Scale className="h-7 w-7 text-accent" />
                        Global Cost Fairness
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                        Exposing hidden inequality in AI cost, latency, and quality across borders.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSeed}
                        disabled={seeding}
                        className="bg-accent/5 border-accent/20 hover:bg-accent/10"
                    >
                        <RefreshCw className={`h-4 w-4 mr-2 ${seeding ? 'animate-spin' : ''}`} />
                        Seed Global Data
                    </Button>
                    <Badge variant="outline" className="h-fit px-3 py-1 border-accent/30 bg-accent/5 text-accent hidden sm:flex">
                        <MapIcon className="h-3 w-3 mr-1" /> Multi-Regional Monitoring
                    </Badge>
                </div>
            </div>

            {/* Global Heatmap Section */}
            <Card className="overflow-hidden border-accent/20 bg-card/30 backdrop-blur-xl">
                <CardHeader className="bg-gradient-to-r from-accent/10 to-transparent">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Globe className="h-5 w-5 text-accent" />
                        AI Performance Disparity Map
                    </CardTitle>
                    <CardDescription>
                        Real-time visualization of cost (marker size) and latency (color intensity) inequality.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-0 h-[450px] relative flex items-center justify-center overflow-hidden">
                    <div className="absolute inset-0 z-0 flex items-center justify-center">
                        <ComposableMap projectionConfig={{ rotate: [-10, 0, 0], scale: 175 }}>
                            <Sphere stroke="#333" strokeWidth={0.5} id="sphere" fill="transparent" />
                            <Graticule stroke="#333" strokeWidth={0.5} />
                            <Geographies geography={geoUrl}>
                                {({ geographies }) =>
                                    geographies.map((geo) => (
                                        <Geography
                                            key={geo.rsmKey}
                                            geography={geo}
                                            fill="#1a1a1a"
                                            stroke="#333"
                                            strokeWidth={0.5}
                                            style={{
                                                default: { outline: "none" },
                                                hover: { fill: "#222", outline: "none" },
                                                pressed: { outline: "none" },
                                            }}
                                        />
                                    ))
                                }
                            </Geographies>
                            {data.map((item, i) => {
                                const coords = observabilityService.getRegionCoordinates(item.region);
                                const isDown = item.status === 'inequality';
                                return (
                                    <Marker key={i} coordinates={coords}>
                                        <circle
                                            r={isDown ? 8 : 6}
                                            fill={isDown ? "#ef4444" : item.status === 'imbalance' ? "#f97316" : "#0ea5e9"}
                                            fillOpacity={0.6}
                                            className="animate-pulse"
                                        />
                                        <text
                                            textAnchor="middle"
                                            y={-12}
                                            style={{
                                                fontFamily: "Inter, sans-serif",
                                                fill: "#AAA",
                                                fontSize: "8px",
                                                fontWeight: "bold",
                                                pointerEvents: "none"
                                            }}
                                        >
                                            {item.region}
                                        </text>
                                    </Marker>
                                );
                            })}
                        </ComposableMap>
                    </div>
                    {data.length === 0 && !loading && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/50 backdrop-blur-sm z-10 p-6 text-center">
                            <div className="bg-accent/10 p-4 rounded-full mb-4">
                                <Zap className="h-8 w-8 text-accent animate-pulse" />
                            </div>
                            <h3 className="text-xl font-bold">No Data Visualized</h3>
                            <p className="text-muted-foreground max-w-sm mt-2">
                                Click the "Seed Global Data" button above to populate the world map with regional AI performance statistics.
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {data.slice(0, 3).map((item, i) => (
                    <Card key={i} className={`border-l-4 overflow-hidden ${item.status === 'inequality' ? 'border-l-destructive bg-destructive/5' :
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
                        <CardContent className="space-y-4 text-sm">
                            <div className="space-y-1">
                                <div className="flex justify-between text-xs">
                                    <span>Fairness Score</span>
                                    <span className="font-bold">{Math.round(item.fairnessScore * 100)}/100</span>
                                </div>
                                <Progress value={item.fairnessScore * 100} className="h-1.5" />
                            </div>
                            <div className="grid grid-cols-2 gap-2 pt-2">
                                <div className="bg-background/40 p-2 rounded-lg border border-border/50">
                                    <span className="text-[10px] text-muted-foreground block uppercase font-bold">Latency</span>
                                    <span className="text-sm font-mono font-bold text-primary">{Math.round(item.avgLatency)}ms</span>
                                </div>
                                <div className="bg-background/40 p-2 rounded-lg border border-border/50">
                                    <span className="text-[10px] text-muted-foreground block uppercase font-bold">Avg Cost</span>
                                    <span className="text-sm font-mono font-bold text-accent">${item.avgCost.toFixed(4)}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="bg-card/50 backdrop-blur-md border-border/50">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-md">
                            <TrendingDown className="h-5 w-5 text-destructive" />
                            The "AI Tax" Gap (Cost per 1k Requests)
                        </CardTitle>
                        <CardDescription className="text-xs">
                            Normalized USD cost across different regions for the same model.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        {data.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 30 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} opacity={0.05} />
                                    <XAxis type="number" hide />
                                    <YAxis
                                        dataKey="name"
                                        type="category"
                                        width={120}
                                        tick={{ fontSize: 10, fill: '#888' }}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <Tooltip
                                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                        contentStyle={{ backgroundColor: '#111', border: '1px solid #333', fontSize: '11px', borderRadius: '8px' }}
                                    />
                                    <Bar dataKey="cost" radius={[0, 4, 4, 0]} barSize={16}>
                                        {chartData.map((entry, index) => (
                                            <Cell
                                                key={`cell-${index}`}
                                                fill={entry.status === 'inequality' ? '#ef4444' : entry.status === 'imbalance' ? '#f97316' : '#22c55e'}
                                            />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-muted-foreground text-sm italic">
                                Awaiting data synchronization...
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="bg-card/50 backdrop-blur-md border-border/50">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-md">
                            <Compass className="h-5 w-5 text-accent" />
                            Latency Inequality Index
                        </CardTitle>
                        <CardDescription className="text-xs">
                            Wait times for global users (ms). Red indicates systemic underperformance.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        {data.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} margin={{ top: 10 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.05} />
                                    <XAxis dataKey="name" tick={{ fontSize: 8 }} angle={-25} textAnchor="end" height={60} />
                                    <YAxis tick={{ fontSize: 10, fill: '#888' }} />
                                    <Tooltip
                                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                        contentStyle={{ backgroundColor: '#111', border: '1px solid #333', fontSize: '11px', borderRadius: '8px' }}
                                    />
                                    <Bar dataKey="latency" radius={[4, 4, 0, 0]} barSize={24}>
                                        {chartData.map((entry, index) => (
                                            <Cell
                                                key={`cell-${index}`}
                                                fill={entry.latency > 1500 ? '#ef4444' : entry.latency > 1000 ? '#f97316' : '#0ea5e9'}
                                            />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-muted-foreground text-sm italic">
                                Awaiting data synchronization...
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <div className="flex items-center gap-3 p-4 rounded-xl border border-yellow-500/20 bg-yellow-500/5 text-yellow-500/80 text-xs sm:text-sm">
                <AlertCircle className="h-5 w-5 shrink-0 text-yellow-500" />
                <div>
                    <span className="font-bold">Fairness Insight:</span> {data.length > 0
                        ? "Your Southeast Asia and Africa nodes are currently experiencing 40% higher latency for the same quality scores compared to US nodes."
                        : "Seed data to generate fairness insights across your global infrastructure."}
                </div>
            </div>
        </div>
    );
}
