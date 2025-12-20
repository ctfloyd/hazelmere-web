import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface OverallStatsDataPoint {
  timestamp: string;
  totalLevel: number;
  totalExperience: number;
  combatLevel: number;
  date: Date;
}

interface OverallStatsChartProps {
  data: OverallStatsDataPoint[];
  title?: string;
}

export function OverallStatsChart({ 
  data, 
  title = "Overall Progress" 
}: OverallStatsChartProps) {
  const formatXAxis = (tickItem: string) => {
    const date = new Date(tickItem);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const formatTooltip = (value: number, name: string) => {
    switch (name) {
      case 'totalLevel':
        return [value, 'Total Level'];
      case 'totalExperience':
        return [value.toLocaleString(), 'Total XP'];
      case 'combatLevel':
        return [value, 'Combat Level'];
      default:
        return [value, name];
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis 
                dataKey="timestamp" 
                tickFormatter={formatXAxis}
                className="text-muted-foreground"
              />
              <YAxis className="text-muted-foreground" />
              <Tooltip 
                formatter={formatTooltip}
                labelFormatter={(label) => 
                  new Date(label).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long', 
                    day: 'numeric'
                  })
                }
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px'
                }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="totalLevel" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                name="Total Level"
              />
              <Line 
                type="monotone" 
                dataKey="combatLevel" 
                stroke="hsl(var(--destructive))" 
                strokeWidth={2}
                name="Combat Level"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}