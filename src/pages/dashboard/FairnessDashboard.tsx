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
    Graticule,
    ZoomableGroup
} from "react-simple-maps";
import {
    Scale,
    Map as MapIcon,
    RefreshCw,
    Globe,
    Zap,
    AlertCircle
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
                <CardContent className="p-0 h-[450px] relative flex items-center justify-center overflow-hidden cursor-move">
                    <div className="absolute inset-0 z-0 flex items-center justify-center">
                        <ComposableMap projectionConfig={{ rotate: [-10, 0, 0], scale: 175 }}>
                            <ZoomableGroup zoom={1} maxZoom={8}>
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
                            </ZoomableGroup>
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
                <Card className="border-accent/10 bg-card/50 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <Zap className="h-4 w-4 text-accent" />
                            AI Tax Gap (Cost Multiplier)
                        </CardTitle>
                        <CardDescription>Premium paid per 1k tokens vs US benchmark.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart layout="vertical" data={chartData} margin={{ left: 40, right: 30 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#333" />
                                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#888' }} unit="k$" />
                                <YAxis
                                    dataKey="name"
                                    type="category"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 9, fill: '#AAA' }}
                                    width={100}
                                />
                                <Tooltip
                                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                    contentStyle={{
                                        backgroundColor: 'rgba(10, 10, 10, 0.95)',
                                        border: '1px solid rgba(0, 225, 255, 0.3)',
                                        fontSize: '11px',
                                        borderRadius: '8px',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                                        color: '#fff'
                                    }}
                                    itemStyle={{ color: '#0ea5e9', fontWeight: 'bold' }}
                                />
                                <Bar dataKey="cost" radius={[0, 4, 4, 0]} barSize={16}>
                                    {chartData.map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={entry.status === 'inequality' ? '#ef4444' : entry.status === 'imbalance' ? '#f97316' : '#0ea5e9'}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card className="border-accent/10 bg-card/50 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <Globe className="h-4 w-4 text-primary" />
                            Latency Inequality Index
                        </CardTitle>
                        <CardDescription>Wait times for global users (ms). Red indicates systemic underperformance.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#333" />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 8, fill: '#AAA', angle: -25, textAnchor: 'end' } as any}
                                    height={50}
                                />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#888' }} />
                                <Tooltip
                                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                    contentStyle={{
                                        backgroundColor: 'rgba(10, 10, 10, 0.95)',
                                        border: '1px solid rgba(0, 225, 255, 0.3)',
                                        fontSize: '11px',
                                        borderRadius: '8px',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                                        color: '#fff'
                                    }}
                                    itemStyle={{ color: '#0ea5e9', fontWeight: 'bold' }}
                                />
                                <Bar dataKey="latency" radius={[4, 4, 0, 0]} barSize={24}>
                                    {chartData.map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={entry.status === 'inequality' ? '#ef4444' : entry.status === 'imbalance' ? '#f97316' : '#0ea5e9'}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            <div className="bg-orange-500/10 border border-orange-500/20 p-4 rounded-xl flex gap-3 items-start backdrop-blur-sm">
                <AlertCircle className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
                <div>
                    <h4 className="text-sm font-bold text-orange-400">Inequality Warning</h4>
                    <p className="text-xs text-orange-300/80 mt-1 leading-relaxed">
                        Users in Southeast Asia and Africa regions are consistently paying <span className="text-orange-400 font-bold">1.5x - 2.0x higher costs</span> with significantly lower response quality scores compared to US nodes.
                    </p>
                </div>
            </div>
        </div>
    );
}
