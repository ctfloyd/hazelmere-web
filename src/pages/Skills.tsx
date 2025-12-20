import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SkillProgressChart } from '@/components/charts/SkillProgressChart';
import { UserSelector } from '@/components/UserSelector';
import { LoadingChart } from '@/components/ui/LoadingChart';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { useSnapshots } from '@/hooks/useApi';
import { SKILL_ACTIVITY_TYPES, type ActivityType } from '@/types/api';
import { 
  extractSkillData, 
  formatActivityTypeName, 
  getLatestSnapshot, 
  getSkillByType,
  formatNumber 
} from '@/lib/dataUtils';

export function Skills() {
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<ActivityType>('SLAYER');
  const [metric, setMetric] = useState<'level' | 'experience'>('experience');
  
  const { data: snapshots, loading, error, refetch } = useSnapshots(userId);

  const skillData = snapshots ? extractSkillData(snapshots, selectedSkill) : [];
  const latestSnapshot = snapshots ? getLatestSnapshot(snapshots) : null;
  const currentSkill = latestSnapshot ? getSkillByType(latestSnapshot, selectedSkill) : null;

  const calculateXpToNextLevel = (level: number, experience: number): number => {
    if (level >= 99) return 0;
    // Simplified XP table calculation - you might want to use the actual OSRS XP table
    const nextLevelXp = Math.floor(level * level * 75 + level * 25);
    return Math.max(0, nextLevelXp - experience);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Skills</h1>
        <p className="text-muted-foreground mt-2">
          Track your skill progression over time
        </p>
      </div>

      <UserSelector userId={userId} onUserIdChange={setUserId} />

      {error && !loading && (
        <ErrorAlert error={error} onRetry={refetch} title="Failed to load skill data" />
      )}

      <div className="grid gap-6 lg:grid-cols-4">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Select Skill</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {SKILL_ACTIVITY_TYPES.map((skill) => (
                  <Button
                    key={skill}
                    variant={selectedSkill === skill ? 'default' : 'ghost'}
                    className="w-full justify-start"
                    onClick={() => setSelectedSkill(skill)}
                  >
                    {formatActivityTypeName(skill)}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3 space-y-6">
          <div className="flex gap-2">
            <Button
              variant={metric === 'experience' ? 'default' : 'outline'}
              onClick={() => setMetric('experience')}
            >
              Experience
            </Button>
            <Button
              variant={metric === 'level' ? 'default' : 'outline'}
              onClick={() => setMetric('level')}
            >
              Level
            </Button>
          </div>

          {loading ? (
            <LoadingChart title={`${formatActivityTypeName(selectedSkill)} Progress`} />
          ) : skillData.length > 0 ? (
            <SkillProgressChart
              skillName={formatActivityTypeName(selectedSkill)}
              data={skillData}
              metric={metric}
            />
          ) : userId ? (
            <Card>
              <CardHeader>
                <CardTitle>{formatActivityTypeName(selectedSkill)} Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  No data available for this skill. Make sure snapshots exist for this user.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>{formatActivityTypeName(selectedSkill)} Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Select a user to view skill progression data.
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>{formatActivityTypeName(selectedSkill)} Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              {currentSkill ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm font-medium">Current Level</p>
                    <p className="text-2xl font-bold">{currentSkill.level}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Current XP</p>
                    <p className="text-2xl font-bold">{formatNumber(currentSkill.experience)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">XP to {currentSkill.level + 1}</p>
                    <p className="text-2xl font-bold">
                      {currentSkill.level >= 99 
                        ? 'Max!' 
                        : formatNumber(calculateXpToNextLevel(currentSkill.level, currentSkill.experience))
                      }
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Current Rank</p>
                    <p className="text-2xl font-bold">#{currentSkill.rank.toLocaleString()}</p>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">
                  {userId ? 'No data available for this skill.' : 'Select a user to view statistics.'}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}