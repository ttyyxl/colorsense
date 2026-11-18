import type {
  OutfitHistoryRecord,
  OutfitHistorySummary,
  OutfitInspirationRequest,
  OutfitInspirationResult,
} from "@/lib/outfit-types";
import { byId, pgDelete, pgInsert, pgSelect, pgSelectOne, pgUpdate, type Filter } from "./pg";

const TABLE = "cs_outfit_records";

const EMPTY_REQUEST: OutfitInspirationRequest = {
  season: "",
  profile: {
    favoriteColors: [],
    stylePreferences: [],
    makeupPreference: "",
  },
  scene: "daily",
  occasion: "",
  mood: "",
  weather: null,
};

const EMPTY_RESULT: OutfitInspirationResult = {
  theme: "",
  color_palette: [],
  item_recommendations: {
    top: "",
    bottom: "",
    outerwear: "",
    shoes: "",
    bag: "",
    accessories: "",
  },
  makeup_advice: "",
  reason: "",
};

interface OutfitRow {
  id: string;
  user_id: string;
  request: Partial<OutfitInspirationRequest> | null;
  result: Partial<OutfitInspirationResult> | null;
  source: string;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

function asIso(value: unknown) {
  return typeof value === "string" ? value : new Date().toISOString();
}

function toFullRecord(row: OutfitRow): OutfitHistoryRecord {
  const request = row.request && typeof row.request === "object" ? row.request : {};
  const result = row.result && typeof row.result === "object" ? row.result : {};

  return {
    id: row.id,
    userId: row.user_id,
    createdAt: asIso(row.created_at),
    source: row.source === "ai" ? "ai" : "mock",
    outfitId: row.id,
    resultId: row.id,
    imageUrl: typeof row.image_url === "string" && row.image_url.trim() ? row.image_url : undefined,
    request: {
      ...EMPTY_REQUEST,
      ...request,
      profile: {
        ...EMPTY_REQUEST.profile,
        ...(request.profile ?? {}),
      },
      weather:
        request.weather && typeof request.weather === "object"
          ? {
              city: typeof request.weather.city === "string" ? request.weather.city : "",
              temperature: typeof request.weather.temperature === "string" ? request.weather.temperature : "",
              condition: typeof request.weather.condition === "string" ? request.weather.condition : "",
            }
          : null,
    },
    result: {
      ...EMPTY_RESULT,
      ...result,
      item_recommendations: {
        ...EMPTY_RESULT.item_recommendations,
        ...(result.item_recommendations ?? {}),
      },
      color_palette: Array.isArray(result.color_palette)
        ? result.color_palette.filter((item): item is string => typeof item === "string")
        : [],
    },
  };
}

function toSummary(record: OutfitHistoryRecord): OutfitHistorySummary {
  return {
    id: record.id,
    createdAt: record.createdAt,
    source: record.source,
    outfitId: record.outfitId,
    resultId: record.resultId,
    imageUrl: record.imageUrl,
    season: record.request.season,
    scene: record.request.scene,
    occasion: record.request.occasion,
    mood: record.request.mood,
    city: record.request.weather?.city ?? "",
    theme: record.result.theme,
    colorPalette: record.result.color_palette,
  };
}

export async function createUserOutfitRecord(
  userId: string,
  input: {
    request: OutfitInspirationRequest;
    result: OutfitInspirationResult;
    source: "mock" | "ai";
    imageUrl?: string;
  },
): Promise<string> {
  const rows = await pgInsert<{ id: string }>(
    TABLE,
    {
      user_id: userId,
      request: input.request,
      result: input.result,
      source: input.source,
      ...(input.imageUrl ? { image_url: input.imageUrl } : {}),
    },
    { select: "id" },
  );

  return rows[0]?.id ?? "";
}

export async function listUserOutfitRecords(userId: string): Promise<OutfitHistorySummary[]> {
  const rows = await pgSelect<OutfitRow>(TABLE, {
    filters: [["user_id", "eq", userId]],
    order: "created_at.desc",
  });
  return rows.map((row) => toSummary(toFullRecord(row)));
}

export async function getUserOutfitRecord(id: string, userId: string): Promise<OutfitHistoryRecord | null> {
  const row = await pgSelectOne<OutfitRow>(TABLE, { filters: byId(id) });
  if (!row || row.user_id !== userId) {
    return null;
  }
  return toFullRecord(row);
}

export async function deleteUserOutfitRecord(id: string, userId: string): Promise<boolean> {
  const filters: Filter[] = [...byId(id), ["user_id", "eq", userId]];
  const deleted = await pgDelete<{ id: string }>(TABLE, filters);
  return deleted.length > 0;
}

export async function updateUserOutfitRecord(
  id: string,
  userId: string,
  input: Partial<{
    request: Partial<OutfitInspirationRequest>;
    result: Partial<OutfitInspirationResult>;
    source: "mock" | "ai";
    imageUrl: string;
  }>,
): Promise<string | null> {
  const record = await getUserOutfitRecord(id, userId);
  if (!record) {
    return null;
  }

  await pgUpdate(
    TABLE,
    [...byId(id), ["user_id", "eq", userId]],
    {
      ...(input.request ? { request: { ...record.request, ...input.request } } : {}),
      ...(input.result ? { result: { ...record.result, ...input.result } } : {}),
      ...(input.source ? { source: input.source } : {}),
      ...(typeof input.imageUrl === "string" ? { image_url: input.imageUrl } : {}),
      updated_at: new Date().toISOString(),
    },
  );

  return id;
}
