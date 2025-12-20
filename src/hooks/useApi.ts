import { useState, useEffect, useCallback } from 'react';
import { apiClient, type ApiError } from '@/lib/api';
import type { HiscoreSnapshot, User, AggregationWindow } from '@/types/api';

// Determine aggregation window based on date range
// < 1 year: daily, 1-2 years: weekly, > 2 years: monthly
export function getAggregationWindow(startTime: Date, endTime: Date): AggregationWindow {
  const daysDiff = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60 * 24);

  if (daysDiff > 730) { // > 2 years
    return 'monthly';
  } else if (daysDiff > 365) { // 1-2 years
    return 'weekly';
  }
  return 'daily';
}

interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: ApiError | Error | null;
}

interface UseApiResult<T> extends UseApiState<T> {
  refetch: () => Promise<void>;
}

export function useSnapshots(userId: string | null): UseApiResult<HiscoreSnapshot[]> {
  const [state, setState] = useState<UseApiState<HiscoreSnapshot[]>>({
    data: null,
    loading: false,
    error: null,
  });

  const fetchData = useCallback(async () => {
    if (!userId) {
      setState({ data: null, loading: false, error: null });
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const snapshots = await apiClient.getAllSnapshotsForUser(userId);
      setState({ data: snapshots, loading: false, error: null });
    } catch (error) {
      setState({ data: null, loading: false, error: error as ApiError });
    }
  }, [userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { ...state, refetch: fetchData };
}

export function useSnapshotNearest(
  userId: string | null,
  timestamp: number | null
): UseApiResult<HiscoreSnapshot> {
  const [state, setState] = useState<UseApiState<HiscoreSnapshot>>({
    data: null,
    loading: false,
    error: null,
  });

  const fetchData = useCallback(async () => {
    if (!userId || !timestamp) {
      setState({ data: null, loading: false, error: null });
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const snapshot = await apiClient.getSnapshotNearestTimestamp(userId, timestamp);
      setState({ data: snapshot, loading: false, error: null });
    } catch (error) {
      setState({ data: null, loading: false, error: error as ApiError });
    }
  }, [userId, timestamp]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { ...state, refetch: fetchData };
}

interface SnapshotIntervalResult {
  data: HiscoreSnapshot[] | null;
  loading: boolean;
  error: ApiError | Error | null;
  refetch: () => Promise<void>;
  aggregationWindow: AggregationWindow | null;
  totalSnapshots: number;
  snapshotsWithGains: number;
}

export function useSnapshotInterval(
  userId: string | null,
  startTime: Date | null,
  endTime: Date | null
): SnapshotIntervalResult {
  const [state, setState] = useState<UseApiState<HiscoreSnapshot[]>>({
    data: null,
    loading: false,
    error: null,
  });
  const [totalSnapshots, setTotalSnapshots] = useState(0);
  const [snapshotsWithGains, setSnapshotsWithGains] = useState(0);

  // Calculate aggregation window based on date range
  const aggregationWindow = startTime && endTime ? getAggregationWindow(startTime, endTime) : null;

  const fetchData = useCallback(async () => {
    if (!userId || !startTime || !endTime) {
      setState({ data: null, loading: false, error: null });
      setTotalSnapshots(0);
      setSnapshotsWithGains(0);
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const window = getAggregationWindow(startTime, endTime);
      const response = await apiClient.getSnapshotInterval(userId, startTime, endTime, window);
      setState({ data: response.snapshots, loading: false, error: null });
      setTotalSnapshots(response.totalSnapshots);
      setSnapshotsWithGains(response.snapshotsWithGains);
    } catch (error) {
      setState({ data: null, loading: false, error: error as ApiError });
      setTotalSnapshots(0);
      setSnapshotsWithGains(0);
    }
  }, [userId, startTime, endTime]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { ...state, refetch: fetchData, aggregationWindow, totalSnapshots, snapshotsWithGains };
}

export function useYearlySnapshotData(userId: string | null): UseApiResult<HiscoreSnapshot[]> {
  const [state, setState] = useState<UseApiState<HiscoreSnapshot[]>>({
    data: null,
    loading: false,
    error: null,
  });

  const fetchData = useCallback(async () => {
    if (!userId) {
      setState({ data: null, loading: false, error: null });
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      // Get last year of data for heatmap
      const endDate = new Date();
      const startDate = new Date();
      startDate.setFullYear(startDate.getFullYear() - 1);
      
      const snapshots = await apiClient.getSnapshotInterval(userId, startDate, endDate);
      setState({ data: snapshots, loading: false, error: null });
    } catch (error) {
      setState({ data: null, loading: false, error: error as ApiError });
    }
  }, [userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { ...state, refetch: fetchData };
}

export function useAllUsers(): UseApiResult<User[]> {
  const [state, setState] = useState<UseApiState<User[]>>({
    data: null,
    loading: false,
    error: null,
  });

  const fetchData = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const users = await apiClient.getAllUsers();
      setState({ data: users, loading: false, error: null });
    } catch (error) {
      setState({ data: null, loading: false, error: error as ApiError });
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { ...state, refetch: fetchData };
}

export function useApiHealth() {
  const [isHealthy, setIsHealthy] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);

  const checkHealth = useCallback(async () => {
    setChecking(true);
    try {
      const healthy = await apiClient.healthCheck();
      setIsHealthy(healthy);
    } catch (error) {
      setIsHealthy(false);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();
    // Check health every 30 seconds
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  return { isHealthy, checking, checkHealth };
}