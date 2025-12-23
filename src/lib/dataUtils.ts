import type {
  HiscoreSnapshot,
  SkillSnapshot,
  BossSnapshot,
  ActivityType,
  HiscoreDelta
} from '@/types/api';

export interface SkillDataPoint {
  timestamp: string;
  level: number;
  experience: number;
  date: Date;
}

export interface BossDataPoint {
  timestamp: string;
  killCount: number;
  date: Date;
}

export interface OverallStatsDataPoint {
  timestamp: string;
  totalLevel: number;
  totalExperience: number;
  combatLevel: number;
  date: Date;
}

// Convert activity type string to human-readable name
export function formatActivityTypeName(activityType: string): string {
  return activityType
    .split('_')
    .map(word => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}

// Extract skill data for a specific skill from snapshots
export function extractSkillData(
  snapshots: HiscoreSnapshot[], 
  skillType: ActivityType
): SkillDataPoint[] {
  return snapshots
    .map(snapshot => {
      const skill = snapshot.skills.find(s => s.activityType === skillType);
      if (!skill) return null;
      
      return {
        timestamp: snapshot.timestamp,
        level: skill.level,
        experience: skill.experience,
        date: new Date(snapshot.timestamp),
      };
    })
    .filter((item): item is SkillDataPoint => item !== null)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

// Extract boss data for a specific boss from snapshots
export function extractBossData(
  snapshots: HiscoreSnapshot[], 
  bossType: ActivityType
): BossDataPoint[] {
  return snapshots
    .map(snapshot => {
      const boss = snapshot.bosses.find(b => b.activityType === bossType);
      if (!boss) return null;
      
      return {
        timestamp: snapshot.timestamp,
        killCount: boss.killCount,
        date: new Date(snapshot.timestamp),
      };
    })
    .filter((item): item is BossDataPoint => item !== null)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

// Calculate overall stats from snapshots
export function extractOverallData(snapshots: HiscoreSnapshot[]): OverallStatsDataPoint[] {
  return snapshots
    .map(snapshot => {
      const totalLevel = snapshot.skills
        .filter(skill => skill.activityType !== 'OVERALL')
        .reduce((sum, skill) => sum + skill.level, 0);
      
      const totalExperience = snapshot.skills
        .filter(skill => skill.activityType !== 'OVERALL')
        .reduce((sum, skill) => sum + skill.experience, 0);
      
      // Calculate combat level (simplified formula)
      const combatLevel = calculateCombatLevel(snapshot.skills);
      
      return {
        timestamp: snapshot.timestamp,
        totalLevel,
        totalExperience,
        combatLevel,
        date: new Date(snapshot.timestamp),
      };
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

// Calculate combat level from skills
function calculateCombatLevel(skills: SkillSnapshot[]): number {
  const getSkillLevel = (type: ActivityType) => 
    skills.find(s => s.activityType === type)?.level || 1;
  
  const attack = getSkillLevel('ATTACK');
  const strength = getSkillLevel('STRENGTH');
  const defence = getSkillLevel('DEFENCE');
  const hitpoints = getSkillLevel('HITPOINTS');
  const ranged = getSkillLevel('RANGED');
  const magic = getSkillLevel('MAGIC');
  const prayer = getSkillLevel('PRAYER');
  
  const base = 0.25 * (defence + hitpoints + Math.floor(prayer / 2));
  const melee = 0.325 * (attack + strength);
  const ranger = 0.325 * (Math.floor(ranged / 2) + ranged);
  const mage = 0.325 * (Math.floor(magic / 2) + magic);
  
  return Math.floor(base + Math.max(melee, ranger, mage));
}

// Get the latest snapshot data
export function getLatestSnapshot(snapshots: HiscoreSnapshot[]): HiscoreSnapshot | null {
  if (snapshots.length === 0) return null;
  
  return snapshots.reduce((latest, current) => {
    return new Date(current.timestamp) > new Date(latest.timestamp) ? current : latest;
  });
}

// Calculate gains between two snapshots
export function calculateGains(
  oldSnapshot: HiscoreSnapshot | null, 
  newSnapshot: HiscoreSnapshot | null
) {
  if (!oldSnapshot || !newSnapshot) return null;
  
  const skillGains = newSnapshot.skills.map(newSkill => {
    const oldSkill = oldSnapshot.skills.find(s => s.activityType === newSkill.activityType);
    if (!oldSkill) return null;
    
    return {
      activityType: newSkill.activityType,
      name: newSkill.name,
      levelGain: newSkill.level - oldSkill.level,
      experienceGain: newSkill.experience - oldSkill.experience,
    };
  }).filter(Boolean);
  
  const bossGains = newSnapshot.bosses.map(newBoss => {
    const oldBoss = oldSnapshot.bosses.find(b => b.activityType === newBoss.activityType);
    if (!oldBoss) return null;
    
    return {
      activityType: newBoss.activityType,
      name: newBoss.name,
      killCountGain: newBoss.killCount - oldBoss.killCount,
    };
  }).filter(Boolean);
  
  return { skillGains, bossGains };
}

// Format large numbers for display
export function formatNumber(num: number): string {
  if (num >= 1000000000) {
    const val = num / 1000000000;
    return (Number.isInteger(val) ? val.toString() : val.toFixed(1)) + 'B';
  }
  if (num >= 1000000) {
    const val = num / 1000000;
    return (Number.isInteger(val) ? val.toString() : val.toFixed(1)) + 'M';
  }
  if (num >= 1000) {
    const val = num / 1000;
    return (Number.isInteger(val) ? val.toString() : val.toFixed(1)) + 'K';
  }
  return Math.round(num).toString();
}

// Get skill by activity type
export function getSkillByType(snapshot: HiscoreSnapshot, activityType: ActivityType): SkillSnapshot | null {
  return snapshot.skills.find(skill => skill.activityType === activityType) || null;
}

// Get boss by activity type
export function getBossByType(snapshot: HiscoreSnapshot, activityType: ActivityType): BossSnapshot | null {
  return snapshot.bosses.find(boss => boss.activityType === activityType) || null;
}

// Calculate total gains from deltas
export interface DeltaGainsSummary {
  totalExperienceGain: number;
  skillGains: Map<ActivityType, { experienceGain: number; levelGain: number; name: string }>;
  bossGains: Map<ActivityType, { killCountGain: number; name: string }>;
  activityGains: Map<ActivityType, { scoreGain: number; name: string }>;
}

export function calculateGainsFromDeltas(deltas: HiscoreDelta[]): DeltaGainsSummary {
  const skillGains = new Map<ActivityType, { experienceGain: number; levelGain: number; name: string }>();
  const bossGains = new Map<ActivityType, { killCountGain: number; name: string }>();
  const activityGains = new Map<ActivityType, { scoreGain: number; name: string }>();
  let totalExperienceGain = 0;

  for (const delta of deltas) {
    // Process skill deltas
    if (delta.skills) {
      for (const skill of delta.skills) {
        // Use OVERALL skill for total experience gain
        if (skill.activityType === 'OVERALL') {
          totalExperienceGain += skill.experienceGain;
        }

        const existing = skillGains.get(skill.activityType);
        if (existing) {
          existing.experienceGain += skill.experienceGain;
          existing.levelGain += skill.levelGain;
        } else {
          skillGains.set(skill.activityType, {
            experienceGain: skill.experienceGain,
            levelGain: skill.levelGain,
            name: skill.name
          });
        }
      }
    }

    // Process boss deltas
    if (delta.bosses) {
      for (const boss of delta.bosses) {
        const existing = bossGains.get(boss.activityType);
        if (existing) {
          existing.killCountGain += boss.killCountGain;
        } else {
          bossGains.set(boss.activityType, {
            killCountGain: boss.killCountGain,
            name: boss.name
          });
        }
      }
    }

    // Process activity deltas
    if (delta.activities) {
      for (const activity of delta.activities) {
        const existing = activityGains.get(activity.activityType);
        if (existing) {
          existing.scoreGain += activity.scoreGain;
        } else {
          activityGains.set(activity.activityType, {
            scoreGain: activity.scoreGain,
            name: activity.name
          });
        }
      }
    }
  }

  return { totalExperienceGain, skillGains, bossGains, activityGains };
}

// Get gains for a specific activity from deltas
export function getActivityGainFromDeltas(
  deltas: HiscoreDelta[],
  activityType: ActivityType
): { totalGain: number; levelGain: number } {
  let totalGain = 0;
  let levelGain = 0;

  for (const delta of deltas) {
    // Check skills
    const skillDelta = delta.skills?.find(s => s.activityType === activityType);
    if (skillDelta) {
      totalGain += skillDelta.experienceGain;
      levelGain += skillDelta.levelGain;
      continue;
    }

    // Check bosses
    const bossDelta = delta.bosses?.find(b => b.activityType === activityType);
    if (bossDelta) {
      totalGain += bossDelta.killCountGain;
      continue;
    }

    // Check activities
    const activityDelta = delta.activities?.find(a => a.activityType === activityType);
    if (activityDelta) {
      totalGain += activityDelta.scoreGain;
    }
  }

  return { totalGain, levelGain };
}