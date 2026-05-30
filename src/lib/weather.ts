import type { WeatherInfo } from "./outfit-types";

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export async function getMockWeather(city = "上海市"): Promise<WeatherInfo> {
  return {
    city,
    condition: "多云",
    temperature: "24°C",
    source: "mock",
  };
}

export async function getWeatherByCoordinates(coordinates: Coordinates): Promise<WeatherInfo> {
  return getWeather(`${coordinates.latitude},${coordinates.longitude}`);
}

export async function getWeatherByCity(city: string): Promise<WeatherInfo> {
  return getWeather(city.trim() || "上海市");
}

async function getWeather(query: string): Promise<WeatherInfo> {
  try {
    const response = await fetch(`/api/weather/current?q=${encodeURIComponent(query)}`);
    const payload = (await response.json()) as { success?: boolean; data?: WeatherInfo };

    if (!response.ok || !payload.success || !payload.data) {
      return getMockWeather(query);
    }

    return payload.data;
  } catch {
    return getMockWeather(query);
  }
}
