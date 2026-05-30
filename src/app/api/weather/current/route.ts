import { NextResponse } from "next/server";
import type { WeatherInfo } from "@/lib/outfit-types";

export const runtime = "nodejs";

const WEATHER_API_BASE_URL = "https://api.weatherapi.com/v1/current.json";

interface WeatherApiResponse {
  location?: {
    name?: string;
  };
  current?: {
    temp_c?: number;
    condition?: {
      text?: string;
    };
  };
  error?: {
    message?: string;
  };
}

function buildMockWeather(query: string): WeatherInfo {
  return {
    city: query && !query.includes(",") ? query : "当前位置",
    temperature: "24°C",
    condition: "多云",
    source: "mock",
  };
}

function normalizeWeather(payload: WeatherApiResponse, fallbackQuery: string): WeatherInfo {
  const city = payload.location?.name?.trim() || fallbackQuery || "当前位置";
  const temp = typeof payload.current?.temp_c === "number" ? Math.round(payload.current.temp_c) : null;
  const condition = payload.current?.condition?.text?.trim() || "天气暂不可用";

  return {
    city,
    temperature: temp === null ? "--°C" : `${temp}°C`,
    condition,
    source: "weatherapi",
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();

  if (!query) {
    return NextResponse.json({ success: false, error: "QUERY_REQUIRED" }, { status: 400 });
  }

  const apiKey = process.env.WEATHERAPI_KEY;
  if (!apiKey) {
    return NextResponse.json({
      success: true,
      data: buildMockWeather(query),
      warning: "WEATHERAPI_KEY is not configured. Returned mock weather.",
    });
  }

  const url = new URL(WEATHER_API_BASE_URL);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("q", query);
  url.searchParams.set("aqi", "no");
  url.searchParams.set("lang", "zh");

  try {
    const response = await fetch(url, { next: { revalidate: 60 * 60 * 6 } });
    const payload = (await response.json().catch(() => ({}))) as WeatherApiResponse;

    if (!response.ok) {
      console.warn("[weather] WeatherAPI request failed", {
        status: response.status,
        message: payload.error?.message,
      });
      return NextResponse.json({
        success: true,
        data: buildMockWeather(query),
        warning: payload.error?.message ?? "WeatherAPI request failed. Returned mock weather.",
      });
    }

    return NextResponse.json({
      success: true,
      data: normalizeWeather(payload, query),
    });
  } catch (error) {
    console.warn("[weather] WeatherAPI request error", {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({
      success: true,
      data: buildMockWeather(query),
      warning: "WeatherAPI request failed. Returned mock weather.",
    });
  }
}
