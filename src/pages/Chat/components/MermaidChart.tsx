import { useEffect, useMemo, useRef, useState } from 'react';
import { isDev } from '../../../config';

declare global {
  interface Window {
    mermaid: {
      initialize: (config: Record<string, unknown>) => void;
      render: (
        id: string,
        text: string,
        svgContainingElement?: Element
      ) => Promise<{
        svg: string;
        diagramType: string;
        bindFunctions?: (element: Element) => void;
      }>;
    };
  }
}

type MermaidTheme = 'default' | 'forest' | 'dark' | 'neutral';

interface MermaidDrawerProps {
  className?: string;
  code: string;
  theme?: MermaidTheme;
}

export default function MermaidChart({
  className,
  code,
  theme = 'default',
}: MermaidDrawerProps) {
  const chartRef = useRef<HTMLDivElement | null>(null);
  const [mermaidLoaded, setMermaidLoaded] = useState(false);

  const renderId = useMemo(
    () =>
      `mermaid-diagram-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    []
  );

  useEffect(() => {
    if (window.mermaid) {
      window.mermaid.initialize({ startOnLoad: false, theme });
      setMermaidLoaded(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js';
    script.onload = () => {
      if (!window.mermaid) return;
      window.mermaid.initialize({ startOnLoad: false, theme });
      setMermaidLoaded(true);
      if (isDev) console.debug('Mermaid is loaded');
    };
    document.body.appendChild(script);
    return () => {
      if (script.parentNode) script.parentNode.removeChild(script);
    };
  }, [theme]);

  useEffect(() => {
    if (!mermaidLoaded || !chartRef.current || !code) return;
    if (isDev) console.debug('Mermaid rendering:', renderId);
    window.mermaid
      .render(renderId, code)
      .then(({ svg, diagramType }) => {
        if (chartRef.current) {
          chartRef.current.innerHTML = svg;
          chartRef.current.ariaLabel = `Mermaid ${diagramType} chart`;
        }
      })
      .catch((error) => {
        console.error('Mermaid rendering error:', error);
        if (!chartRef.current) return;
        chartRef.current.innerHTML = `<pre>${code}</pre>`;
        chartRef.current.ariaLabel =
          'Mermaid diagram (render failed, showing raw code)';
      });
  }, [code, mermaidLoaded, renderId]);

  return (
    <div ref={chartRef} className={className} role="img" aria-label="Diagram">
      <pre className="mermaid">${code}</pre>
    </div>
  );
}
