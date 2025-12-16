import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

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

          // Render the diagram
          const renderDiagram = async () => {
            try {
              const { svg } = await mermaid.render(`mermaid-${Date.now()}`, chart);
              if (ref.current) {
                ref.current.innerHTML = svg;
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
