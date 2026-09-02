import React from 'react';
import { Card, Spin } from 'antd';
import { getContent } from '@/services/dashboardContentService';

interface DashboardElement {
  id: string;
  type: 'text' | 'image';
  x: number;
  y: number;
  width: number;
  height: number;
  content?: string;
  imageUrl?: string;
  styles?: {
    fontWeight?: string;
    fontStyle?: string;
    textDecoration?: string;
    color?: string;
    backgroundColor?: string;
    fontSize?: string;
    filter?: string;
    border?: string;
    borderRadius?: string;
    opacity?: number;
  };
}

interface DashboardContentData {
  id: number;
  content: string;
  updatedBy?: number;
  updatedAt: string;
}

interface DashboardContentProps {
  reloadKey?: number;
}

const DashboardContent: React.FC<DashboardContentProps> = ({ reloadKey }) => {
  const [elements, setElements] = React.useState<DashboardElement[]>([]);
  const [backgroundColor, setBackgroundColor] = React.useState('#ffffff');
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchContent = async () => {
      try {
        const data: DashboardContentData = await getContent();
        if (data.content) {
          try {
            const parsed = JSON.parse(data.content);
            if (Array.isArray(parsed)) {
              setElements(parsed);
            } else {
              setElements(parsed.elements || []);
              setBackgroundColor(parsed.backgroundColor || '#ffffff');
            }
          } catch {
            // If content is not JSON (old HTML format), render as HTML
            setElements([]);
          }
        } else {
          setElements([]);
        }
      } catch (error) {
        console.error('Error loading dashboard content:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchContent();
  }, [reloadKey]);

  if (loading) {
    return (
      <Card>
        <div className="flex justify-center items-center h-64">
          <Spin size="large" />
        </div>
      </Card>
    );
  }

  if (elements.length === 0) {
    return (
      <Card>
        <div className="text-center text-slate-400 py-16">
          <p>No hay contenido personalizado en el dashboard</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="rounded-3xl border border-slate-100 shadow-xl shadow-slate-100/60 dashboard-card">
      <div className="dashboard-canvas-wrapper">
        <div
          className="dashboard-canvas relative"
          style={{ minHeight: 'calc(100vh - 200px)', backgroundColor }}
        >
          {elements.map((element) => (
            <div
              key={element.id}
              className="absolute"
              style={{
                left: element.x,
                top: element.y,
                width: element.width,
                height: element.height,
              }}
            >
              {element.type === 'text' ? (
                <div
                  className="p-2 prose prose-slate max-w-none"
                  style={{
                    fontWeight: element.styles?.fontWeight,
                    fontStyle: element.styles?.fontStyle,
                    textDecoration: element.styles?.textDecoration,
                    color: element.styles?.color,
                    backgroundColor: element.styles?.backgroundColor,
                    fontSize: element.styles?.fontSize,
                  }}
                  dangerouslySetInnerHTML={{ __html: element.content || '' }}
                />
              ) : (
                <img
                  src={element.imageUrl}
                  alt="Dashboard element"
                  className="w-full h-full object-fill"
                  draggable={false}
                  style={{
                    filter: element.styles?.filter,
                    border: element.styles?.border,
                    borderRadius: element.styles?.borderRadius,
                    opacity: element.styles?.opacity,
                  }}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
};

export default DashboardContent;
