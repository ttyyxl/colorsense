import { SEASON_KEYS, type SeasonKey } from "./vision-schema";

/**
 * 四张色卡的配色，每张卡提供四季对应的色块。
 * 用户把脸放进中间圆形区域，从四个色块里选出最衬肤色的一块。
 */
export interface ColorCard {
  id: string;
  name: string;
  colors: Record<SeasonKey, string>;
}

export const SEASON_LABELS: Record<SeasonKey, string> = {
  spring: "春季",
  summer: "夏季",
  autumn: "秋季",
  winter: "冬季",
};

export const COLOR_CARDS: ColorCard[] = [
  {
    id: "warm",
    name: "暖色系",
    colors: { spring: "#f66c79", summer: "#f1cacf", autumn: "#e68d7d", winter: "#d4668d" },
  },
  {
    id: "violet",
    name: "紫色系",
    colors: { spring: "#9b5bb9", summer: "#b1c2f0", autumn: "#c5a4c1", winter: "#4c3391" },
  },
  {
    id: "blue",
    name: "蓝色系",
    colors: { spring: "#96c6da", summer: "#d0ecf7", autumn: "#10638d", winter: "#1951a8" },
  },
  {
    id: "green",
    name: "绿色系",
    colors: { spring: "#9beec4", summer: "#55d0ce", autumn: "#b4d560", winter: "#143c46" },
  },
];

export interface ColorCardSelection {
  cardId: string;
  season: SeasonKey;
}

export interface ColorCardTestResult {
  seasons: SeasonKey[];
  selections: ColorCardSelection[];
  completedAt: string;
}

export function isSeasonKey(value: unknown): value is SeasonKey {
  return typeof value === "string" && (SEASON_KEYS as readonly string[]).includes(value);
}

/**
 * 统计每张色卡的选择，取得票最多的季型；并列时按四季顺序全部返回。
 */
export function summarizeColorCardSelections(selections: ColorCardSelection[]): SeasonKey[] {
  const counts = new Map<SeasonKey, number>();
  for (const selection of selections) {
    counts.set(selection.season, (counts.get(selection.season) ?? 0) + 1);
  }
  if (counts.size === 0) {
    return [];
  }
  const max = Math.max(...counts.values());
  return SEASON_KEYS.filter((season) => (counts.get(season) ?? 0) === max);
}

/** 生成结果文案，例如“春季型”或“春季、秋季型”。 */
export function describeColorCardSeasons(seasons: SeasonKey[]): string {
  if (seasons.length === 0) {
    return "";
  }
  return `${seasons.map((season) => SEASON_LABELS[season]).join("、")}型`;
}
