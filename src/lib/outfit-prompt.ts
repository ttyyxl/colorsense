import type { OutfitInspirationRequest, OutfitInspirationResult } from "./outfit-types";

export const OUTFIT_JSON_SCHEMA_EXAMPLE: OutfitInspirationResult = {
  theme: "清爽通勤感穿搭",
  mainColor: "雾霾蓝",
  secondaryColor: "柔白色",
  accentColor: "银灰色",
  top: "低饱和蓝色针织短袖或衬衫",
  bottom: "浅灰色直筒裤",
  outerwear: "轻薄白色开衫",
  shoes: "白色乐福鞋或浅色单鞋",
  bag: "银灰色小包",
  accessories: "简洁银色耳饰",
  makeup: "清透底妆、玫瑰豆沙唇色、低饱和粉色腮红",
  reason: "整体配色符合季型的冷调、柔和、低饱和特点，同时贴合通勤场景。",
};

export function buildOutfitPrompt(input: OutfitInspirationRequest) {
  const weather = input.weather;
  const favoriteColors = input.profile.favoriteColors.length > 0 ? input.profile.favoriteColors.join("、") : "未填写";
  const stylePreferences =
    input.profile.stylePreferences.length > 0 ? input.profile.stylePreferences.join("、") : "未填写";

  return `你是一位专业个人色彩与穿搭顾问。请基于用户信息生成今日 OOTD 建议。

用户信息：
- 季型：${input.season}
- 喜欢的颜色：${favoriteColors}
- 风格偏好：${stylePreferences}
- 妆容偏好：${input.profile.makeupPreference || "未填写"}
- 场景：${input.scene}
- 具体场合：${input.occasion}
- 今日心情：${input.mood}
- 城市：${weather?.city || "未提供"}
- 温度：${weather?.temperature || "未提供"}
- 天气：${weather?.condition || "未提供"}

要求：
1. 输出必须是固定 JSON，不要 Markdown，不要额外解释。
2. 推荐内容要简洁、具体、普通用户能直接照着穿。
3. 如果温度较低，必须给出外套或叠穿方案；如果温度较高，推荐轻薄、透气、少层次材质。
4. 如果天气包含雨、阵雨、雷雨，鞋子要考虑防滑，外套和包包要考虑耐水或易打理材质。
5. 如果天气晴或高温，注意防晒、浅色、透气和轻量配饰。
6. 旅行场景要兼顾舒适度、行动便利和拍照效果。
7. 通勤、上课要日常实穿；约会、咖啡店可以更精致有氛围。
8. 推荐颜色需要符合用户季型，同时尽量靠近用户喜欢的颜色。
9. 今日心情要影响整体氛围，但不能牺牲场景实用性。

JSON 字段：
${JSON.stringify(OUTFIT_JSON_SCHEMA_EXAMPLE, null, 2)}`;
}

export function buildMockOutfit(input: OutfitInspirationRequest): OutfitInspirationResult {
  const isTravel = input.scene === "travel";
  const weatherKind = getWeatherKind(input.weather?.condition);
  const temperatureKind = getTemperatureKind(input.weather?.temperature);
  const favoriteColor = input.profile.favoriteColors[0];
  const mainColor = favoriteColor || getSeasonMainColor(input.season);
  const cityText = input.weather?.city ? `${input.weather.city}` : "今天";
  const accentColor = input.season === "winter" ? "银色" : "浅金色";

  return {
    theme: `${input.mood}${isTravel ? "旅行" : "日常"}${input.occasion}穿搭`,
    mainColor,
    secondaryColor: getSecondaryColor(input.season),
    accentColor,
    top: buildTop(mainColor, temperatureKind, input.mood),
    bottom: buildBottom(isTravel, input.occasion),
    outerwear: buildOuterwear(temperatureKind, weatherKind),
    shoes: buildShoes(isTravel, weatherKind),
    bag: buildBag(isTravel, weatherKind, accentColor),
    accessories: buildAccessories(input.season, weatherKind, input.mood),
    makeup: `${input.profile.makeupPreference || "清透日常妆"}，搭配${getMakeupTone(input.mood)}和自然提气色唇色`,
    reason: `${cityText}${input.weather ? `当前${input.weather.condition}、${input.weather.temperature}` : "天气信息不完整"}，推荐已按${temperatureKind.label}和${weatherKind.label}调整厚薄与材质；整体配色围绕${mainColor}展开，兼顾${input.season}季型、${input.mood}心情和${input.occasion}场合。`,
  };
}

function getSeasonMainColor(season: string) {
  const palette: Record<string, string> = {
    spring: "蜜桃粉",
    summer: "雾霾蓝",
    autumn: "橄榄绿",
    winter: "宝石蓝",
  };
  return palette[season] ?? "柔和蓝";
}

function getSecondaryColor(season: string) {
  const palette: Record<string, string> = {
    spring: "奶油白",
    summer: "柔白色",
    autumn: "燕麦色",
    winter: "冷白色",
  };
  return palette[season] ?? "柔白色";
}

function getTemperatureKind(temperature?: string) {
  const numbers = temperature?.match(/-?\d+/g)?.map(Number) ?? [];
  if (numbers.length === 0) {
    return { key: "mild", label: "常规温度" };
  }

  const max = Math.max(...numbers);
  const min = Math.min(...numbers);
  if (max >= 28) {
    return { key: "hot", label: "偏热天气" };
  }
  if (min <= 15) {
    return { key: "cold", label: "偏冷天气" };
  }
  return { key: "mild", label: "舒适温度" };
}

function getWeatherKind(condition?: string) {
  const text = condition ?? "";
  if (/雨|雷|阵雨|rain|shower|thunder/i.test(text)) {
    return { key: "rain", label: "雨天" };
  }
  if (/晴|sunny|clear/i.test(text)) {
    return { key: "sunny", label: "晴天" };
  }
  if (/雪|snow/i.test(text)) {
    return { key: "snow", label: "雪天" };
  }
  return { key: "cloudy", label: "多云或常规天气" };
}

function buildTop(mainColor: string, temperatureKind: { key: string }, mood: string) {
  if (temperatureKind.key === "hot") {
    return `${mainColor}轻薄棉麻短袖或透气衬衫`;
  }
  if (temperatureKind.key === "cold") {
    return `${mainColor}细针织打底衫或柔软高领内搭`;
  }
  return `${mainColor}${mood === "精致" ? "垂感衬衫" : "短袖针织衫或薄衬衫"}`;
}

function buildBottom(isTravel: boolean, occasion: string) {
  if (isTravel) {
    return "浅灰休闲直筒裤或行动方便的 A 字半裙";
  }
  if (occasion === "约会" || occasion === "咖啡店") {
    return "浅灰半裙或干净直筒裤";
  }
  return "浅灰直筒裤";
}

function buildOuterwear(temperatureKind: { key: string }, weatherKind: { key: string }) {
  if (weatherKind.key === "rain") {
    return "轻薄防泼水外套或短款风衣";
  }
  if (temperatureKind.key === "hot") {
    return "可不搭外套，准备一件薄开衫应对空调";
  }
  if (temperatureKind.key === "cold") {
    return "短款羊毛开衫或利落风衣，方便叠穿保暖";
  }
  return "轻薄白色开衫";
}

function buildShoes(isTravel: boolean, weatherKind: { key: string }) {
  if (weatherKind.key === "rain") {
    return "防滑浅色乐福鞋或易打理短靴";
  }
  if (isTravel) {
    return "白色舒适运动鞋或浅色玛丽珍鞋";
  }
  return "白色乐福鞋或浅口单鞋";
}

function buildBag(isTravel: boolean, weatherKind: { key: string }, accentColor: string) {
  if (weatherKind.key === "rain") {
    return `${accentColor}尼龙斜挎小包或易打理腋下包`;
  }
  return isTravel ? "轻便斜挎小包" : `${accentColor}小包`;
}

function buildAccessories(season: string, weatherKind: { key: string }, mood: string) {
  const metal = season === "winter" || season === "summer" ? "银色" : "浅金色";
  if (weatherKind.key === "sunny") {
    return `${metal}耳饰、细链项链和轻量防晒帽`;
  }
  if (mood === "精致") {
    return `${metal}耳饰、细链项链和小面积珍珠点缀`;
  }
  return `简洁${metal}耳饰`;
}

function getMakeupTone(mood: string) {
  const tones: Record<string, string> = {
    轻松: "低饱和裸粉腮红",
    自信: "清晰眉眼和提气色唇釉",
    温柔: "玫瑰豆沙腮红",
    活泼: "元气蜜桃腮红",
    冷静: "干净雾面底妆",
    精致: "细闪眼影和柔雾唇色",
  };
  return tones[mood] ?? "低饱和腮红";
}
