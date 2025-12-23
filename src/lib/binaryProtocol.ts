import type {
  ActivityType,
  HiscoreSnapshot,
  HiscoreDelta,
  SkillSnapshot,
  BossSnapshot,
  ActivitySnapshot,
  SkillDelta,
  BossDelta,
  ActivityDelta,
  GetSnapshotWithDeltasResponse
} from '@/types/api';

// Activity type index to ActivityType mapping
// Range 0-25: Skills, 26-45: Activities, 46-113: Bosses
const ACTIVITY_TYPE_INDEX_MAP: ActivityType[] = [
  // Skills (0-25)
  'UNKNOWN',        // 0
  'OVERALL',        // 1
  'ATTACK',         // 2
  'DEFENCE',        // 3
  'STRENGTH',       // 4
  'HITPOINTS',      // 5
  'RANGED',         // 6
  'PRAYER',         // 7
  'MAGIC',          // 8
  'COOKING',        // 9
  'WOODCUTTING',    // 10
  'FLETCHING',      // 11
  'FISHING',        // 12
  'FIREMAKING',     // 13
  'CRAFTING',       // 14
  'SMITHING',       // 15
  'MINING',         // 16
  'HERBLORE',       // 17
  'AGILITY',        // 18
  'THIEVING',       // 19
  'SLAYER',         // 20
  'FARMING',        // 21
  'RUNECRAFT',      // 22
  'HUNTER',         // 23
  'CONSTRUCTION',   // 24
  'SAILING',        // 25

  // Activities (26-45)
  'LEAGUE_POINTS',            // 26
  'DEADMAN_POINTS',           // 27
  'BOUNTY_HUNTER__HUNTER',    // 28
  'BOUNTY_HUNTER__ROGUE',     // 29
  'BOUNTY_HUNTER_LEGACY__HUNTER', // 30
  'BOUNTY_HUNTER_LEGACY__ROGUE',  // 31
  'CLUE_SCROLLS_ALL',         // 32
  'CLUE_SCROLLS_BEGINNER',    // 33
  'CLUE_SCROLLS_EASY',        // 34
  'CLUE_SCROLLS_MEDIUM',      // 35
  'CLUE_SCROLLS_HARD',        // 36
  'CLUE_SCROLLS_ELITE',       // 37
  'CLUE_SCROLLS_MASTER',      // 38
  'GRID_POINTS',              // 39
  'LMS__RANK',                // 40
  'PVP_ARENA__RANK',          // 41
  'SOUL_WARS_ZEAL',           // 42
  'RIFTS_CLOSED',             // 43
  'COLOSSEUM_GLORY',          // 44
  'COLLECTIONS_LOGGED',       // 45

  // Bosses (46-113)
  'ABYSSAL_SIRE',             // 46
  'ALCHEMICAL_HYDRA',         // 47
  'AMOXLIATL',                // 48
  'ARAXXOR',                  // 49
  'ARTIO',                    // 50
  'BARROWS_CHESTS',           // 51
  'BRYOPHYTA',                // 52
  'CALLISTO',                 // 53
  'CALVARION',                // 54
  'CERBERUS',                 // 55
  'CHAMBERS_OF_XERIC',        // 56
  'CHAMBERS_OF_XERIC_CHALLENGE_MODE', // 57
  'CHAOS_ELEMENTAL',          // 58
  'CHAOS_FANATIC',            // 59
  'COMMANDER_ZILYANA',        // 60
  'CORPOREAL_BEAST',          // 61
  'CRAZY_ARCHAEOLOGIST',      // 62
  'DAGANNOTH_PRIME',          // 63
  'DAGANNOTH_REX',            // 64
  'DAGANNOTH_SUPREME',        // 65
  'DERANGED_ARCHAEOLOGIST',   // 66
  'DOOM_OF_MOKHAIOTL',        // 67
  'DUKE_SUCELLUS',            // 68
  'GENERAL_GRAARDOR',         // 69
  'GIANT_MOLE',               // 70
  'GROTESQUE_GUARDIANS',      // 71
  'HESPORI',                  // 72
  'KALPHITE_QUEEN',           // 73
  'KING_BLACK_DRAGON',        // 74
  'KRAKEN',                   // 75
  'KREEARRA',                 // 76
  'KRIL_TSUTSAROTH',          // 77
  'LUNAR_CHESTS',             // 78
  'MIMIC',                    // 79
  'NEX',                      // 80
  'NIGHTMARE',                // 81
  'PHOSANIS_NIGHTMARE',       // 82
  'OBOR',                     // 83
  'PHANTOM_MUSPAH',           // 84
  'SARACHNIS',                // 85
  'SCORPIA',                  // 86
  'SCURRIUS',                 // 87
  'SHELLBANE_GRYPHON',        // 88
  'SKOTIZO',                  // 89
  'SOL_HEREDIT',              // 90
  'SPINDEL',                  // 91
  'TEMPOROSS',                // 92
  'THE_GAUNTLET',             // 93
  'THE_CORRUPTED_GAUNTLET',   // 94
  'THE_HUEYCOATL',            // 95
  'THE_LEVIATHAN',            // 96
  'THE_ROYAL_TITANS',         // 97
  'THE_WHISPERER',            // 98
  'THEATRE_OF_BLOOD',         // 99
  'THEATRE_OF_BLOOD_HARD_MODE', // 100
  'THERMONUCLEAR_SMOKE_DEVIL', // 101
  'TOMBS_OF_AMASCUT',         // 102
  'TOMBS_OF_AMASCUT_EXPERT_MODE', // 103
  'TZKALZUK',                 // 104
  'TZTOKJAD',                 // 105
  'VARDORVIS',                // 106
  'VENENATIS',                // 107
  'VETION',                   // 108
  'VORKATH',                  // 109
  'WINTERTODT',               // 110
  'YAMA',                     // 111
  'ZALCANO',                  // 112
  'ZULRAH',                   // 113
];

// Get activity name from activity type
function getActivityName(activityType: ActivityType): string {
  return activityType
    .split('_')
    .map(word => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}

// Binary reader helper class
class BinaryReader {
  private view: DataView;
  private offset: number = 0;

  constructor(buffer: ArrayBuffer) {
    this.view = new DataView(buffer);
  }

  readUint8(): number {
    const value = this.view.getUint8(this.offset);
    this.offset += 1;
    return value;
  }

  readInt16(): number {
    const value = this.view.getInt16(this.offset, false); // big-endian
    this.offset += 2;
    return value;
  }

  readInt32(): number {
    const value = this.view.getInt32(this.offset, false); // big-endian
    this.offset += 4;
    return value;
  }

  readUint16(): number {
    const value = this.view.getUint16(this.offset, false); // big-endian
    this.offset += 2;
    return value;
  }

  readInt64(): bigint {
    const value = this.view.getBigInt64(this.offset, false); // big-endian
    this.offset += 8;
    return value;
  }

  getOffset(): number {
    return this.offset;
  }
}

export function decodeBinaryDeltaResponse(
  buffer: ArrayBuffer,
  userId: string
): GetSnapshotWithDeltasResponse {
  const reader = new BinaryReader(buffer);

  // Header (2 bytes)
  const version = reader.readUint8();
  reader.readUint8(); // flags - reserved for future use

  if (version !== 1) {
    throw new Error(`Unsupported binary protocol version: ${version}`);
  }

  // Snapshot
  const snapshotTimestamp = Number(reader.readInt64());

  // Skills
  const skillCount = reader.readUint8();
  const skills: SkillSnapshot[] = [];
  for (let i = 0; i < skillCount; i++) {
    const activityTypeIndex = reader.readUint8();
    const experience = reader.readInt32();
    const level = reader.readInt16();

    const activityType = ACTIVITY_TYPE_INDEX_MAP[activityTypeIndex] || 'UNKNOWN';
    skills.push({
      activityType,
      name: getActivityName(activityType),
      experience,
      level,
      rank: 0 // Not included in binary protocol
    });
  }

  // Bosses
  const bossCount = reader.readUint8();
  const bosses: BossSnapshot[] = [];
  for (let i = 0; i < bossCount; i++) {
    const activityTypeIndex = reader.readUint8();
    const killCount = reader.readInt32();

    const activityType = ACTIVITY_TYPE_INDEX_MAP[activityTypeIndex] || 'UNKNOWN';
    bosses.push({
      activityType,
      name: getActivityName(activityType),
      killCount,
      rank: 0 // Not included in binary protocol
    });
  }

  // Activities
  const activityCount = reader.readUint8();
  const activities: ActivitySnapshot[] = [];
  for (let i = 0; i < activityCount; i++) {
    const activityTypeIndex = reader.readUint8();
    const score = reader.readInt32();

    const activityType = ACTIVITY_TYPE_INDEX_MAP[activityTypeIndex] || 'UNKNOWN';
    activities.push({
      activityType,
      name: getActivityName(activityType),
      score,
      rank: 0 // Not included in binary protocol
    });
  }

  const snapshot: HiscoreSnapshot = {
    id: '', // Not included in binary protocol
    userId,
    timestamp: new Date(snapshotTimestamp).toISOString(),
    skills,
    bosses,
    activities
  };

  // Deltas
  const deltaCount = reader.readUint16();
  const deltas: HiscoreDelta[] = [];

  for (let d = 0; d < deltaCount; d++) {
    const deltaTimestamp = Number(reader.readInt64());

    // Skill deltas
    const skillDeltaCount = reader.readUint8();
    const skillDeltas: SkillDelta[] = [];
    for (let i = 0; i < skillDeltaCount; i++) {
      const activityTypeIndex = reader.readUint8();
      const xpGain = reader.readInt32();
      const levelGain = reader.readInt16();

      const activityType = ACTIVITY_TYPE_INDEX_MAP[activityTypeIndex] || 'UNKNOWN';
      skillDeltas.push({
        activityType,
        name: getActivityName(activityType),
        experienceGain: xpGain,
        levelGain
      });
    }

    // Boss deltas
    const bossDeltaCount = reader.readUint8();
    const bossDeltas: BossDelta[] = [];
    for (let i = 0; i < bossDeltaCount; i++) {
      const activityTypeIndex = reader.readUint8();
      const kcGain = reader.readInt32();

      const activityType = ACTIVITY_TYPE_INDEX_MAP[activityTypeIndex] || 'UNKNOWN';
      bossDeltas.push({
        activityType,
        name: getActivityName(activityType),
        killCountGain: kcGain
      });
    }

    // Activity deltas
    const activityDeltaCount = reader.readUint8();
    const activityDeltas: ActivityDelta[] = [];
    for (let i = 0; i < activityDeltaCount; i++) {
      const activityTypeIndex = reader.readUint8();
      const scoreGain = reader.readInt32();

      const activityType = ACTIVITY_TYPE_INDEX_MAP[activityTypeIndex] || 'UNKNOWN';
      activityDeltas.push({
        activityType,
        name: getActivityName(activityType),
        scoreGain
      });
    }

    deltas.push({
      id: '', // Not included in binary protocol
      userId,
      snapshotId: '', // Not included in binary protocol
      previousSnapshotId: '', // Not included in binary protocol
      timestamp: new Date(deltaTimestamp).toISOString(),
      skills: skillDeltas.length > 0 ? skillDeltas : undefined,
      bosses: bossDeltas.length > 0 ? bossDeltas : undefined,
      activities: activityDeltas.length > 0 ? activityDeltas : undefined
    });
  }

  return { snapshot, deltas };
}
