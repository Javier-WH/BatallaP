import React from 'react';
import { Card, Spin } from 'antd';
import { getContent } from '@/services/dashboardContentService';

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
  const [content, setContent] = React.useState<string>('');
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchContent = async () => {
      try {
        const data: DashboardContentData = await getContent();
        setContent(data.content);
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

  if (!content) {
    return (
      <Card>
        <div className="text-center text-slate-400 py-16">
          <p>No hay contenido personalizado en el dashboard</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="rounded-3xl border border-slate-100 shadow-xl shadow-slate-100/60">
      <div
        className="prose prose-slate max-w-none"
        dangerouslySetInnerHTML={{ __html: content }}
      />
    </Card>
  );
};

export default DashboardContent;
