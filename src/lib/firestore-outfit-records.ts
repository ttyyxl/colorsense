import { getAdminDb } from "./firebase-admin";
import type { OutfitHistoryRecord, OutfitHistorySummary, OutfitInspirationRequest, OutfitInspirationResult } from "./outfit-types";

const COLLECTION_NAME = "outfitRecords";

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

type FirestoreTimestampLike = {
  toDate?: () => Date;
};

function asTimestampIso(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (value && typeof value === "object") {
    const timestamp = value as FirestoreTimestampLike;
    if (typeof timestamp.toDate === "function") {
      return timestamp.toDate().toISOString();
    }
  }

  return new Date().toISOString();
}

function toFullRecord(id: string, data: Record<string, unknown>): OutfitHistoryRecord {
  const request = data.request && typeof data.request === "object" ? (data.request as Partial<OutfitInspirationRequest>) : {};
  const result = data.result && typeof data.result === "object" ? (data.result as Partial<OutfitInspirationResult>) : {};
  return {
    id,
    userId: typeof data.userId === "string" ? data.userId : "",
    createdAt: asTimestampIso(data.createdAt),
    source: data.source === "ai" ? "ai" : "mock",
    outfitId: typeof data.outfitId === "string" ? data.outfitId : id,
    resultId: typeof data.resultId === "string" ? data.resultId : id,
    imageUrl: typeof data.imageUrl === "string" && data.imageUrl.trim() ? data.imageUrl : undefined,
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
      color_palette: Array.isArray(result.color_palette) ? result.color_palette.filter((item): item is string => typeof item === "string") : [],
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
) {
  const db = getAdminDb();
  const docRef = await db.collection(COLLECTION_NAME).add({
    request: input.request,
    result: input.result,
    source: input.source,
    userId,
    createdAt: new Date(),
    ...(input.imageUrl ? { imageUrl: input.imageUrl } : {}),
  });
  await docRef.update({
    outfitId: docRef.id,
    resultId: docRef.id,
  });
  return docRef.id;
}

export async function listUserOutfitRecords(userId: string) {
  const db = getAdminDb();
  const snapshot = await db.collection(COLLECTION_NAME).where("userId", "==", userId).get();
  const records = snapshot.docs
    .map((doc) => toFullRecord(doc.id, doc.data()))
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));

  return records.map(toSummary);
}

export async function getUserOutfitRecord(id: string, userId: string) {
  const db = getAdminDb();
  const snapshot = await db.collection(COLLECTION_NAME).doc(id).get();

  if (!snapshot.exists) {
    return null;
  }

  const record = toFullRecord(snapshot.id, snapshot.data() ?? {});
  return record.userId === userId ? record : null;
}

export async function deleteUserOutfitRecord(id: string, userId: string) {
  const db = getAdminDb();
  const record = await getUserOutfitRecord(id, userId);
  if (!record) {
    return false;
  }

  await db.collection(COLLECTION_NAME).doc(id).delete();
  return true;
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
) {
  const db = getAdminDb();
  const record = await getUserOutfitRecord(id, userId);
  if (!record) {
    return null;
  }

  const docRef = db.collection(COLLECTION_NAME).doc(id);
  await docRef.update({
    ...(input.request ? { request: { ...record.request, ...input.request } } : {}),
    ...(input.result ? { result: { ...record.result, ...input.result } } : {}),
    ...(input.source ? { source: input.source } : {}),
    ...(typeof input.imageUrl === "string" ? { imageUrl: input.imageUrl } : {}),
    outfitId: record.outfitId ?? id,
    resultId: record.resultId ?? id,
  });

  return id;
}
