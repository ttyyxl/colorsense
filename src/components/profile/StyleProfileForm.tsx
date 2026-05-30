"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { FormEvent, useEffect, useState } from "react";
import Sketch from "@uiw/react-color-sketch";
import { hsvaToHslaString } from "@uiw/color-convert";
import { auth } from "@/lib/firebase";
import type { UserStyleProfile, UserStyleProfileInput } from "@/lib/user-profile-types";

const GENDER_OPTIONS = ["女性", "男性", "非二元", "其他"];
const AGE_RANGE_OPTIONS = ["18岁以下", "18-24", "25-34", "35-44", "45-54", "55岁以上"];
const DAILY_SCENE_OPTIONS = ["学生", "职场通勤", "自由职业", "管理岗 / 商务场景", "服务行业", "艺术 / 设计 / 内容创作", "居家 / 全职生活", "其他"];
const SKIN_TONE_OPTIONS = ["很白", "偏白", "自然肤色", "偏黄", "偏深", "不确定"];
const EYE_COLOR_OPTIONS = ["黑色", "深棕", "浅棕", "琥珀色", "灰色", "不确定"];
const HAIR_COLOR_OPTIONS = ["黑色", "深棕", "浅棕", "染发浅色", "染发红 / 橘", "染发冷色", "不确定"];
const STYLE_OPTIONS = ["简约", "韩系", "通勤", "欧美", "甜美", "运动", "复古", "法式", "日系", "中性", "其他"];
const MAKEUP_OPTIONS = ["裸妆", "通勤妆", "甜美妆", "欧美妆", "氛围感妆", "浓颜妆", "不常化妆", "其他"];

const COMMON_COLORS = [
  { name: "黑色", shades: ["black","bg-gray-100", "bg-gray-300", "bg-gray-500", "bg-gray-700"] },
  { name: "白色", shades: ["white","bg-stone-100", "bg-stone-200", "bg-stone-300", "bg-stone-400"] },
  { name: "棕色", shades: ["bg-amber-200", "bg-amber-300", "bg-amber-500", "bg-amber-700", "bg-amber-900"] },
  { name: "红色", shades: ["bg-red-100", "bg-red-300", "bg-red-500", "bg-red-700", "bg-red-900"] },
  { name: "黄色", shades: ["bg-yellow-100", "bg-yellow-300", "bg-yellow-400", "bg-yellow-500", "bg-yellow-700"] },
  { name: "绿色", shades: ["bg-green-100", "bg-green-300", "bg-green-500", "bg-green-700", "bg-green-900"] },
  { name: "蓝色", shades: ["bg-blue-100", "bg-blue-300", "bg-blue-500", "bg-blue-700", "bg-blue-900"] },
  { name: "紫色", shades: ["bg-purple-100", "bg-purple-300", "bg-purple-500", "bg-purple-700", "bg-purple-900"] },
];
const EXTERNAL_FEATURE_GROUPS = [
  {
    key: "faceContour",
    title: "脸型轮廓",
    options: ["下颌线圆润", "下颌线有棱角", "颧骨较明显", "颧骨平缓", "脸颊饱满（肉感）", "脸颊较瘦（骨感）"],
  },
  {
    key: "facialDetails",
    title: "五官细节",
    options: ["眉毛浓", "眉毛淡", "眼睛偏圆", "眼睛偏长", "鼻梁高", "鼻梁低", "嘴唇薄", "嘴唇厚"],
  },
  {
    key: "skinHairContrast",
    title: "皮肤与毛发",
    options: ["皮肤对比度低（肤色与发色/瞳色相近）", "皮肤对比度高（肤色与发色/瞳色差异明显）"],
  },
] as const;
const STYLE_TENDENCY_OPTIONS = ["气质偏成熟", "气质偏年轻", "不确定", "其他"];

const FIELD_CONTROL_CLASS = "w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 outline-none focus:border-indigo-500";

const EMPTY_PROFILE: UserStyleProfileInput = {
  requiredInfo: {
    gender: "",
    genderOther: "",
    ageRange: "",
    dailyScene: "",
    dailySceneOther: "",
  },
  optionalInfo: {
    skinTone: "",
    eyeColor: "",
    hairColor: "",
    stylePreferences: [],
    stylePreferenceOther: "",
    makeupPreferences: [],
    makeupPreferenceOther: "",
    favoriteColors: [],
  },
  externalFeatures: {
    faceContour: [],
    facialDetails: [],
    skinHairContrast: [],
  },
  styleTendency: {
    values: [],
    other: "",
  },
};

interface StyleProfileFormProps {
  redirectPath?: string;
  submitLabel?: string;
  onSaved?: () => void;
}

function toInputProfile(profile: UserStyleProfile | null): UserStyleProfileInput {
  if (!profile) {
    return EMPTY_PROFILE;
  }

  return {
    requiredInfo: {
      ...EMPTY_PROFILE.requiredInfo,
      ...profile.requiredInfo,
    },
    optionalInfo: {
      ...EMPTY_PROFILE.optionalInfo,
      ...profile.optionalInfo,
      stylePreferences: profile.optionalInfo?.stylePreferences ?? [],
      makeupPreferences: profile.optionalInfo?.makeupPreferences ?? [],
      favoriteColors: profile.optionalInfo?.favoriteColors ?? [],
    },
    externalFeatures: {
      ...EMPTY_PROFILE.externalFeatures,
      ...profile.externalFeatures,
      faceContour: profile.externalFeatures?.faceContour ?? [],
      facialDetails: profile.externalFeatures?.facialDetails ?? [],
      skinHairContrast: profile.externalFeatures?.skinHairContrast ?? [],
    },
    styleTendency: {
      ...EMPTY_PROFILE.styleTendency,
      ...profile.styleTendency,
      values: profile.styleTendency?.values ?? [],
    },
  };
}

function updateList(values: string[], value: string, checked: boolean) {
  if (checked) {
    return values.includes(value) ? values : [...values, value];
  }
  return values.filter((item) => item !== value);
}

function isRequiredComplete(profile: UserStyleProfileInput) {
  const { gender, genderOther, ageRange, dailyScene, dailySceneOther } = profile.requiredInfo;
  const hasGender = Boolean(gender && (gender !== "其他" || genderOther?.trim()));
  const hasDailyScene = Boolean(dailyScene && (dailyScene !== "其他" || dailySceneOther?.trim()));
  return hasGender && Boolean(ageRange) && hasDailyScene;
}

export function StyleProfileForm({ redirectPath, submitLabel = "保存个人形象问卷", onSaved }: StyleProfileFormProps) {
  const router = useRouter();
  const [profile, setProfile] = useState<UserStyleProfileInput>(EMPTY_PROFILE);
  const [accountEmail, setAccountEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      if (!auth?.currentUser) {
        setLoading(false);
        return;
      }

      setAccountEmail(auth.currentUser.email ?? "已登录用户");

      try {
        const token = await auth.currentUser.getIdToken();
        const response = await fetch("/api/user-profile", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = (await response.json()) as {
          success?: boolean;
          profile?: UserStyleProfile | null;
          user?: { email?: string | null };
        };

        if (!active) {
          return;
        }
        if (payload.user?.email) {
          setAccountEmail(payload.user.email);
        }
        if (payload.success && payload.profile) {
          setProfile(toInputProfile(payload.profile));
        }
      } catch {
        if (active) {
          setNotice({ type: "error", text: "读取个人形象问卷失败，请稍后重试。" });
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      active = false;
    };
  }, []);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth?.currentUser) {
      setNotice({ type: "error", text: "请先登录后再保存个人形象问卷。" });
      return;
    }

    if (!isRequiredComplete(profile)) {
      setNotice({ type: "error", text: "请填写完整必填信息" });
      return;
    }

    setSaving(true);
    setNotice(null);
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch("/api/user-profile", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(profile),
      });
      const payload = (await response.json()) as { success?: boolean; error?: string };

      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "SAVE_FAILED");
      }

      setNotice({ type: "success", text: "个人形象问卷已保存。" });
      onSaved?.();
      if (redirectPath) {
        router.push(redirectPath);
      }
    } catch {
      setNotice({ type: "error", text: "保存失败，请检查网络或稍后重试。" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="rounded-2xl border border-indigo-100 bg-white p-6 text-slate-600">正在读取个人形象问卷...</div>;
  }

  return (
    <form onSubmit={saveProfile} className="space-y-6">
      <section className="rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-slate-500">当前登录账户</p>
        <p className="mt-1 text-base font-semibold text-slate-950">{accountEmail || "已登录用户"}</p>
      </section>

      {notice && (
        <p
          role="alert"
          className={`rounded-xl px-4 py-3 text-sm leading-6 ${
            notice.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
          }`}
        >
          {notice.text}
        </p>
      )}

      <section className="rounded-2xl border border-indigo-100 bg-white p-6 shadow-sm">
        <SectionTitle title="必填信息" description="完成这些信息后，才能保存并开始诊断。" />
        <div className="mt-5 space-y-5">
          <RadioGroup
            label="性别"
            required
            options={GENDER_OPTIONS}
            value={profile.requiredInfo.gender ?? ""}
            onChange={(gender) => setProfile({ ...profile, requiredInfo: { ...profile.requiredInfo, gender } })}
          />
          {profile.requiredInfo.gender === "其他" && (
            <TextField
              label="其他性别说明"
              value={profile.requiredInfo.genderOther ?? ""}
              onChange={(genderOther) => setProfile({ ...profile, requiredInfo: { ...profile.requiredInfo, genderOther } })}
            />
          )}
          <SelectField
            label="年龄段"
            required
            value={profile.requiredInfo.ageRange ?? ""}
            options={AGE_RANGE_OPTIONS}
            onChange={(ageRange) => setProfile({ ...profile, requiredInfo: { ...profile.requiredInfo, ageRange } })}
          />
          <SelectField
            label="职业 / 日常场景"
            required
            value={profile.requiredInfo.dailyScene ?? ""}
            options={DAILY_SCENE_OPTIONS}
            onChange={(dailyScene) => setProfile({ ...profile, requiredInfo: { ...profile.requiredInfo, dailyScene } })}
          />
          {profile.requiredInfo.dailyScene === "其他" && (
            <TextField
              label="其他职业 / 场景说明"
              value={profile.requiredInfo.dailySceneOther ?? ""}
              onChange={(dailySceneOther) => setProfile({ ...profile, requiredInfo: { ...profile.requiredInfo, dailySceneOther } })}
            />
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-indigo-100 bg-white p-6 shadow-sm">
        <SectionTitle title="选填信息" description="不确定的项目可以留空，后续可由季型模型或图像模型补充。" />
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <SelectField
            label="肤色"
            value={profile.optionalInfo.skinTone ?? ""}
            options={SKIN_TONE_OPTIONS}
            onChange={(skinTone) => setProfile({ ...profile, optionalInfo: { ...profile.optionalInfo, skinTone } })}
          />
          <SelectField
            label="瞳色"
            value={profile.optionalInfo.eyeColor ?? ""}
            options={EYE_COLOR_OPTIONS}
            onChange={(eyeColor) => setProfile({ ...profile, optionalInfo: { ...profile.optionalInfo, eyeColor } })}
          />
          <SelectField
            label="发色"
            value={profile.optionalInfo.hairColor ?? ""}
            options={HAIR_COLOR_OPTIONS}
            onChange={(hairColor) => setProfile({ ...profile, optionalInfo: { ...profile.optionalInfo, hairColor } })}
          />
        </div>
        <div className="mt-6 space-y-6">
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5">
            <p className="text-sm font-bold text-slate-900">外部特征</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">可多选。不确定的项目可以留空，后续可由模型检测补充。</p>
            <div className="mt-5 space-y-5">
              {EXTERNAL_FEATURE_GROUPS.map((group) => (
                <CheckboxGroup
                  key={group.key}
                  label={group.title}
                  options={[...group.options]}
                  values={profile.externalFeatures[group.key]}
                  onChange={(values) =>
                    setProfile({
                      ...profile,
                      externalFeatures: {
                        ...profile.externalFeatures,
                        [group.key]: values,
                      },
                    })
                  }
                />
              ))}
              <CheckboxGroup
                label="风格倾向"
                options={STYLE_TENDENCY_OPTIONS}
                values={profile.styleTendency.values}
                onChange={(values) => setProfile({ ...profile, styleTendency: { ...profile.styleTendency, values } })}
              />
              {profile.styleTendency.values.includes("其他") && (
                <TextField
                  label="其他风格倾向"
                  value={profile.styleTendency.other ?? ""}
                  onChange={(other) => setProfile({ ...profile, styleTendency: { ...profile.styleTendency, other } })}
                />
              )}
            </div>
          </div>
          <CheckboxGroup
            label="穿搭偏好"
            options={STYLE_OPTIONS}
            values={profile.optionalInfo.stylePreferences}
            onChange={(stylePreferences) => setProfile({ ...profile, optionalInfo: { ...profile.optionalInfo, stylePreferences } })}
          />
          {profile.optionalInfo.stylePreferences.includes("其他") && (
            <TextField
              label="其他穿搭偏好"
              value={profile.optionalInfo.stylePreferenceOther ?? ""}
              onChange={(stylePreferenceOther) => setProfile({ ...profile, optionalInfo: { ...profile.optionalInfo, stylePreferenceOther } })}
            />
          )}
          <CheckboxGroup
            label="妆容偏好"
            options={MAKEUP_OPTIONS}
            values={profile.optionalInfo.makeupPreferences}
            onChange={(makeupPreferences) => setProfile({ ...profile, optionalInfo: { ...profile.optionalInfo, makeupPreferences } })}
          />
          {profile.optionalInfo.makeupPreferences.includes("其他") && (
            <TextField
              label="其他妆容偏好"
              value={profile.optionalInfo.makeupPreferenceOther ?? ""}
              onChange={(makeupPreferenceOther) => setProfile({ ...profile, optionalInfo: { ...profile.optionalInfo, makeupPreferenceOther } })}
            />
          )}
          <FavoriteColorPicker
            label="喜好颜色"
            values={profile.optionalInfo.favoriteColors ?? []}
            onChange={(favoriteColors) => setProfile({ ...profile, optionalInfo: { ...profile.optionalInfo, favoriteColors } })}
          />
        </div>
      </section>

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-2xl bg-indigo-600 px-5 py-4 font-semibold text-white shadow-sm disabled:opacity-60"
      >
        {saving ? "保存中..." : submitLabel}
      </button>
    </form>
  );
}

function SectionTitle({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h2 className="text-lg font-bold text-slate-950">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
        {required && <span className="ml-1 text-rose-600">必填</span>}
      </span>
      {children}
    </label>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <Field label={label}>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={FIELD_CONTROL_CLASS}
        placeholder="请输入补充说明"
      />
    </Field>
  );
}

function SelectField({
  label,
  required,
  value,
  options,
  onChange,
}: {
  label: string;
  required?: boolean;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label} required={required}>
      <select value={value} onChange={(event) => onChange(event.target.value)} className={FIELD_CONTROL_CLASS}>
        <option value="">请选择</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </Field>
  );
}

function RadioGroup({
  label,
  required,
  options,
  value,
  onChange,
}: {
  label: string;
  required?: boolean;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-slate-700">
        {label}
        {required && <span className="ml-1 text-rose-600">必填</span>}
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <label key={option} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700">
            <input
              type="radio"
              checked={value === option}
              onChange={() => onChange(option)}
              className="h-4 w-4 border-slate-300 text-indigo-600"
            />
            {option}
          </label>
        ))}
      </div>
    </div>
  );
}

function CheckboxGroup({ label, options, values, onChange }: { label: string; options: string[]; values: string[]; onChange: (values: string[]) => void }) {
  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-slate-700">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <label key={option} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={values.includes(option)}
              onChange={(event) => onChange(updateList(values, option, event.target.checked))}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600"
            />
            {option}
          </label>
        ))}
      </div>
    </div>
  );
}

const getDisplayColorName = (value: string) => {
  if (value === "black") return "黑色";
  if (value === "white") return "白色";

  for (const group of COMMON_COLORS) {
    if (group.shades.includes(value)) {
      return group.name;
    }
  }
  return value;
};

interface FavoriteColorPickerProps {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
}

function FavoriteColorPicker({ label, values, onChange }: FavoriteColorPickerProps) {
  const [clickedColorName, setClickedColorName] = useState<string | null>(null);
  const [hsva, setHsva] = useState({ h: 0, s: 0, v: 80, a: 1 });

  const handleColorClick = (colorName: string) => {
    const newValues = updateList(values, colorName, !values.includes(colorName));
    onChange(newValues);
    setClickedColorName(getDisplayColorName(colorName));
    setTimeout(() => setClickedColorName(null), 2000);
  };

  const handleAddColorFromPicker = () => {
    const hexColor = hsvaToHslaString(hsva);
    if (!values.includes(hexColor)) {
      onChange([...values, hexColor]);
    }
    setClickedColorName(hexColor);
    setTimeout(() => setClickedColorName(null), 2000);
  };

  const handleRemoveCustomColor = (colorToRemove: string) => {
    onChange(values.filter((color) => color !== colorToRemove));
  };

  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-slate-700">{label}</p>
      <div className="flex flex-wrap gap-6">
        {COMMON_COLORS.map((colorGroup) => (
          <div key={colorGroup.name} className="flex flex-col items-center">
            <p className="mb-2 text-sm font-semibold text-slate-700">{colorGroup.name}</p>
            <div className="flex flex-col gap-2">
              {colorGroup.shades.map((shadeValue) => {
                const isSelected = values.includes(shadeValue);
                const displayColorName = `${colorGroup.name} (${shadeValue.replace('bg-', '')})`;

                return (
                  <div
                    key={shadeValue}
                    className={`w-8 h-8 rounded-full cursor-pointer transition-all duration-200 transform hover:scale-110
                      ${shadeValue === "white" || shadeValue === "black" ? "border border-slate-300" : ""}
                      ${isSelected ? "ring-2 ring-offset-2 ring-indigo-500" : ""}`}
                    style={{ backgroundColor: shadeValue.startsWith("bg-") ? undefined : shadeValue }}
                    onClick={() => handleColorClick(shadeValue)}
                    title={displayColorName}
                  >
                    {shadeValue.startsWith("bg-") && shadeValue !== "black" && shadeValue !== "white" && (
                      <div className={`${shadeValue} w-full h-full rounded-full`}></div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-col items-center gap-2">
        <Sketch
           color={hsva}
             onChange={(color) => setHsva(color.hsva)}
        />
        <button
          type="button"
          onClick={handleAddColorFromPicker}
          className="mt-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
        >
          添加选定颜色 ({hsvaToHslaString(hsva)})
        </button>
      </div>

      {clickedColorName && (
        <p className="mt-2 text-sm text-slate-600">已选择颜色: {clickedColorName}</p>
      )}

      
    </div>
  );
}
