import { useState, useEffect, useMemo, useRef } from 'react';
import type { HiscoreDelta } from '@/types/api';
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
  const [deltas, setDeltas] = useState<HiscoreDelta[]>([]);
  const [containerSize, setContainerSize] = useState({ width: 900, height: 150 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Check if time range exceeds 365 days
  const timeRangeExceedsLimit = useMemo(() => {
    if (!timeRange?.startTime || !timeRange?.endTime) return false;
    const daysDiff = (timeRange.endTime.getTime() - timeRange.startTime.getTime()) / (1000 * 60 * 60 * 24);
    return daysDiff > 365;
  }, [timeRange?.startTime?.getTime(), timeRange?.endTime?.getTime()]);

  // Fetch delta data for the time range
  useEffect(() => {
    async function fetchData() {
      if (!userId || timeRangeExceedsLimit) {
        setDeltas([]);
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

        const response = await apiClient.getSnapshotWithDeltas(userId, startDate, endDate);
        setDeltas(response.deltas || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
        setDeltas([]);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [userId, timeRange?.startTime?.getTime(), timeRange?.endTime?.getTime(), timeRangeExceedsLimit]);

  // Process deltas to build heatmap cells
  const { cells, monthLabels } = useMemo(() => {
    if (deltas.length === 0) {
      return { cells: [], monthLabels: [] };
    }

    // Aggregate deltas by date
    const dailyGains = new Map<string, number>();
    const dailySkillGains = new Map<string, Map<string, number>>();

    for (const delta of deltas) {
      const date = new Date(delta.timestamp);
      const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

      // Get overall experience gain from OVERALL skill
      const overallGain = delta.skills?.find(s => s.activityType === 'OVERALL')?.experienceGain || 0;

      // Skip if gain exceeds 10 million (likely data error)
      if (overallGain > 10_000_000) continue;

      // Accumulate overall gains for the day
      const currentDayGain = dailyGains.get(dateKey) || 0;
      const newTotal = currentDayGain + overallGain;

      if (newTotal <= 10_000_000) {
        dailyGains.set(dateKey, newTotal);
      }

      // Accumulate skill gains for breakdown
      if (delta.skills) {
        if (!dailySkillGains.has(dateKey)) {
          dailySkillGains.set(dateKey, new Map<string, number>());
        }
        const daySkillGains = dailySkillGains.get(dateKey)!;

        for (const skill of delta.skills) {
          if (skill.activityType === 'OVERALL') continue;
          if (skill.experienceGain <= 0 || skill.experienceGain > 10_000_000) continue;

          daySkillGains.set(skill.name, (daySkillGains.get(skill.name) || 0) + skill.experienceGain);
        }
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
        skillBreakdown = Array.from(daySkills.entries())
          .map(([skill, exp]) => ({ skill, experience: exp }))
          .sort((a, b) => b.experience - a.experience)
          .slice(0, 5);
      }

      // Track month labels
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

    const labels = Array.from(monthLabelMap.entries()).map(([label, week]) => ({
      label,
      weekIndex: week
    }));

    return { cells: cellsArray, monthLabels: labels };
  }, [deltas, timeRange?.startTime?.getTime(), timeRange?.endTime?.getTime()]);

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