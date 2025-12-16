import { useEffect, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import { Loader2 } from 'lucide-react';

/**
 * MermaidDiagram
 * Props:
 *  - chart: mermaid diagram source (string). IMPORTANT: this component will sanitize the rendered SVG output
 *    before inserting into the DOM using DOMPurify. However, the `chart` prop should be treated as
 *    trusted input where possible. If you must accept untrusted user input, validate it before
 *    passing it into this component. The component will reject input containing obvious HTML/script
 *    payloads.
 */
interface MermaidDiagramProps {
  chart: string;
  className?: string;
}

export const MermaidDiagram = ({ chart, className = '' }: MermaidDiagramProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Dynamically import mermaid to reduce initial bundle size
    const loadMermaid = async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        
        if (ref.current) {
          // Generate unique ID for this render using Web Crypto API
          const uniqueId = `mermaid-${crypto.randomUUID()}`;
          
          // Initialize mermaid with dark theme support
          mermaid.initialize({
        startOnLoad: true,
        theme: 'dark',
        themeVariables: {
          primaryColor: '#8b5cf6',
          primaryTextColor: '#fff',
          primaryBorderColor: '#7c3aed',
          lineColor: '#a78bfa',
          secondaryColor: '#1e293b',
          tertiaryColor: '#0f172a',
          background: '#0f172a',
          mainBkg: '#1e293b',
          secondBkg: '#334155',
          textColor: '#e2e8f0',
          fontSize: '14px',
          fontFamily: 'ui-monospace, SFMono-Regular, monospace',
        },
        flowchart: {
          curve: 'basis',
          padding: 20,
          nodeSpacing: 50,
          rankSpacing: 50,
          useMaxWidth: true,
        },
        sequence: {
          mirrorActors: false,
          useMaxWidth: true,
        },
      });

          // Basic validation: prevent obvious HTML / script payloads in the mermaid source.
          // Mermaid expects a domain-specific textual syntax; if the chart string contains
          // raw HTML like <script>, <svg>, <img>, on* attributes or javascript: URIs, reject it.
          const isChartSafe = (txt: string) => {
            if (!txt) return false;
            const forbidden = /<\/?(script|svg|img|iframe|object|embed)|on[a-zA-Z]+=|javascript:|data:text\//i;
            return !forbidden.test(txt);
          };

          const renderDiagram = async () => {
            try {
              if (!isChartSafe(chart)) {
                console.warn('MermaidDiagram: rejected chart prop because it contains disallowed content');
                setError('Diagram contains disallowed content');
                setLoading(false);
                return;
              }

              const { svg } = await mermaid.render(uniqueId, chart);

              // Sanitize the generated SVG before inserting into the DOM to mitigate XSS risks.
              // Use the SVG profile so DOMPurify knows to allow valid svg attributes while
              // stripping scripts and dangerous attributes.
              const clean = DOMPurify.sanitize(svg, (DOMPurify as any).getDefaultConfig
                ? { USE_PROFILES: { svg: true } }
                : { SAFE_FOR_SVG: true } as any
              ) as string;

              if (ref.current) {
                ref.current.innerHTML = clean;
                setLoading(false);
              }
            } catch (error) {
              console.error('Mermaid rendering error:', error);
              setError('Failed to render diagram');
              setLoading(false);
            }
          };

          renderDiagram();
        }
      } catch (err) {
        console.error('Failed to load mermaid:', err);
        setError('Failed to load diagram library');
        setLoading(false);
      }
    };

    loadMermaid();
  }, [chart]);

  if (loading) {
    return (
      <div className={`mermaid-diagram ${className} flex items-center justify-center min-h-[300px]`}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading diagram...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`mermaid-diagram ${className} flex items-center justify-center min-h-[300px]`}>
        <div className="text-destructive text-sm">{error}</div>
      </div>
    );
  }

  return <div ref={ref} className={`mermaid-diagram ${className}`} />;
};
