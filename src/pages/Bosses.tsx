import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BossKillChart } from '@/components/charts/BossKillChart';
import { UserSelector } from '@/components/UserSelector';
import { LoadingChart } from '@/components/ui/LoadingChart';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { useSnapshots } from '@/hooks/useApi';
import { BOSS_ACTIVITY_TYPES, type ActivityType } from '@/types/api';
import { 
  extractBossData, 
  formatActivityTypeName, 
  getLatestSnapshot, 
  getBossByType,
  formatNumber 
} from '@/lib/dataUtils';

export function Bosses() {
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedBoss, setSelectedBoss] = useState<ActivityType>('VORKATH');
  
  const { data: snapshots, loading, error, refetch } = useSnapshots(userId);

  const bossData = snapshots ? extractBossData(snapshots, selectedBoss) : [];
  const latestSnapshot = snapshots ? getLatestSnapshot(snapshots) : null;
  const currentBoss = latestSnapshot ? getBossByType(latestSnapshot, selectedBoss) : null;

  // Group bosses by category for better organization
  const raidBosses = BOSS_ACTIVITY_TYPES.filter(boss => 
    boss.includes('CHAMBERS') || boss.includes('THEATRE') || boss.includes('TOMBS')
  );
  
  const godWarsBosses = BOSS_ACTIVITY_TYPES.filter(boss => 
    ['COMMANDER_ZILYANA', 'GENERAL_GRAARDOR', 'KREEARRA', 'KRIL_TSUTSAROTH'].includes(boss)
  );

  const otherBosses = BOSS_ACTIVITY_TYPES.filter(boss => 
    !raidBosses.includes(boss) && !godWarsBosses.includes(boss)
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Bosses</h1>
        <p className="text-muted-foreground mt-2">
          Track your boss kill counts and progression
        </p>
      </div>

      <UserSelector userId={userId} onUserIdChange={setUserId} />

      {error && !loading && (
        <ErrorAlert error={error} onRetry={refetch} title="Failed to load boss data" />
      )}

      <div className="grid gap-6 lg:grid-cols-4">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Select Boss</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                <div>
                  <h4 className="text-sm font-medium mb-2">Raids</h4>
                  <div className="space-y-1">
                    {raidBosses.map((boss) => (
                      <Button
                        key={boss}
                        variant={selectedBoss === boss ? 'default' : 'ghost'}
                        className="w-full justify-start text-xs"
                        onClick={() => setSelectedBoss(boss)}
                      >
                        {formatActivityTypeName(boss)}
                      </Button>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium mb-2">God Wars</h4>
                  <div className="space-y-1">
                    {godWarsBosses.map((boss) => (
                      <Button
                        key={boss}
                        variant={selectedBoss === boss ? 'default' : 'ghost'}
                        className="w-full justify-start text-xs"
                        onClick={() => setSelectedBoss(boss)}
                      >
                        {formatActivityTypeName(boss)}
                      </Button>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium mb-2">Other Bosses</h4>
                  <div className="space-y-1">
                    {otherBosses.slice(0, 15).map((boss) => (
                      <Button
                        key={boss}
                        variant={selectedBoss === boss ? 'default' : 'ghost'}
                        className="w-full justify-start text-xs"
                        onClick={() => setSelectedBoss(boss)}
                      >
                        {formatActivityTypeName(boss)}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3 space-y-6">
          {loading ? (
            <LoadingChart title={`${formatActivityTypeName(selectedBoss)} Kill Count`} />
          ) : bossData.length > 0 ? (
            <BossKillChart
              bossName={formatActivityTypeName(selectedBoss)}
              data={bossData}
            />
          ) : userId ? (
            <Card>
              <CardHeader>
                <CardTitle>{formatActivityTypeName(selectedBoss)} Kill Count</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  No data available for this boss. Make sure snapshots exist for this user.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>{formatActivityTypeName(selectedBoss)} Kill Count</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Select a user to view boss kill count data.
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>{formatActivityTypeName(selectedBoss)} Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              {currentBoss ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm font-medium">Total Kills</p>
                    <p className="text-2xl font-bold">{formatNumber(currentBoss.killCount)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Rank</p>
                    <p className="text-2xl font-bold">#{currentBoss.rank.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Progress</p>
                    <p className="text-2xl font-bold">
                      {bossData.length > 1 
                        ? `+${bossData[bossData.length - 1].killCount - bossData[0].killCount}`
                        : 'N/A'
                      }
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">
                  {userId ? 'No data available for this boss.' : 'Select a user to view statistics.'}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}