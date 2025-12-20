import { useState, useRef, useEffect, useMemo } from 'react';
import type { HiscoreSnapshot, ActivityType, AggregationWindow } from '@/types/api';
import { BOSS_ACTIVITY_TYPES } from '@/types/api';
import { formatActivityTypeName } from '@/lib/dataUtils';
import { WebGLBarChart } from '@/components/charts/WebGLBarChart';
import { WebGLLineChart } from '@/components/charts/WebGLLineChart';

interface GainsChartProps {
  snapshots: HiscoreSnapshot[];
  selectedActivity?: ActivityType | null;
  chartType?: 'cumulative' | 'daily';
  aggregationWindow?: AggregationWindow | null;
  onTimeRangeSelect?: (startTime: Date, endTime: Date) => void;
}

interface SkillGain {
  skill: string;
  experience: number;
}

interface ChartDataPoint {
  date: string;
  timestamp: number;
  cumulativeValue: number;
  dailyGain: number;
  level?: number;
  skillBreakdown?: SkillGain[];
}

function extractActivityData(snapshot: HiscoreSnapshot, activityType?: ActivityType | null) {
  if (!activityType) {
    // Total XP from all skills
    return {
      value: snapshot.skills
        .filter(skill => skill.activityType !== 'OVERALL')
        .reduce((sum, skill) => sum + skill.experience, 0),
      level: undefined
    };
  }

  const activity = [
    ...snapshot.skills,
    ...snapshot.bosses,
    ...snapshot.activities
  ].find(item => item.activityType === activityType);

  if (!activity) return { value: 0, level: undefined };

  if ('experience' in activity) {
    return { value: activity.experience, level: activity.level };
  }
  
  if ('killCount' in activity) {
    return { value: activity.killCount, level: undefined };
  }
  
  if ('score' in activity) {
    return { value: activity.score, level: undefined };
  }

  return { value: 0, level: undefined };
}

function generateChartData(snapshots: HiscoreSnapshot[], activityType?: ActivityType | null): ChartDataPoint[] {
  if (snapshots.length === 0) return [];

  const sortedSnapshots = [...snapshots].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const data: ChartDataPoint[] = [];
  let previousValue = 0;
  let previousSnapshot: HiscoreSnapshot | null = null;

  sortedSnapshots.forEach((snapshot, index) => {
    const { value, level } = extractActivityData(snapshot, activityType);
    const date = new Date(snapshot.timestamp);
    
    const dailyGain = index === 0 ? 0 : value - previousValue;
    
    // Calculate skill breakdown for Overall activity
    let skillBreakdown: SkillGain[] | undefined;
    if ((!activityType || activityType === 'OVERALL') && previousSnapshot && dailyGain > 0) {
      const skillGains: SkillGain[] = [];
      
      snapshot.skills.forEach(currSkill => {
        if (currSkill.activityType === 'OVERALL') return;
        
        const prevSkill = previousSnapshot!.skills.find(s => s.activityType === currSkill.activityType);
        if (prevSkill) {
          const skillGain = currSkill.experience - prevSkill.experience;
          if (skillGain > 0 && skillGain <= 10_000_000) {
            skillGains.push({
              skill: currSkill.name,
              experience: skillGain
            });
          }
        }
      });
      
      // Sort by experience and take top 5
      skillBreakdown = skillGains
        .sort((a, b) => b.experience - a.experience)
        .slice(0, 5);
    }
    
    // Filter out daily gains exceeding 10 million XP (likely data errors)
    let displayDailyGain = 0;
    if (dailyGain > 0) {
      // Only apply 10M cap for experience-based activities (not bosses or score-based activities)
      const isBossActivity = activityType && BOSS_ACTIVITY_TYPES.includes(activityType);
      const isScoreActivity = activityType && ['LEAGUE_POINTS', 'DEADMAN_POINTS', 'BOUNTY_HUNTER__HUNTER', 'BOUNTY_HUNTER__ROGUE',
          'BOUNTY_HUNTER_LEGACY__HUNTER', 'BOUNTY_HUNTER_LEGACY__ROGUE', 'CLUE_SCROLLS_ALL',
          'CLUE_SCROLLS_BEGINNER', 'CLUE_SCROLLS_EASY', 'CLUE_SCROLLS_MEDIUM', 'CLUE_SCROLLS_HARD',
          'CLUE_SCROLLS_ELITE', 'CLUE_SCROLLS_MASTER', 'LMS__RANK', 'PVP_ARENA__RANK',
          'SOUL_WARS_ZEAL', 'RIFTS_CLOSED', 'COLOSSEUM_GLORY', 'COLLECTIONS_LOGGED'].includes(activityType);
      const isExperience = !activityType || (!isBossActivity && !isScoreActivity);

      if (isExperience && dailyGain > 10_000_000) {
        // Skip this data point for daily gains as it's likely an error
        displayDailyGain = 0;
      } else {
        // For daily gains, filter out very small gains that are likely noise
        const minimumGain = isBossActivity ? 1 : 100;
        displayDailyGain = dailyGain >= minimumGain ? dailyGain : 0;
      }
    }
    
    data.push({
      date: date.toLocaleDateString(),
      timestamp: date.getTime(),
      cumulativeValue: value,
      dailyGain: displayDailyGain,
      level,
      skillBreakdown
    });

    previousValue = value;
    previousSnapshot = snapshot;
  });

  return data;
}

// Check if an activity type uses small values (kill counts, scores) vs large XP values
function isSmallValueActivity(activityType?: ActivityType | null): boolean {
  if (!activityType) return false;

  // Boss activities have kill counts (typically 1-100 per day)
  if (BOSS_ACTIVITY_TYPES.includes(activityType)) return true;

  // These activities have scores that are typically smaller than XP
  if (['LEAGUE_POINTS', 'DEADMAN_POINTS', 'BOUNTY_HUNTER__HUNTER', 'BOUNTY_HUNTER__ROGUE',
       'BOUNTY_HUNTER_LEGACY__HUNTER', 'BOUNTY_HUNTER_LEGACY__ROGUE', 'CLUE_SCROLLS_ALL',
       'CLUE_SCROLLS_BEGINNER', 'CLUE_SCROLLS_EASY', 'CLUE_SCROLLS_MEDIUM', 'CLUE_SCROLLS_HARD',
       'CLUE_SCROLLS_ELITE', 'CLUE_SCROLLS_MASTER', 'LMS__RANK', 'PVP_ARENA__RANK',
       'SOUL_WARS_ZEAL', 'RIFTS_CLOSED', 'COLOSSEUM_GLORY', 'COLLECTIONS_LOGGED'].includes(activityType)) {
    return true;
  }

  return false;
}

// Calculate optimal domain for Y-axis based on data range, excluding outliers for daily gains
// Also returns the upper bound for anomaly detection
function calculateYAxisDomain(data: ChartDataPoint[], dataKey: 'cumulativeValue' | 'dailyGain', isSmallValue: boolean = false): { domain: [number, number]; upperBound: number } {
  if (data.length === 0) return { domain: [0, 100], upperBound: 100 };

  const values = data.map(d => d[dataKey]).filter(v => v > 0);
  if (values.length === 0) return { domain: [0, 100], upperBound: 100 };

  const max = Math.max(...values);

  // For small value activities (boss KC, clue scrolls, etc.), use value-appropriate minimum padding
  const minPadding = isSmallValue ? Math.max(1, Math.ceil(max * 0.1)) : 1000;

  if (dataKey === 'dailyGain') {
    // For daily gains, exclude outliers using IQR method
    const sorted = [...values].sort((a, b) => a - b);

    // Need at least 4 data points for meaningful IQR
    if (sorted.length < 4) {
      const padding = Math.max(max * 0.1, minPadding);
      const ceiling = Math.ceil(max + padding);
      return { domain: [0, ceiling], upperBound: ceiling };
    }

    const q1Index = Math.floor(sorted.length * 0.25);
    const q3Index = Math.floor(sorted.length * 0.75);
    const q1 = sorted[q1Index];
    const q3 = sorted[q3Index];
    const iqr = q3 - q1;
    const upperBound = q3 + 3 * iqr;

    // Find max non-outlier value
    const nonOutliers = sorted.filter(v => v <= upperBound);
    const maxNonOutlier = nonOutliers.length > 0
      ? nonOutliers[nonOutliers.length - 1]
      : max;

    // Add small padding (5%) above the max non-outlier
    const padding = Math.ceil(maxNonOutlier * 0.05);
    return { domain: [0, maxNonOutlier + padding], upperBound };
  } else {
    // For cumulative, use a smarter range
    const min = Math.min(...values);
    const range = max - min;

    // If the range is very small compared to the values, show the actual growth
    if (range < max * 0.1) {
      const padding = Math.max(range * 0.2, minPadding);
      return {
        domain: [
          Math.max(0, Math.floor(min - padding)),
          Math.ceil(max + padding)
        ],
        upperBound: max
      };
    } else {
      // Otherwise use a more standard range
      const padding = Math.max(range * 0.05, max * 0.02);
      return {
        domain: [
          Math.max(0, Math.floor(min - padding)),
          Math.ceil(max + padding)
        ],
        upperBound: max
      };
    }
  }
}

// Detect anomaly timestamps based on overall XP data using IQR method
function detectAnomalyTimestamps(data: ChartDataPoint[]): Set<number> {
  const anomalies = new Set<number>();

  const values = data.map(d => d.dailyGain).filter(v => v > 0);
  if (values.length < 4) return anomalies;

  const sorted = [...values].sort((a, b) => a - b);
  const q1Index = Math.floor(sorted.length * 0.25);
  const q3Index = Math.floor(sorted.length * 0.75);
  const q1 = sorted[q1Index];
  const q3 = sorted[q3Index];
  const iqr = q3 - q1;
  const upperBound = q3 + 3 * iqr;

  // Mark timestamps where daily gain exceeds the upper bound as anomalies
  data.forEach(d => {
    if (d.dailyGain > upperBound) {
      anomalies.add(d.timestamp);
    }
  });

  return anomalies;
}

function getValueLabel(activityType?: ActivityType | null): string {
  if (!activityType) return 'Total XP';

  const activityName = formatActivityTypeName(activityType);

  if (BOSS_ACTIVITY_TYPES.includes(activityType)) {
    return `${activityName} KC`;
  }

  if (['LEAGUE_POINTS', 'DEADMAN_POINTS', 'BOUNTY_HUNTER__HUNTER', 'BOUNTY_HUNTER__ROGUE',
       'BOUNTY_HUNTER_LEGACY__HUNTER', 'BOUNTY_HUNTER_LEGACY__ROGUE', 'CLUE_SCROLLS_ALL',
       'CLUE_SCROLLS_BEGINNER', 'CLUE_SCROLLS_EASY', 'CLUE_SCROLLS_MEDIUM', 'CLUE_SCROLLS_HARD',
       'CLUE_SCROLLS_ELITE', 'CLUE_SCROLLS_MASTER', 'LMS__RANK', 'PVP_ARENA__RANK',
       'SOUL_WARS_ZEAL', 'RIFTS_CLOSED', 'COLOSSEUM_GLORY', 'COLLECTIONS_LOGGED'].includes(activityType)) {
    return `${activityName} Score`;
  }

  return `${activityName} XP`;
}

export function GainsChart({ snapshots, selectedActivity, chartType = 'cumulative', aggregationWindow, onTimeRangeSelect }: GainsChartProps) {
  const [customCeiling, setCustomCeiling] = useState<number | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 800, height: 320 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Data is already aggregated by the server based on aggregationWindow
  const chartData = useMemo(() => {
    return generateChartData(snapshots, selectedActivity);
  }, [snapshots, selectedActivity]);

  // Generate overall XP data for anomaly detection (used even when specific activity is selected)
  const overallChartData = useMemo(() => {
    if (!selectedActivity) return chartData;
    return generateChartData(snapshots, null);
  }, [snapshots, selectedActivity, chartData]);

  // Detect anomalies based on overall XP data
  const anomalyTimestamps = useMemo(
    () => detectAnomalyTimestamps(overallChartData),
    [overallChartData]
  );

  const valueLabel = useMemo(() => getValueLabel(selectedActivity), [selectedActivity]);

  // Calculate base Y-axis domain - exclude anomaly days from the calculation
  const { domain: baseYAxisDomain } = useMemo(() => {
    // Filter out data points from anomaly days when calculating the domain
    const filteredData = chartData.filter(d => !anomalyTimestamps.has(d.timestamp));
    // Use filtered data if we have enough points, otherwise use all data
    const dataForDomain = filteredData.length >= 2 ? filteredData : chartData;
    return calculateYAxisDomain(
      dataForDomain,
      chartType === 'cumulative' ? 'cumulativeValue' : 'dailyGain',
      isSmallValueActivity(selectedActivity)
    );
  }, [chartData, chartType, anomalyTimestamps, selectedActivity]);

  // Reset custom ceiling when switching chart types or when data changes significantly
  useEffect(() => {
    setCustomCeiling(null);
  }, [chartType, selectedActivity]);

  // Track container size for WebGL chart
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      setContainerSize({ width: rect.width, height: rect.height });
    };

    updateSize();
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, []);

  // For daily gains, allow ceiling adjustment via dragging
  const yAxisDomain = chartType === 'daily' && customCeiling !== null
    ? [0, customCeiling]
    : baseYAxisDomain;

  // Transform data for WebGL bar chart (daily gains)
  const webglBarData = useMemo(() =>
    chartData.map(d => ({
      timestamp: d.timestamp,
      value: d.dailyGain,
      date: d.date,
      skillBreakdown: d.skillBreakdown
    })),
    [chartData]
  );

  // Transform data for WebGL line chart (cumulative)
  const webglLineData = useMemo(() =>
    chartData.map(d => ({
      timestamp: d.timestamp,
      value: d.cumulativeValue,
      dailyGain: d.dailyGain,
      date: d.date,
      level: d.level,
      skillBreakdown: d.skillBreakdown
    })),
    [chartData]
  );

  // Handle Y-axis max change from WebGL chart
  const handleYAxisMaxChange = useMemo(() => (max: number) => {
    setCustomCeiling(max);
  }, []);

  if (chartData.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-muted-foreground">
        No data available for chart
      </div>
    );
  }

  // Get label for the aggregation window
  const aggregationLabel = aggregationWindow === 'monthly' ? 'Monthly' :
    aggregationWindow === 'weekly' ? 'Weekly' : 'Daily';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          {chartType === 'cumulative' ? 'Progress Over Time' : `${aggregationLabel} Gains`}
          {selectedActivity && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({formatActivityTypeName(selectedActivity)})
            </span>
          )}
          {aggregationWindow && aggregationWindow !== 'daily' && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              (aggregated {aggregationWindow})
            </span>
          )}
        </h3>
      </div>

      <div
        ref={containerRef}
        className="h-80 relative"
      >
        {chartType === 'cumulative' ? (
          /* WebGL-accelerated line chart for cumulative progress */
          <WebGLLineChart
            data={webglLineData}
            width={containerSize.width}
            height={containerSize.height}
            valueLabel={valueLabel}
            onTimeRangeSelect={onTimeRangeSelect}
          />
        ) : (
          /* WebGL-accelerated bar chart for daily gains */
          <WebGLBarChart
            data={webglBarData}
            yAxisMax={yAxisDomain[1]}
            yAxisMinMax={isSmallValueActivity(selectedActivity) ? 10 : 100}
            onYAxisMaxChange={handleYAxisMaxChange}
            width={containerSize.width}
            height={containerSize.height}
            onTimeRangeSelect={onTimeRangeSelect}
          />
        )}
      </div>
    </div>
  );
}