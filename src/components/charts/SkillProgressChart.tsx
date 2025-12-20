import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface SkillDataPoint {
  timestamp: string;
  level: number;
  experience: number;
  date: Date;
}

interface SkillProgressChartProps {
  skillName: string;
  data: SkillDataPoint[];
  metric?: 'level' | 'experience';
}

export function SkillProgressChart({ 
  skillName, 
  data, 
  metric = 'experience' 
}: SkillProgressChartProps) {
  const formatXAxis = (tickItem: string) => {
    const date = new Date(tickItem);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const formatTooltip = (value: number, name: string) => {
    if (name === 'experience') {
      return [value.toLocaleString(), 'Experience'];
    }
    return [value, 'Level'];
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{skillName} Progress</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
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
              <Line 
                type="monotone" 
                dataKey={metric} 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}