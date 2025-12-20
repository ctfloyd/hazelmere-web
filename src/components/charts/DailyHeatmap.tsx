import { useState, useEffect, useMemo, useRef } from 'react';
import type { HiscoreSnapshot } from '@/types/api';
import { apiClient } from '@/lib/api';
import { WebGLHeatmap } from './WebGLHeatmap';

interface TimeRange {
  startTime: Date;
  endTime: Date;
}

interface DailyHeatmapProps {
  userId: string | null;
  timeRange?: TimeRange;
}

interface SkillGain {
  skill: string;
  experience: number;
}

interface HeatmapCell {
  date: Date;
  experience: number;
  weekIndex: number;
  dayOfWeek: number;
  month: number;
  year: number;
  dateString: string;
  skillBreakdown?: SkillGain[];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function DailyHeatmap({ userId, timeRange }: DailyHeatmapProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<HiscoreSnapshot[]>([]);
  const [containerSize, setContainerSize] = useState({ width: 900, height: 150 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Check if time range exceeds 365 days
  const timeRangeExceedsLimit = useMemo(() => {
    if (!timeRange?.startTime || !timeRange?.endTime) return false;
    const daysDiff = (timeRange.endTime.getTime() - timeRange.startTime.getTime()) / (1000 * 60 * 60 * 24);
    return daysDiff > 365;
  }, [timeRange?.startTime?.getTime(), timeRange?.endTime?.getTime()]);

  // Fetch snapshot data for the time range
  useEffect(() => {
    async function fetchData() {
      if (!userId || timeRangeExceedsLimit) {
        setSnapshots([]);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Use provided time range or default to last year
        const endDate = timeRange?.endTime ?? new Date();
        const startDate = timeRange?.startTime ?? (() => {
          const d = new Date();
          d.setFullYear(d.getFullYear() - 1);
          return d;
        })();

        // Get one extra day before start for comparison
        const fetchStartDate = new Date(startDate);
        fetchStartDate.setDate(fetchStartDate.getDate() - 1);

        // Always use 'daily' aggregation for heatmap
        const response = await apiClient.getSnapshotInterval(userId, fetchStartDate, endDate, 'daily');
        setSnapshots(response.snapshots);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
        setSnapshots([]);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [userId, timeRange?.startTime?.getTime(), timeRange?.endTime?.getTime(), timeRangeExceedsLimit]);

  // Process snapshots to calculate experience gains
  const { cells, monthLabels, rowCount } = useMemo(() => {
    if (snapshots.length < 2) {
      return { cells: [], monthLabels: [], rowCount: 7 };
    }

    // Sort snapshots by timestamp
    const sorted = [...snapshots].sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Calculate daily gains from OVERALL skill and skill breakdowns
    const dailyGains = new Map<string, number>();
    const dailySkillGains = new Map<string, Map<string, number>>();

    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];

      const prevOverall = prev.skills.find(s => s.activityType === 'OVERALL');
      const currOverall = curr.skills.find(s => s.activityType === 'OVERALL');

      if (!prevOverall || !currOverall) continue;

      const expGain = currOverall.experience - prevOverall.experience;

      // Skip negative gains (shouldn't happen but just in case)
      if (expGain < 0) continue;

      // Skip if gain exceeds 10 million (likely data error)
      if (expGain > 10_000_000) continue;

      const date = new Date(curr.timestamp);
      const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

      // Calculate individual skill gains for breakdown
      const skillGainsForSnapshot = new Map<string, number>();
      curr.skills.forEach(currSkill => {
        if (currSkill.activityType === 'OVERALL') return;

        const prevSkill = prev.skills.find(s => s.activityType === currSkill.activityType);
        if (prevSkill) {
          const skillGain = currSkill.experience - prevSkill.experience;
          if (skillGain > 0 && skillGain <= 10_000_000) {
            skillGainsForSnapshot.set(currSkill.name, skillGain);
          }
        }
      });

      // Accumulate skill gains for the day
      if (!dailySkillGains.has(dateKey)) {
        dailySkillGains.set(dateKey, new Map<string, number>());
      }
      const daySkillGains = dailySkillGains.get(dateKey)!;
      skillGainsForSnapshot.forEach((gain, skill) => {
        daySkillGains.set(skill, (daySkillGains.get(skill) || 0) + gain);
      });

      // Accumulate overall gains for the same day, but cap total daily gain at 10M
      const currentDayGain = dailyGains.get(dateKey) || 0;
      const newTotal = currentDayGain + expGain;

      // Only set if the total for the day doesn't exceed 10M
      if (newTotal <= 10_000_000) {
        dailyGains.set(dateKey, newTotal);
      }
    }

    // Generate dates for the time range
    const endDate = timeRange?.endTime ? new Date(timeRange.endTime) : new Date();
    endDate.setHours(0, 0, 0, 0);

    const startDate = timeRange?.startTime ? new Date(timeRange.startTime) : (() => {
      const d = new Date(endDate);
      d.setFullYear(d.getFullYear() - 1);
      d.setDate(d.getDate() + 1);
      return d;
    })();
    startDate.setHours(0, 0, 0, 0);

    // Daily aggregation - generate 7-row grid layout
    // Find the Sunday at or before the start date
    const startSunday = new Date(startDate);
    startSunday.setDate(startSunday.getDate() - startSunday.getDay());

    // Generate all cells
    const cellsArray: HeatmapCell[] = [];
    const monthLabelMap = new Map<string, number>();
    let weekIndex = 0;
    const currentDate = new Date(startSunday);

    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay();

      // Start a new week column when we hit Sunday (except the first iteration)
      if (dayOfWeek === 0 && cellsArray.length > 0) {
        weekIndex++;
      }

      const dateKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
      const experience = dailyGains.get(dateKey) || 0;

      // Get skill breakdown for this day
      let skillBreakdown: SkillGain[] | undefined;
      if (dailySkillGains.has(dateKey)) {
        const daySkills = dailySkillGains.get(dateKey)!;
        // Convert to array and sort by experience, take top 5
        skillBreakdown = Array.from(daySkills.entries())
          .map(([skill, exp]) => ({ skill, experience: exp }))
          .sort((a, b) => b.experience - a.experience)
          .slice(0, 5);
      }

      // Track month labels - record the week index where each month appears
      const monthYear = `${MONTHS[currentDate.getMonth()]} '${String(currentDate.getFullYear()).slice(-2)}`;
      if (!monthLabelMap.has(monthYear) && currentDate.getDate() <= 7) {
        monthLabelMap.set(monthYear, weekIndex);
      }

      cellsArray.push({
        date: new Date(currentDate),
        experience,
        weekIndex,
        dayOfWeek,
        month: currentDate.getMonth(),
        year: currentDate.getFullYear(),
        dateString: dateKey,
        skillBreakdown
      });
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Convert month labels to array
    const labels = Array.from(monthLabelMap.entries()).map(([label, week]) => ({
      label,
      weekIndex: week
    }));
    
    return { cells: cellsArray, monthLabels: labels };
  }, [snapshots, timeRange?.startTime?.getTime(), timeRange?.endTime?.getTime()]);

  // Track container size
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      setContainerSize({ width: rect.width, height: 150 });
    };

    updateSize();
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, []);

  if (timeRangeExceedsLimit) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="text-muted-foreground text-center">
          <p>The experience heatmap can only display up to 365 days of data.</p>
          <p className="text-sm mt-1">Please select a smaller time range to view the heatmap.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="text-muted-foreground">Loading experience data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="text-red-500">Error: {error}</div>
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="text-muted-foreground">Select a user to view experience heatmap</div>
      </div>
    );
  }

  if (cells.length === 0) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="text-muted-foreground">No experience data available</div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full">
      <WebGLHeatmap
        cells={cells}
        monthLabels={monthLabels}
        width={containerSize.width}
        height={containerSize.height}
      />
    </div>
  );
}