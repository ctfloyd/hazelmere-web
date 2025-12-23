export type ActivityType = 
  | "UNKNOWN"
  | "OVERALL"
  | "ATTACK"
  | "DEFENCE"
  | "STRENGTH"
  | "HITPOINTS"
  | "RANGED"
  | "PRAYER"
  | "MAGIC"
  | "COOKING"
  | "WOODCUTTING"
  | "FLETCHING"
  | "FISHING"
  | "FIREMAKING"
  | "CRAFTING"
  | "SMITHING"
  | "MINING"
  | "HERBLORE"
  | "AGILITY"
  | "THIEVING"
  | "SLAYER"
  | "FARMING"
  | "RUNECRAFT"
  | "HUNTER"
  | "CONSTRUCTION"
  | "SAILING"
  | "GRID_POINTS"
  | "LEAGUE_POINTS"
  | "DEADMAN_POINTS"
  | "BOUNTY_HUNTER__HUNTER"
  | "BOUNTY_HUNTER__ROGUE"
  | "BOUNTY_HUNTER_LEGACY__HUNTER"
  | "BOUNTY_HUNTER_LEGACY__ROGUE"
  | "CLUE_SCROLLS_ALL"
  | "CLUE_SCROLLS_BEGINNER"
  | "CLUE_SCROLLS_EASY"
  | "CLUE_SCROLLS_MEDIUM"
  | "CLUE_SCROLLS_HARD"
  | "CLUE_SCROLLS_ELITE"
  | "CLUE_SCROLLS_MASTER"
  | "LMS__RANK"
  | "PVP_ARENA__RANK"
  | "SOUL_WARS_ZEAL"
  | "RIFTS_CLOSED"
  | "COLOSSEUM_GLORY"
  | "COLLECTIONS_LOGGED"
  // Boss types
  | "ABYSSAL_SIRE"
  | "ALCHEMICAL_HYDRA"
  | "AMOXLIATL"
  | "ARAXXOR"
  | "ARTIO"
  | "BARROWS_CHESTS"
  | "BRYOPHYTA"
  | "CALLISTO"
  | "CALVARION"
  | "CERBERUS"
  | "CHAMBERS_OF_XERIC"
  | "CHAMBERS_OF_XERIC_CHALLENGE_MODE"
  | "CHAOS_ELEMENTAL"
  | "CHAOS_FANATIC"
  | "COMMANDER_ZILYANA"
  | "CORPOREAL_BEAST"
  | "CRAZY_ARCHAEOLOGIST"
  | "DAGANNOTH_PRIME"
  | "DAGANNOTH_REX"
  | "DAGANNOTH_SUPREME"
  | "DERANGED_ARCHAEOLOGIST"
  | "DOOM_OF_MOKHAIOTL"
  | "DUKE_SUCELLUS"
  | "GENERAL_GRAARDOR"
  | "GIANT_MOLE"
  | "GROTESQUE_GUARDIANS"
  | "HESPORI"
  | "KALPHITE_QUEEN"
  | "KING_BLACK_DRAGON"
  | "KRAKEN"
  | "KREEARRA"
  | "KRIL_TSUTSAROTH"
  | "LUNAR_CHESTS"
  | "MIMIC"
  | "NEX"
  | "NIGHTMARE"
  | "PHOSANIS_NIGHTMARE"
  | "OBOR"
  | "PHANTOM_MUSPAH"
  | "SARACHNIS"
  | "SCORPIA"
  | "SCURRIUS"
  | "SHELLBANE_GRYPHON"
  | "SKOTIZO"
  | "SOL_HEREDIT"
  | "SPINDEL"
  | "TEMPOROSS"
  | "THE_GAUNTLET"
  | "THE_CORRUPTED_GAUNTLET"
  | "THE_HUEYCOATL"
  | "THE_LEVIATHAN"
  | "THE_ROYAL_TITANS"
  | "THE_WHISPERER"
  | "THEATRE_OF_BLOOD"
  | "THEATRE_OF_BLOOD_HARD_MODE"
  | "THERMONUCLEAR_SMOKE_DEVIL"
  | "TOMBS_OF_AMASCUT"
  | "TOMBS_OF_AMASCUT_EXPERT_MODE"
  | "TZKALZUK"
  | "TZTOKJAD"
  | "VARDORVIS"
  | "VENENATIS"
  | "VETION"
  | "VORKATH"
  | "WINTERTODT"
  | "YAMA"
  | "ZALCANO"
  | "ZULRAH";

export interface SkillSnapshot {
  activityType: ActivityType;
  name: string;
  level: number;
  experience: number;
  rank: number;
}

export interface BossSnapshot {
  activityType: ActivityType;
  name: string;
  killCount: number;
  rank: number;
}

export interface ActivitySnapshot {
  activityType: ActivityType;
  name: string;
  score: number;
  rank: number;
}

export interface HiscoreSnapshot {
  id: string;
  userId: string;
  timestamp: string; // ISO string
  skills: SkillSnapshot[];
  bosses: BossSnapshot[];
  activities: ActivitySnapshot[];
}

export interface CreateSnapshotRequest {
  snapshot: HiscoreSnapshot;
}

export interface CreateSnapshotResponse {
  snapshot: HiscoreSnapshot;
}

export interface GetSnapshotNearestTimestampResponse {
  snapshot: HiscoreSnapshot;
}

export interface GetAllSnapshotsForUserResponse {
  snapshots: HiscoreSnapshot[];
}

export type AggregationWindow = 'daily' | 'weekly' | 'monthly';

export interface GetSnapshotIntervalRequest {
  userId: string;
  startTime: string; // ISO string
  endTime: string; // ISO string
  aggregationWindow?: AggregationWindow;
}

export interface GetSnapshotIntervalResponse {
  snapshots: HiscoreSnapshot[];
  totalSnapshots: number;
  snapshotsWithGains: number;
}

export type AccountType = 
  | "NORMAL"
  | "IRONMAN"
  | "HARDCORE_IRONMAN"
  | "GROUP_IRONMAN"
  | "ULTIMATE_IRONMAN";

export type TrackingStatus = "ENABLED" | "DISABLED";

export interface User {
  id: string;
  runescapeName: string;
  trackingStatus: TrackingStatus;
  accountType: AccountType;
}

export interface GetAllUsersResponse {
  users: User[];
}

// Categorized activity types for easier filtering
export const SKILL_ACTIVITY_TYPES: ActivityType[] = [
  "OVERALL",
  "ATTACK",
  "DEFENCE", 
  "STRENGTH",
  "HITPOINTS",
  "RANGED",
  "PRAYER",
  "MAGIC",
  "COOKING",
  "WOODCUTTING",
  "FLETCHING",
  "FISHING",
  "FIREMAKING",
  "CRAFTING",
  "SMITHING",
  "MINING",
  "HERBLORE",
  "AGILITY",
  "THIEVING",
  "SLAYER",
  "FARMING",
  "RUNECRAFT",
  "HUNTER",
  "CONSTRUCTION",
  "SAILING"
];

export const BOSS_ACTIVITY_TYPES: ActivityType[] = [
  "ABYSSAL_SIRE",
  "ALCHEMICAL_HYDRA",
  "AMOXLIATL",
  "ARAXXOR",
  "ARTIO",
  "BARROWS_CHESTS",
  "BRYOPHYTA",
  "CALLISTO",
  "CALVARION",
  "CERBERUS",
  "CHAMBERS_OF_XERIC",
  "CHAMBERS_OF_XERIC_CHALLENGE_MODE",
  "CHAOS_ELEMENTAL",
  "CHAOS_FANATIC",
  "COMMANDER_ZILYANA",
  "CORPOREAL_BEAST",
  "CRAZY_ARCHAEOLOGIST",
  "DAGANNOTH_PRIME",
  "DAGANNOTH_REX",
  "DAGANNOTH_SUPREME",
  "DERANGED_ARCHAEOLOGIST",
  "DOOM_OF_MOKHAIOTL",
  "DUKE_SUCELLUS",
  "GENERAL_GRAARDOR",
  "GIANT_MOLE",
  "GROTESQUE_GUARDIANS",
  "HESPORI",
  "KALPHITE_QUEEN",
  "KING_BLACK_DRAGON",
  "KRAKEN",
  "KREEARRA",
  "KRIL_TSUTSAROTH",
  "LUNAR_CHESTS",
  "MIMIC",
  "NEX",
  "NIGHTMARE",
  "PHOSANIS_NIGHTMARE",
  "OBOR",
  "PHANTOM_MUSPAH",
  "SARACHNIS",
  "SCORPIA",
  "SCURRIUS",
  "SHELLBANE_GRYPHON",
  "SKOTIZO",
  "SOL_HEREDIT",
  "SPINDEL",
  "TEMPOROSS",
  "THE_GAUNTLET",
  "THE_CORRUPTED_GAUNTLET",
  "THE_HUEYCOATL",
  "THE_LEVIATHAN",
  "THE_ROYAL_TITANS",
  "THE_WHISPERER",
  "THEATRE_OF_BLOOD",
  "THEATRE_OF_BLOOD_HARD_MODE",
  "THERMONUCLEAR_SMOKE_DEVIL",
  "TOMBS_OF_AMASCUT",
  "TOMBS_OF_AMASCUT_EXPERT_MODE",
  "TZKALZUK",
  "TZTOKJAD",
  "VARDORVIS",
  "VENENATIS",
  "VETION",
  "VORKATH",
  "WINTERTODT",
  "YAMA",
  "ZALCANO",
  "ZULRAH"
];

export const ACTIVITY_ACTIVITY_TYPES: ActivityType[] = [
  "GRID_POINTS",
  "LEAGUE_POINTS",
  "DEADMAN_POINTS",
  "BOUNTY_HUNTER__HUNTER",
  "BOUNTY_HUNTER__ROGUE",
  "BOUNTY_HUNTER_LEGACY__HUNTER",
  "BOUNTY_HUNTER_LEGACY__ROGUE",
  "CLUE_SCROLLS_ALL",
  "CLUE_SCROLLS_BEGINNER",
  "CLUE_SCROLLS_EASY",
  "CLUE_SCROLLS_MEDIUM",
  "CLUE_SCROLLS_HARD",
  "CLUE_SCROLLS_ELITE",
  "CLUE_SCROLLS_MASTER",
  "LMS__RANK",
  "PVP_ARENA__RANK",
  "SOUL_WARS_ZEAL",
  "RIFTS_CLOSED",
  "COLOSSEUM_GLORY",
  "COLLECTIONS_LOGGED"
];

// Delta types - represent changes between snapshots
export interface SkillDelta {
  activityType: ActivityType;
  name: string;
  experienceGain: number;
  levelGain: number;
}

export interface BossDelta {
  activityType: ActivityType;
  name: string;
  killCountGain: number;
}

export interface ActivityDelta {
  activityType: ActivityType;
  name: string;
  scoreGain: number;
}

export interface HiscoreDelta {
  id: string;
  userId: string;
  snapshotId: string;
  previousSnapshotId: string;
  timestamp: string; // ISO string
  skills?: SkillDelta[];
  bosses?: BossDelta[];
  activities?: ActivityDelta[];
}

export interface GetLatestDeltaResponse {
  delta: HiscoreDelta;
}

export interface GetDeltaIntervalRequest {
  userId: string;
  startTime: string; // ISO string
  endTime: string; // ISO string
}

export interface GetDeltaIntervalResponse {
  deltas: HiscoreDelta[];
  totalDeltas: number;
}

export interface GetDeltaSummaryRequest {
  userId: string;
  startTime: string; // ISO string
  endTime: string; // ISO string
}

export interface SkillDeltaSummary {
  activityType: ActivityType;
  name: string;
  totalExperienceGain: number;
  totalLevelGain: number;
}

export interface BossDeltaSummary {
  activityType: ActivityType;
  name: string;
  totalKillCountGain: number;
}

export interface ActivityDeltaSummary {
  activityType: ActivityType;
  name: string;
  totalScoreGain: number;
}

export interface GetDeltaSummaryResponse {
  userId: string;
  startTime: string; // ISO string
  endTime: string; // ISO string
  totalExperienceGain: number;
  skills: SkillDeltaSummary[];
  bosses: BossDeltaSummary[];
  activities: ActivityDeltaSummary[];
  deltaCount: number;
}

export interface GetSnapshotWithDeltasRequest {
  userId: string;
  startTime: string; // ISO string
  endTime: string; // ISO string
}

export interface GetSnapshotWithDeltasResponse {
  snapshot: HiscoreSnapshot;
  deltas: HiscoreDelta[];
}

