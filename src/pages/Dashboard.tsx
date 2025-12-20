import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UserSelector } from '@/components/UserSelector';
import { ApiStatus } from '@/components/ApiStatus';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { Skeleton } from '@/components/ui/skeleton';
import { OverallStatsChart } from '@/components/charts/OverallStatsChart';
import { useSnapshots, useApiHealth } from '@/hooks/useApi';
import { 
  extractOverallData, 
  getLatestSnapshot, 
  formatNumber,
  formatActivityTypeName 
} from '@/lib/dataUtils';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

export function Dashboard() {
  const [userId, setUserId] = useState<string | null>(null);
  const { data: snapshots, loading, error, refetch } = useSnapshots(userId);
  const { isHealthy, checking } = useApiHealth();
  
  const overallData = snapshots ? extractOverallData(snapshots) : [];
  const latestSnapshot = snapshots ? getLatestSnapshot(snapshots) : null;

  // Calculate total boss kill counts
  const totalBossKills = latestSnapshot 
    ? latestSnapshot.bosses.reduce((sum, boss) => sum + boss.killCount, 0)
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground mt-2">
              Overview of your RuneScape progress
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm">
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
        </div>
      </div>

      <ApiStatus />
      
      <UserSelector userId={userId} onUserIdChange={setUserId} />

      {error && !loading && (
        <ErrorAlert error={error} onRetry={refetch} title="Failed to load dashboard data" />
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Level</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-20" />
            ) : latestSnapshot ? (
              <div className="text-2xl font-bold">
                {latestSnapshot.skills
                  .filter(skill => skill.activityType !== 'OVERALL')
                  .reduce((sum, skill) => sum + skill.level, 0)
                  .toLocaleString()}
              </div>
            ) : (
              <div className="text-2xl font-bold text-muted-foreground">--</div>
            )}
            <p className="text-xs text-muted-foreground">
              {overallData.length > 1 
                ? `+${overallData[overallData.length - 1].totalLevel - overallData[0].totalLevel} from first snapshot`
                : 'Select a user to view data'
              }
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Combat Level</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-20" />
            ) : overallData.length > 0 ? (
              <div className="text-2xl font-bold">
                {overallData[overallData.length - 1].combatLevel}
              </div>
            ) : (
              <div className="text-2xl font-bold text-muted-foreground">--</div>
            )}
            <p className="text-xs text-muted-foreground">
              {overallData.length > 1 
                ? `+${overallData[overallData.length - 1].combatLevel - overallData[0].combatLevel} from first snapshot`
                : 'Select a user to view data'
              }
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total XP</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-20" />
            ) : latestSnapshot ? (
              <div className="text-2xl font-bold">
                {formatNumber(latestSnapshot.skills
                  .filter(skill => skill.activityType !== 'OVERALL')
                  .reduce((sum, skill) => sum + skill.experience, 0)
                )}
              </div>
            ) : (
              <div className="text-2xl font-bold text-muted-foreground">--</div>
            )}
            <p className="text-xs text-muted-foreground">
              {overallData.length > 1 
                ? `+${formatNumber(overallData[overallData.length - 1].totalExperience - overallData[0].totalExperience)} from first snapshot`
                : 'Select a user to view data'
              }
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Boss KCs</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-20" />
            ) : latestSnapshot ? (
              <div className="text-2xl font-bold">{formatNumber(totalBossKills)}</div>
            ) : (
              <div className="text-2xl font-bold text-muted-foreground">--</div>
            )}
            <p className="text-xs text-muted-foreground">
              {snapshots && snapshots.length > 1 
                ? `+${totalBossKills - snapshots[0].bosses.reduce((sum, boss) => sum + boss.killCount, 0)} from first snapshot`
                : 'Select a user to view data'
              }
            </p>
          </CardContent>
        </Card>
      </div>

      {overallData.length > 0 && (
        <div className="mt-6">
          <OverallStatsChart data={overallData} />
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Snapshot History</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ) : snapshots && snapshots.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Total Snapshots</span>
                  <span className="text-sm font-medium">{snapshots.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Latest Snapshot</span>
                  <span className="text-xs text-muted-foreground">
                    {latestSnapshot 
                      ? new Date(latestSnapshot.timestamp).toLocaleDateString()
                      : 'N/A'
                    }
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">First Snapshot</span>
                  <span className="text-xs text-muted-foreground">
                    {snapshots[0] 
                      ? new Date(snapshots[0].timestamp).toLocaleDateString()
                      : 'N/A'
                    }
                  </span>
                </div>
              </div>
            ) : userId ? (
              <p className="text-muted-foreground">No snapshots found for this user.</p>
            ) : (
              <p className="text-muted-foreground">Select a user to view snapshot history.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Skills</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ) : latestSnapshot ? (
              <div className="space-y-2">
                {latestSnapshot.skills
                  .filter(skill => skill.activityType !== 'OVERALL')
                  .sort((a, b) => b.level - a.level)
                  .slice(0, 3)
                  .map((skill) => (
                    <div key={skill.activityType} className="flex items-center justify-between">
                      <span className="text-sm">{formatActivityTypeName(skill.activityType)}</span>
                      <span className="text-sm font-medium">
                        Level {skill.level} ({formatNumber(skill.experience)} XP)
                      </span>
                    </div>
                  ))}
              </div>
            ) : userId ? (
              <p className="text-muted-foreground">No skill data available.</p>
            ) : (
              <p className="text-muted-foreground">Select a user to view top skills.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}