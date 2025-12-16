import { useEffect, useRef } from 'react';
import mermaid from 'mermaid';

interface MermaidDiagramProps {
  chart: string;
  className?: string;
}

export const MermaidDiagram = ({ chart, className = '' }: MermaidDiagramProps) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
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
          }
        } catch (error) {
          console.error('Mermaid rendering error:', error);
          if (ref.current) {
            ref.current.innerHTML = `<div class="text-destructive text-sm">Error rendering diagram</div>`;
          }
        }
      };

      renderDiagram();
    }
  }, [chart]);

  return <div ref={ref} className={`mermaid-diagram ${className}`} />;
};
