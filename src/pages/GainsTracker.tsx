import { useState, useEffect, useCallback, useMemo } from 'react';
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
import { useSnapshotWithDeltas, useApiHealth } from '@/hooks/useApi';
import type { ActivityType } from '@/types/api';
import {
  formatNumber,
  calculateGainsFromDeltas,
  getActivityGainFromDeltas
} from '@/lib/dataUtils';
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
  const [selectedActivity, setSelectedActivity] = useState<ActivityType>(
    () => (searchParams.get('activity') as ActivityType) || 'OVERALL'
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

  const { data: deltaResponse, loading, error, refetch, totalDeltas } = useSnapshotWithDeltas(
    userId,
    timeRange.startTime,
    timeRange.endTime
  );
  const { isHealthy, checking } = useApiHealth();

  // Calculate gains directly from deltas
  const { totalGain, levelGain } = useMemo(() => {
    if (!deltaResponse?.deltas || deltaResponse.deltas.length === 0) {
      return { totalGain: 0, levelGain: 0 };
    }

    if (selectedActivity === 'OVERALL') {
      // Get total XP gain from OVERALL skill in deltas
      const gainsSummary = calculateGainsFromDeltas(deltaResponse.deltas);
      return { totalGain: gainsSummary.totalExperienceGain, levelGain: 0 };
    }

    // Get gains for specific activity
    return getActivityGainFromDeltas(deltaResponse.deltas, selectedActivity);
  }, [deltaResponse, selectedActivity]);

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
    <div className="space-y-4 sm:space-y-6">
      {/* Header - hidden on mobile since title is in navbar */}
      <div className="hidden sm:block">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Gains Tracker</h1>
            <p className="text-muted-foreground mt-2">
              Track your RuneScape progress over time
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

      <div className="flex gap-2 sm:gap-4">
        <div className="flex-1">
          <TimeRangeSelector
            selectedRange={timeRange}
            onRangeChange={setTimeRange}
          />
        </div>

        <div className="flex-1">
          <ActivitySelector
            selectedActivity={selectedActivity}
            onActivityChange={setSelectedActivity}
          />
        </div>
      </div>

      <div className="flex gap-1 sm:gap-2">
        <Button
          size="sm"
          variant={chartType === 'cumulative' ? 'default' : 'outline'}
          onClick={() => setChartType('cumulative')}
          className="flex-1 px-2 sm:px-3 h-9"
        >
          <TrendingUp className="h-4 w-4 mr-1 sm:mr-2" />
          <span className="text-xs sm:text-sm">Cumulative</span>
        </Button>
        <Button
          size="sm"
          variant={chartType === 'daily' ? 'default' : 'outline'}
          onClick={() => setChartType('daily')}
          className="flex-1 px-2 sm:px-3 h-9"
        >
          <BarChart3 className="h-4 w-4 mr-1 sm:mr-2" />
          <span className="text-xs sm:text-sm">Daily Gains</span>
        </Button>
      </div>

      {/* Summary Stats */}
      {deltaResponse && totalDeltas > 0 && (
        <div className="grid gap-2 sm:gap-4 grid-cols-3 sm:grid-cols-4">
          <Card>
            <CardContent className="p-2 sm:p-4">
              <p className="text-[10px] sm:text-sm font-medium text-muted-foreground truncate">
                {selectedActivity !== 'OVERALL' ? 'Gain' : 'XP Gained'}
              </p>
              {loading ? (
                <Skeleton className="h-5 sm:h-8 w-12 sm:w-20 mt-1" />
              ) : (
                <div className="text-sm sm:text-2xl font-bold text-green-600 truncate">
                  +{formatNumber(totalGain)}
                </div>
              )}
            </CardContent>
          </Card>

          {selectedActivity !== 'OVERALL' && levelGain > 0 && (
            <Card className="hidden sm:block">
              <CardContent className="p-2 sm:p-4">
                <p className="text-[10px] sm:text-sm font-medium text-muted-foreground truncate">
                  Levels
                </p>
                {loading ? (
                  <Skeleton className="h-5 sm:h-8 w-12 sm:w-20 mt-1" />
                ) : (
                  <div className="text-sm sm:text-2xl font-bold text-blue-600">
                    +{levelGain}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-2 sm:p-4">
              <p className="text-[10px] sm:text-sm font-medium text-muted-foreground truncate">
                Changes
              </p>
              {loading ? (
                <Skeleton className="h-5 sm:h-8 w-12 sm:w-20 mt-1" />
              ) : (
                <div className="text-sm sm:text-2xl font-bold">
                  {totalDeltas}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-2 sm:p-4">
              <p className="text-[10px] sm:text-sm font-medium text-muted-foreground truncate">
                Days
              </p>
              <div className="text-sm sm:text-2xl font-bold">
                {Math.ceil((timeRange.endTime.getTime() - timeRange.startTime.getTime()) / (1000 * 60 * 60 * 24))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts and Heatmap */}
      {deltaResponse && totalDeltas > 0 && (
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-1">
          <Card>
            <CardHeader className="hidden sm:block pb-2 sm:pb-6">
              <CardTitle className="text-base sm:text-lg">Progress Visualization</CardTitle>
            </CardHeader>
            <CardContent className="p-2 sm:p-6 overflow-hidden">
              {loading ? (
                <div className="h-64 sm:h-80 flex items-center justify-center">
                  <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
                </div>
              ) : (
                <GainsChart
                  deltaResponse={deltaResponse}
                  selectedActivity={selectedActivity}
                  chartType={chartType}
                  onTimeRangeSelect={handleChartTimeRangeSelect}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="hidden sm:block pb-2 sm:pb-6">
              <CardTitle className="text-base sm:text-lg">Experience Heatmap - {timeRange.label}</CardTitle>
            </CardHeader>
            <CardContent className="p-2 sm:p-6 overflow-hidden">
              <DailyHeatmap
                userId={userId}
                timeRange={timeRange}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {userId && !loading && (!deltaResponse || totalDeltas === 0) && (
        <Card>
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No data found</h3>
            <p className="text-muted-foreground mb-4">
              No progress data was found for the selected time period.
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