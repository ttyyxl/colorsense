import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth-server";
import { deleteUserOutfitRecord, getUserOutfitRecord, updateUserOutfitRecord } from "@/lib/firestore-outfit-records";
import type { OutfitInspirationRequest, OutfitInspirationResult } from "@/lib/outfit-types";

interface RouteContext {
  params: {
    id: string;
  };
}

export async function GET(_request: Request, { params }: RouteContext) {
  const user = await verifyAuth();
  if (!user) {
    return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const record = await getUserOutfitRecord(params.id, user.uid);
  if (!record) {
    return NextResponse.json({ success: false, error: "NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({ success: true, record });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const user = await verifyAuth();
  if (!user) {
    return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const deleted = await deleteUserOutfitRecord(params.id, user.uid);
  if (!deleted) {
    return NextResponse.json({ success: false, error: "NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

function asRecord(value: unknown) {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function PUT(request: Request, { params }: RouteContext) {
  const user = await verifyAuth();
  if (!user) {
    return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "INVALID_JSON" }, { status: 400 });
  }

  const root = asRecord(payload);
  const updatedId = await updateUserOutfitRecord(params.id, user.uid, {
    request: asRecord(root.request) as Partial<OutfitInspirationRequest>,
    result: asRecord(root.result) as Partial<OutfitInspirationResult>,
    source: root.source === "ai" ? "ai" : root.source === "mock" ? "mock" : undefined,
    imageUrl: asString(root.imageUrl),
  });

  if (!updatedId) {
    return NextResponse.json({ success: false, error: "NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({ success: true, id: updatedId });
}
