import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UserSelector } from '@/components/UserSelector';
import { TimeRangeSelector } from '@/components/TimeRangeSelector';
import type { TimeRange } from '@/components/TimeRangeSelector';
import { ActivitySelector } from '@/components/ActivitySelector';
import { DailyHeatmap } from '@/components/charts/DailyHeatmap';
import { GainsChart } from '@/components/charts/GainsChart';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { Skeleton } from '@/components/ui/skeleton';
import { useSnapshotInterval, useApiHealth } from '@/hooks/useApi';
import type { ActivityType } from '@/types/api';
import { formatNumber, formatActivityTypeName } from '@/lib/dataUtils';
import { AlertCircle, CheckCircle2, BarChart3, TrendingUp } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { format } from 'date-fns';

// Default time range is last year
const DEFAULT_TIME_RANGE: TimeRange = {
  startTime: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
  endTime: new Date(),
  label: 'Last Year'
};

function getInitialTimeRange(searchParams: URLSearchParams): TimeRange {
  const start = searchParams.get('start');
  const end = searchParams.get('end');

  if (start && end) {
    const startTime = new Date(start);
    const endTime = new Date(end);
    if (!isNaN(startTime.getTime()) && !isNaN(endTime.getTime())) {
      return { startTime, endTime, label: 'Custom' };
    }
  }

  return DEFAULT_TIME_RANGE;
}

export function GainsTracker() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [userId, setUserId] = useState<string | null>(() => searchParams.get('player'));
  const [timeRange, setTimeRange] = useState<TimeRange>(() => getInitialTimeRange(searchParams));
  const [selectedActivity, setSelectedActivity] = useState<ActivityType | null>(
    () => (searchParams.get('activity') as ActivityType) || null
  );
  const [chartType, setChartType] = useState<'cumulative' | 'daily'>(
    () => (searchParams.get('chart') === 'daily' ? 'daily' : 'cumulative')
  );

  // Update URL when state changes
  const updateSearchParams = useCallback(() => {
    const params = new URLSearchParams();

    if (userId) params.set('player', userId);
    if (timeRange.label === 'Custom' || timeRange.label !== 'Last Year') {
      params.set('start', timeRange.startTime.toISOString());
      params.set('end', timeRange.endTime.toISOString());
    }
    if (selectedActivity) params.set('activity', selectedActivity);
    if (chartType !== 'cumulative') params.set('chart', chartType);

    setSearchParams(params, { replace: true });
  }, [userId, timeRange, selectedActivity, chartType, setSearchParams]);

  useEffect(() => {
    updateSearchParams();
  }, [updateSearchParams]);

  const { data: snapshots, loading, error, refetch, aggregationWindow, totalSnapshots, snapshotsWithGains } = useSnapshotInterval(
    userId,
    timeRange.startTime,
    timeRange.endTime
  );
  const { isHealthy, checking } = useApiHealth();

  // Sort snapshots chronologically for proper first/last calculation
  const sortedSnapshots = snapshots ? [...snapshots].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  ) : null;
  
  const firstSnapshot = sortedSnapshots && sortedSnapshots.length > 0 ? sortedSnapshots[0] : null;
  const latestSnapshot = sortedSnapshots && sortedSnapshots.length > 0 ? sortedSnapshots[sortedSnapshots.length - 1] : null;

  // Calculate gains for selected activity or total XP
  const calculateGains = () => {
    if (!sortedSnapshots || sortedSnapshots.length < 2 || !latestSnapshot || !firstSnapshot) {
      return { totalGain: 0, levelGain: 0 };
    }

    if (!selectedActivity) {
      // Calculate total XP gain
      const latestTotalXp = latestSnapshot.skills
        .filter(skill => skill.activityType !== 'OVERALL')
        .reduce((sum, skill) => sum + skill.experience, 0);
      const firstTotalXp = firstSnapshot.skills
        .filter(skill => skill.activityType !== 'OVERALL')
        .reduce((sum, skill) => sum + skill.experience, 0);
      
      return { totalGain: latestTotalXp - firstTotalXp, levelGain: 0 };
    }

    // Calculate gains for specific activity
    const latestActivity = [
      ...latestSnapshot.skills,
      ...latestSnapshot.bosses,
      ...latestSnapshot.activities
    ].find(item => item.activityType === selectedActivity);

    const firstActivity = [
      ...firstSnapshot.skills,
      ...firstSnapshot.bosses,
      ...firstSnapshot.activities
    ].find(item => item.activityType === selectedActivity);

    if (!latestActivity || !firstActivity) {
      return { totalGain: 0, levelGain: 0 };
    }

    let totalGain = 0;
    let levelGain = 0;

    if ('experience' in latestActivity && 'experience' in firstActivity) {
      totalGain = latestActivity.experience - firstActivity.experience;
      levelGain = latestActivity.level - firstActivity.level;
    } else if ('killCount' in latestActivity && 'killCount' in firstActivity) {
      totalGain = latestActivity.killCount - firstActivity.killCount;
    } else if ('score' in latestActivity && 'score' in firstActivity) {
      totalGain = latestActivity.score - firstActivity.score;
    }

    return { totalGain, levelGain };
  };

  const { totalGain, levelGain } = calculateGains();

  // Handle time range selection from chart drag
  const handleChartTimeRangeSelect = useCallback((startTime: Date, endTime: Date) => {
    const customRange: TimeRange = {
      startTime,
      endTime,
      label: `${format(startTime, 'MMM d, yyyy')} - ${format(endTime, 'MMM d, yyyy')}`
    };
    setTimeRange(customRange);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Gains Tracker</h1>
            <p className="text-muted-foreground mt-2">
              Track your RuneScape progress over time with detailed analytics
            </p>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2 text-sm cursor-help">
                  {checking ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                      Checking API...
                    </div>
                  ) : isHealthy ? (
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle2 className="h-4 w-4" />
                      API Online
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-red-600">
                      <AlertCircle className="h-4 w-4" />
                      API Offline
                    </div>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Endpoint: https://api.hazelmere.xyz</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <UserSelector userId={userId} onUserIdChange={setUserId} />

      {error && !loading && (
        <ErrorAlert error={error} onRetry={refetch} title="Failed to load gains data" />
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <TimeRangeSelector 
          selectedRange={timeRange} 
          onRangeChange={setTimeRange} 
        />
        
        <ActivitySelector
          selectedActivity={selectedActivity}
          onActivityChange={setSelectedActivity}
        />

        <Card>
          <CardContent className="p-3">
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={chartType === 'cumulative' ? 'default' : 'outline'}
                onClick={() => setChartType('cumulative')}
                className="flex-1"
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                Cumulative
              </Button>
              <Button
                size="sm"
                variant={chartType === 'daily' ? 'default' : 'outline'}
                onClick={() => setChartType('daily')}
                className="flex-1"
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                Daily Gains
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Summary Stats */}
      {snapshots && snapshots.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {selectedActivity ? 'Activity Gain' : 'Total XP Gained'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold text-green-600">
                  +{formatNumber(totalGain)}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {timeRange.label.toLowerCase()}
              </p>
            </CardContent>
          </Card>

          {selectedActivity && levelGain > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Levels Gained</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  <div className="text-2xl font-bold text-blue-600">
                    +{levelGain}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  {formatActivityTypeName(selectedActivity)}
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Snapshots</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold">
                  {snapshotsWithGains}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                of {totalSnapshots} snapshots had gains
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Time Period</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Math.ceil((timeRange.endTime.getTime() - timeRange.startTime.getTime()) / (1000 * 60 * 60 * 24))}
              </div>
              <p className="text-xs text-muted-foreground">
                days tracked
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts and Heatmap */}
      {sortedSnapshots && sortedSnapshots.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-1">
          <Card>
            <CardHeader>
              <CardTitle>Progress Visualization</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-80 flex items-center justify-center">
                  <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
                </div>
              ) : (
                <GainsChart
                  snapshots={sortedSnapshots}
                  selectedActivity={selectedActivity}
                  chartType={chartType}
                  aggregationWindow={aggregationWindow}
                  onTimeRangeSelect={handleChartTimeRangeSelect}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Experience Heatmap - {timeRange.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <DailyHeatmap
                userId={userId}
                timeRange={timeRange}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {userId && !loading && (!snapshots || snapshots.length === 0) && (
        <Card>
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No data found</h3>
            <p className="text-muted-foreground mb-4">
              No snapshots were found for the selected time period.
              Try selecting a different time range or ensure snapshots exist for this user.
            </p>
            <Button onClick={refetch} variant="outline">
              Retry
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}