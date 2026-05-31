"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, CloudSun, Loader2, LocateFixed, MapPin, Sparkles, Wand2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { FooterGradient } from "@/components/home/FooterGradient"; // Import FooterGradient
import { motion } from "framer-motion"; // Import motion
import { getWeatherByCity, getWeatherByCoordinates } from "@/lib/weather";
import type {
  OutfitInspirationApiResponse,
  OutfitInspirationRequest,
  OutfitProfileInput,
  OutfitScene,
  WeatherInfo,
} from "@/lib/outfit-types";
import type { UserStyleProfile } from "@/lib/user-profile-types";
import { useAuth } from "@/lib/useAuth";

const springTransition = { type: "spring", stiffness: 140, damping: 20 } as const; // Define springTransition

const sceneGroups: Record<OutfitScene, { label: string; icon: string; options: string[] }> = {
  daily: {
    label: "日常",
    icon: "☀️",
    options: ["上课", "通勤", "逛街", "咖啡店", "约会"],
  },
  travel: {
    label: "旅行",
    icon: "🧳",
    options: ["海边", "城市漫步", "山野自然", "博物馆", "拍照打卡"],
  },
};

const moods = [
  { label: "轻松", emoji: "😌", tone: "bg-sky-50 text-sky-700 border-sky-100" },
  { label: "自信", emoji: "✨", tone: "bg-amber-50 text-amber-700 border-amber-100" },
  { label: "温柔", emoji: "🌷", tone: "bg-rose-50 text-rose-700 border-rose-100" },
  { label: "活泼", emoji: "🍊", tone: "bg-orange-50 text-orange-700 border-orange-100" },
  { label: "冷静", emoji: "🫧", tone: "bg-cyan-50 text-cyan-700 border-cyan-100" },
  { label: "精致", emoji: "💄", tone: "bg-purple-50 text-purple-700 border-purple-100" },
];

interface LatestDiagnosisPayload {
  success?: boolean;
  diagnosis?: {
    seasonType?: string | null;
  } | null;
}

interface ProfilePayload {
  success?: boolean;
  profile?: UserStyleProfile | null;
}

export default function OutfitPage() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const [season, setSeason] = useState("");
  const [profile, setProfile] = useState<UserStyleProfile | null>(null);
  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const [cityInput, setCityInput] = useState("");
  const [scene, setScene] = useState<OutfitScene>("daily");
  const [occasion, setOccasion] = useState("");
  const [mood, setMood] = useState("");
  const [loading, setLoading] = useState(true);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const accountName = currentUser?.displayName?.trim() || currentUser?.email || "ColorSense 用户";

  const profileInput = useMemo((): OutfitProfileInput => {
    const promptFields = profile?.promptContext?.promptFields;
    const favoriteColors = [
      promptFields?.skinTone,
      promptFields?.eyeColor,
      promptFields?.hairColor,
    ].filter((value): value is string => Boolean(value));

    return {
      favoriteColors,
      stylePreferences: promptFields?.stylePreferences ?? profile?.optionalInfo?.stylePreferences ?? [],
      makeupPreference:
        promptFields?.makeupPreferences?.join("、") ||
        profile?.optionalInfo?.makeupPreferences?.join("、") ||
        profile?.optionalInfo?.makeupPreferenceOther ||
        "",
      rawProfile: profile,
    };
  }, [profile]);

  useEffect(() => {
    let active = true;

    async function loadUserData() {
      if (!currentUser) {
        return;
      }

      setLoading(true);
      setError("");
      try {
        const token = await currentUser.getIdToken();
        const [profileResponse, diagnosisResponse] = await Promise.all([
          fetch("/api/user-profile", { headers: { Authorization: `Bearer ${token}` } }),
          fetch("/api/user-profile/latest-diagnosis", { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        const profilePayload = (await profileResponse.json()) as ProfilePayload;
        const diagnosisPayload = (await diagnosisResponse.json()) as LatestDiagnosisPayload;

        if (!active) {
          return;
        }

        setProfile(profilePayload.success ? profilePayload.profile ?? null : null);
        setSeason(diagnosisPayload.success ? diagnosisPayload.diagnosis?.seasonType ?? "" : "");
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "读取用户信息失败，请稍后重试。");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadUserData();

    return () => {
      active = false;
    };
  }, [currentUser]);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setNotice("当前设备不支持定位，可手动输入城市后点击更新。");
      void getWeatherByCity("上海市").then((nextWeather) => {
        setWeather(nextWeather);
        setCityInput(nextWeather.city);
      });
      return;
    }

    setWeatherLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const nextWeather = await getWeatherByCoordinates({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
          setWeather(nextWeather);
          setCityInput(nextWeather.city);
        } catch {
          setNotice("天气信息暂时不可用，可手动输入城市后点击更新。");
        } finally {
          setWeatherLoading(false);
        }
      },
      () => {
        setNotice("无法获取当前位置，可手动输入城市后点击更新。");
        void getWeatherByCity("上海市").then((nextWeather) => {
          setWeather(nextWeather);
          setCityInput(nextWeather.city);
          setWeatherLoading(false);
        });
      },
      { timeout: 8000, maximumAge: 10 * 60 * 1000 },
    );
  }, []);

  async function refreshWeatherByCity() {
    setWeatherLoading(true);
    setNotice("");
    try {
      const nextWeather = await getWeatherByCity(cityInput);
      setWeather(nextWeather);
      setCityInput(nextWeather.city);
    } catch {
      setNotice("天气信息暂时不可用，不会影响生成穿搭。");
    } finally {
      setWeatherLoading(false);
    }
  }

  async function generateOutfit() {
    if (!season) {
      setError("请先完成一次 AI 诊断，再生成今日 OOTD。");
      return;
    }
    if (!occasion) {
      setError("请选择一个具体场合。");
      return;
    }
    if (!mood) {
      setError("请选择今日心情。");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const requestBody: OutfitInspirationRequest = {
        season,
        profile: profileInput,
        scene,
        occasion,
        mood,
        weather,
      };
      const response = await fetch("/api/outfit-inspiration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const payload = (await response.json()) as OutfitInspirationApiResponse;

      if (!response.ok || !payload.success) {
        throw new Error(payload.success ? "生成失败，请稍后重试。" : payload.message ?? payload.error);
      }

      sessionStorage.setItem(
        "colorsense-outfit-result",
        JSON.stringify({
          request: requestBody,
          result: payload.data,
          source: payload.source,
        }),
      );

        if (currentUser) {
          try {
            const token = await currentUser.getIdToken(true);
            const saveResponse = await fetch("/api/outfit-records", {
              method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              request: requestBody,
                result: payload.data,
                source: payload.source,
              }),
            });

            const savePayload = (await saveResponse.json().catch(() => ({}))) as { success?: boolean; id?: string; error?: string };

            if (saveResponse.ok && savePayload.success && savePayload.id) {
              sessionStorage.setItem(
                "colorsense-outfit-result",
                JSON.stringify({
                  request: requestBody,
                  result: payload.data,
                  source: payload.source,
                  outfitId: savePayload.id,
                  resultId: savePayload.id,
                }),
              );
            } else if (!saveResponse.ok) {
              console.warn("[outfit-inspiration] record save failed", await saveResponse.text());
            }
          } catch (saveError) {
            console.warn("[outfit-inspiration] record save failed", saveError);
          }
      }

      router.push("/outfit/result");
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成失败，请稍后重试。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ProtectedRoute>
      <main className="home-dashboard-shell min-h-screen text-[#181698]">
        <Navbar />
        <section className="mx-auto max-w-5xl px-6 py-8">
          <div className="flex flex-col gap-5 glass-card-strong rounded-[20px] p-5 md:p-7">
            <header>
              <p className="inline-flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1 text-sm font-semibold text-indigo-700">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                穿搭灵感
              </p>
              <h1 className="mt-3 text-3xl font-bold text-slate-950">今日 OOTD</h1>
            </header>

            {notice && <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{notice}</p>}
            {error && <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}

            <section className="grid gap-4 glass-card rounded-[20px] p-5 md:grid-cols-[1fr_1.08fr]">
              <div>
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-lg font-bold text-white">
                    {accountName.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{accountName}</p>
                    <p className="mt-1 inline-flex items-center gap-2 text-sm font-semibold text-slate-500">
                      <CalendarDays className="h-4 w-4" aria-hidden="true" />
                      个人信息
                    </p>
                  </div>
                </div>

                {loading ? (
                  <p className="mt-4 text-sm text-slate-500">正在读取季型和个人档案...</p>
                ) : season ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="glass-card rounded-[20px] p-4">
                      <p className="text-xs font-semibold text-slate-500">最近季型</p>
                      <p className="mt-1 text-2xl font-bold capitalize text-indigo-700">{season}</p>
                    </div>
                    <div className="glass-card rounded-[20px] p-4">
                      <p className="text-xs font-semibold text-slate-500">风格偏好</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(profileInput.stylePreferences.length > 0 ? profileInput.stylePreferences : ["基础推荐"]).slice(0, 4).map((item) => (
                          <span key={item} className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 glass-card rounded-[20px] p-4 text-sm text-amber-900 border border-amber-200 bg-amber-50">
                    <p className="font-semibold">还没有可用季型</p>
                    <p className="mt-2 leading-6">请先完成一次 AI 诊断，再生成更准确的今日穿搭。</p>
                    <Link href="/upload" className="mt-4 inline-flex rounded-xl bg-amber-500 px-4 py-2 font-semibold text-white">
                      去诊断
                    </Link>
                  </div>
                )}
              </div>

              <div className="glass-card rounded-[20px] p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 font-semibold text-slate-900">
                    <CloudSun className="h-4 w-4 text-indigo-600" aria-hidden="true" />
                    今日天气
                  </span>
                  <span className="rounded-full bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-700">
                    {weather?.source === "weatherapi" ? "实时" : "Mock"}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <WeatherPill label="城市" value={weather?.city || "未获取"} />
                  <WeatherPill label="天气" value={weather?.condition || "-"} />
                  <WeatherPill label="气温" value={weather?.temperature || "-"} />
                </div>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <input
                    value={cityInput}
                    onChange={(event) => setCityInput(event.target.value)}
                    placeholder="手动输入城市"
                    className="min-h-11 flex-1 rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-indigo-400"
                  />
                  <button
                    type="button"
                    onClick={refreshWeatherByCity}
                    disabled={weatherLoading}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-white px-4 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-60"
                  >
                    {weatherLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <LocateFixed className="h-4 w-4" aria-hidden="true" />}
                    更新
                  </button>
                </div>
              </div>
            </section>

            <section className="glass-card rounded-[20px] p-5">
              <p className="text-sm font-semibold text-slate-500">我今天要...</p>
              <div className="mt-4 flex gap-2 border-b border-indigo-100">
                {(Object.keys(sceneGroups) as OutfitScene[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      if (scene !== key) {
                        setScene(key);
                        setOccasion("");
                      }
                    }}
                    className={`relative -mb-px inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-t-2xl border px-4 text-sm font-bold transition ${
                      scene === key
                        ? "border-indigo-200 border-b-white bg-white text-indigo-700 shadow-sm"
                        : "border-transparent bg-indigo-50 text-slate-500 hover:bg-indigo-100 hover:text-indigo-700"
                    }`}
                  >
                    <span>{sceneGroups[key].icon}</span>
                    {sceneGroups[key].label}
                  </button>
                ))}
              </div>
              <div className="glass-card rounded-b-[20px] rounded-tr-[20px] border border-t-0 border-indigo-100 bg-white p-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  {sceneGroups[scene].options.map((item) => (
                    <SceneCard
                      key={item}
                      label={item}
                      selected={occasion === item}
                      onClick={() => setOccasion((value) => (value === item ? "" : item))}
                    />
                  ))}
                </div>
              </div>
            </section>

            <section className="glass-card rounded-[20px] p-5">
              <h2 className="text-lg font-bold text-slate-950">今日心情</h2>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
                {moods.map((item) => (
                  <MoodCard
                    key={item.label}
                    label={item.label}
                    emoji={item.emoji}
                    tone={item.tone}
                    selected={mood === item.label}
                    onClick={() => setMood((value) => (value === item.label ? "" : item.label))}
                  />
                ))}
              </div>
            </section>

            <button
              type="button"
              onClick={generateOutfit}
              disabled={submitting || loading}
              className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-[20px] bg-gradient-to-r from-indigo-600 to-purple-600 px-6 font-bold text-white shadow-lg shadow-indigo-100 transition hover:from-indigo-700 hover:to-purple-700 disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300"
            >
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <Wand2 className="h-5 w-5" aria-hidden="true" />}
              {submitting ? "正在生成..." : "生成今日 OOTD"}
            </button>
          </div>
        </section>
      </main>
    </ProtectedRoute>
  );
}

function WeatherPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-card rounded-[12px] px-3 py-2">
      <p className="text-[11px] font-semibold text-slate-400">{label}</p>
      <p className="mt-1 truncate text-sm font-bold text-slate-900">{value}</p>
    </div>
  );
}

function SceneCard({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-16 glass-card rounded-[12px] px-4 py-3 text-center text-sm font-semibold transition hover:-translate-y-0.5 ${
        selected
          ? "border-indigo-500 bg-indigo-600 text-white shadow-lg shadow-indigo-100"
          : "text-slate-700 hover:border-indigo-200 hover:bg-indigo-50"
      }`}
    >
      {label}
    </button>
  );
}

function MoodCard({
  label,
  emoji,
  tone,
  selected,
  onClick,
}: {
  label: string;
  emoji: string;
  tone: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-20 glass-card rounded-[12px] px-3 py-3 text-center transition hover:-translate-y-0.5 ${
        selected ? "border-indigo-500 bg-indigo-600 text-white shadow-lg shadow-indigo-100" : tone
      }`}
    >
      <span className="block text-2xl leading-none">{emoji}</span>
      <span className="mt-2 block text-sm font-bold">{label}</span>
    </button>
  );
}
