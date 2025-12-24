import { useState, useEffect } from "react";
import { observabilityService, AuditLog } from "@/lib/observability-service";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, FileJson, FileText, Shield, Globe, Languages, RefreshCw, AlertTriangle, CheckCircle, Ban } from "lucide-react";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { supabase, rpc } from "@/lib/supabaseClient";

export default function AuditTrail() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        region: "all",
        language: "all",
        status: "all",
    });

    const fetchLogs = async () => {
        setLoading(true);
        const result = await observabilityService.getAuditLogs({
            region: filters.region === "all" ? undefined : filters.region,
            language: filters.language === "all" ? undefined : filters.language,
            status: filters.status === "all" ? undefined : filters.status,
        });
        setLogs(result);
        setLoading(false);
    };

    useEffect(() => {
        fetchLogs();
    }, [filters]);

    const exportJSON = () => {
        const dataStr = JSON.stringify(logs, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
        const exportFileDefaultName = 'observai_audit_trail.json';
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    };

    const exportPDF = () => {
        const doc = new jsPDF();
        doc.text("ObservAI Compliance Audit Report", 14, 15);
        doc.setFontSize(10);
        doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 22);

        const tableData = logs.map(log => [
            log.timestamp.toLocaleString(),
            log.user_region,
            log.language,
            log.model,
            log.decision_status,
            `${log.cost_usd.toFixed(4)}`
        ]);

        (doc as any).autoTable({
            head: [['Timestamp', 'Region', 'Lang', 'Model', 'Status', 'Cost (USD)']],
            body: tableData,
            startY: 30,
            theme: 'grid',
            headStyles: { fillColor: [33, 150, 243] }
        });

        doc.save("observai_audit_report.pdf");
    };

    const generateMock = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            await rpc.generateMockAuditData({ target_user_id: user.id });
            fetchLogs();
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Shield className="h-7 w-7 text-primary" />
                        Cross-Border AI Audit Trail
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Privacy-first cryptographic ledger for global compliance & governance.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={generateMock}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Seed Audit Data
                    </Button>
                    <Button variant="outline" size="sm" onClick={exportJSON}>
                        <FileJson className="h-4 w-4 mr-2" />
                        JSON
                    </Button>
                    <Button variant="default" size="sm" onClick={exportPDF}>
                        <FileText className="h-4 w-4 mr-2" />
                        Compliance PDF
                    </Button>
                </div>
            </div>

            <Card className="border-primary/20 bg-primary/5">
                <CardContent className="py-4">
                    <p className="text-sm font-medium italic text-primary/80">
                        "This is the 'Black Box' flight recorder for AI that makes global compliance as easy as checking a bank statement."
                    </p>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                    <label className="text-xs font-medium flex items-center gap-1">
                        <Globe className="h-3 w-3" /> Region
                    </label>
                    <Select value={filters.region} onValueChange={(v) => setFilters(f => ({ ...f, region: v }))}>
                        <SelectTrigger>
                            <SelectValue placeholder="All Regions" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Regions</SelectItem>
                            <SelectItem value="us-east-1">US East (N. Virginia)</SelectItem>
                            <SelectItem value="eu-central-1">EU (Frankfurt)</SelectItem>
                            <SelectItem value="ap-southeast-1">Asia Pacific (Singapore)</SelectItem>
                            <SelectItem value="sa-east-1">South America (São Paulo)</SelectItem>
                            <SelectItem value="af-south-1">Africa (Cape Town)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-medium flex items-center gap-1">
                        <Languages className="h-3 w-3" /> Language
                    </label>
                    <Select value={filters.language} onValueChange={(v) => setFilters(f => ({ ...f, language: v }))}>
                        <SelectTrigger>
                            <SelectValue placeholder="All Languages" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Languages</SelectItem>
                            <SelectItem value="en">English (EN)</SelectItem>
                            <SelectItem value="de">German (DE)</SelectItem>
                            <SelectItem value="ja">Japanese (JA)</SelectItem>
                            <SelectItem value="pt">Portuguese (PT)</SelectItem>
                            <SelectItem value="zu">Zulu (ZU)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-medium flex items-center gap-1">
                        <Shield className="h-3 w-3" /> Decision Status
                    </label>
                    <Select value={filters.status} onValueChange={(v) => setFilters(f => ({ ...f, status: v }))}>
                        <SelectTrigger>
                            <SelectValue placeholder="All Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="safe">Safe</SelectItem>
                            <SelectItem value="flagged">Flagged</SelectItem>
                            <SelectItem value="blocked">Blocked</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="rounded-xl border border-border bg-card overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Timestamp</TableHead>
                            <TableHead>Region/Lang</TableHead>
                            <TableHead>Model</TableHead>
                            <TableHead>Prompt Hash (Privacy Protected)</TableHead>
                            <TableHead>Risk Scores</TableHead>
                            <TableHead>Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-8">Loading audit logs...</TableCell>
                            </TableRow>
                        ) : logs.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                    No audit logs found. Seed some data to see the magic.
                                </TableCell>
                            </TableRow>
                        ) : (
                            logs.map((log) => (
                                <TableRow key={log.id} className="hover:bg-muted/50 transition-colors">
                                    <TableCell className="font-mono text-xs">
                                        {log.timestamp.toLocaleString()}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-medium text-sm">{log.user_region}</span>
                                            <span className="text-xs text-muted-foreground">{log.language.toUpperCase()}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-xs font-medium">{log.model}</TableCell>
                                    <TableCell>
                                        <code className="text-[10px] bg-muted px-1 py-0.5 rounded text-muted-foreground">
                                            {log.prompt_hash?.substring(0, 16) || 'n/a'}...
                                        </code>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex gap-2">
                                            <Badge variant="outline" className={log.hallucination_risk > 0.5 ? "text-orange-500 border-orange-500/20 bg-orange-500/5" : "text-green-500 border-green-500/20 bg-green-500/5"}>
                                                H: {log.hallucination_risk.toFixed(2)}
                                            </Badge>
                                            <Badge variant="outline" className={log.toxicity_score > 0.5 ? "text-red-500 border-red-500/20 bg-red-500/5" : "text-green-500 border-green-500/20 bg-green-500/5"}>
                                                T: {log.toxicity_score.toFixed(2)}
                                            </Badge>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {log.decision_status === 'safe' && (
                                            <Badge className="bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500/20">
                                                <CheckCircle className="h-3 w-3 mr-1" /> Safe
                                            </Badge>
                                        )}
                                        {log.decision_status === 'flagged' && (
                                            <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20 hover:bg-yellow-500/20">
                                                <AlertTriangle className="h-3 w-3 mr-1" /> Flagged
                                            </Badge>
                                        )}
                                        {log.decision_status === 'blocked' && (
                                            <Badge variant="destructive" className="bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20">
                                                <Ban className="h-3 w-3 mr-1" /> Blocked
                                            </Badge>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
