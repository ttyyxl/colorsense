import type { SeasonType } from "./seasons";

export interface SeasonCaseStudy {
  name: string;
  feature: string;
  colorsAndStyle: string;
  whyItFits: string;
}

export interface SeasonIntroduction {
  title: string;
  subtitle: string;
  overview: string;
  coreTraits: string[];
  stylingFocus: string[];
  stylingSummary: string;
  celebrityCases: SeasonCaseStudy[];
}

export const SEASON_INTRODUCTIONS: Record<SeasonType, SeasonIntroduction> = {
  spring: {
    title: "春型",
    subtitle: "明亮、轻盈、带一点暖意的清透感",
    overview:
      "春型的核心不是甜，而是干净、通透和有生命力。更适合高明度、低到中等对比、偏暖的颜色，尤其是能把肤色照亮的浅桃、蜜杏、嫩绿、鹅黄和清亮的浅蓝。",
    coreTraits: ["高明度", "轻盈感", "暖而清透", "适合小面积高亮点缀"],
    stylingFocus: ["优先使用浅暖色和奶油色", "轮廓保持简洁，不要堆叠太多层次", "金色、暖银色首饰更友好"],
    stylingSummary:
      "春型适合把亮色放在脸部附近，用清爽材质和干净线条把气色提起来。整体重点是“轻”和“亮”，不是高饱和堆满全身。",
    celebrityCases: [
      {
        name: "赵露思",
        feature: "轻盈明亮、带少年感的清透气质",
        colorsAndStyle: "浅粉、奶油黄、薄荷绿和浅米色，适合简洁上衣、轻薄针织和干净连衣裙。",
        whyItFits: "她的面部特征和整体气质都需要明亮感来提神，太重的颜色会压住亲和力，浅暖色最能把春型优势放大。",
      },
      {
        name: "周也",
        feature: "清新、通透、偏轻快的明亮感",
        colorsAndStyle: "浅杏、柔黄、嫩绿和淡蓝，适合短外套、轻薄衬衫和低负担配饰。",
        whyItFits: "春型的关键是显得有精神但不厚重，周也这种气质用清亮浅色可以保持清爽和镜头友好度。",
      },
      {
        name: "王一博",
        feature: "干净利落、适合明亮但不复杂的色块",
        colorsAndStyle: "冰薄荷、奶白、浅卡其，适合简约版型、运动感单品和利落夹克。",
        whyItFits: "春型并不等于甜，王一博的清爽轮廓和克制造型可以靠明亮浅色放大干净感。",
      },
      {
        name: "刘昊然",
        feature: "少年感、轻松、带温暖活力的清透感",
        colorsAndStyle: "浅米、柔杏、清浅蓝，适合基础款衬衫、T 恤叠穿和轻薄外套。",
        whyItFits: "春型更适合靠清亮感而非厚重感建立存在感，刘昊然这种自然气质和浅暖色组合非常稳定。",
      },
    ],
  },
  summer: {
    title: "夏型",
    subtitle: "柔雾、冷调、低对比的安静优雅",
    overview:
      "夏型适合雾面感、低饱和和偏冷的颜色。它的关键词不是鲜艳，而是柔和、克制和耐看。烟粉、雾蓝、灰紫、淡莓果色都很容易显得高级。",
    coreTraits: ["低饱和", "冷柔感", "雾面质感", "适合中低对比搭配"],
    stylingFocus: ["以灰调、蓝调和粉调为主", "避免过暖的橙黄和强烈纯黑", "轮廓建议柔和但不松垮"],
    stylingSummary:
      "夏型要的是低噪音、低对比和统一的氛围。颜色越克制，肤色和五官越容易显得干净，适合把重点放在质感和层次上。",
    celebrityCases: [
      {
        name: "刘诗诗",
        feature: "清冷、克制、带雾感的优雅气质",
        colorsAndStyle: "雾白、浅蓝、浅薰衣草，适合简洁剪裁、柔和面料和低对比叠穿。",
        whyItFits: "她的气质本身就偏安静，夏型的柔冷色能把“清”和“稳”同时保住。",
      },
      {
        name: "章若楠",
        feature: "温柔、轻盈、偏柔焦的镜头感",
        colorsAndStyle: "烟粉、浅雾蓝、灰白，适合轻薄针织、柔软衬衫和低亮度配色。",
        whyItFits: "夏型更看重雾面质感，章若楠这类温柔气质用冷柔色会更自然，不会被颜色抢走注意力。",
      },
      {
        name: "李现",
        feature: "干净、沉静、适合低对比冷色",
        colorsAndStyle: "浅灰蓝、冷白、雾黑，适合简洁夹克、衬衫和通勤风单品。",
        whyItFits: "夏型不需要强烈存在感，李现这类克制型气质用低对比冷色更显高级。",
      },
      {
        name: "檀健次",
        feature: "精致、细腻、适合柔冷而不强硬的表达",
        colorsAndStyle: "浅灰紫、奶雾蓝、烟粉，适合细节感更强的造型和柔和层次。",
        whyItFits: "夏型的核心是耐看，细腻的低饱和冷色会让整体轮廓更统一，也更适合近景表现。",
      },
    ],
  },
  autumn: {
    title: "秋型",
    subtitle: "温润、浓郁、自然感很强的土系审美",
    overview:
      "秋型更适合深一点、厚一点、带自然烟火气的颜色。橄榄绿、焦糖棕、南瓜橙、砖红、芥末黄，都会让整体气质显得沉稳、松弛、成熟。",
    coreTraits: ["中低明度", "暖调浓郁", "自然质感", "适合层次丰富的搭配"],
    stylingFocus: ["把颜色层次做厚，不要只靠单一浅色", "暖棕、橄榄绿、砖红是安全区", "适合纹理感强的面料和复古廓形"],
    stylingSummary:
      "秋型适合厚度感和材料感更强的搭配，颜色可以更深一些，但整体要保持自然、松弛和稳定，不适合太轻太冷的色块。",
    celebrityCases: [
      {
        name: "倪妮",
        feature: "松弛、高级、带复古温度的气质",
        colorsAndStyle: "驼色、深橄榄、砖红，适合大地色套装、长风衣和有纹理的面料。",
        whyItFits: "秋型怕太轻，倪妮的气质需要深度和材质感来支撑，暖沉色比浅冷色更能成立。",
      },
      {
        name: "秦岚",
        feature: "温柔、稳定、成熟但不沉闷",
        colorsAndStyle: "豆沙棕、米咖色、暖橘，适合通勤套装、针织和有质感的内搭。",
        whyItFits: "秋型的重点是稳重但不老气，秦岚这种气质用暖调中性色会更耐看。",
      },
      {
        name: "胡歌",
        feature: "沉静、成熟、带自然稳重感",
        colorsAndStyle: "卡其、深棕、橄榄绿，适合衬衫、羊毛外套和偏复古的男装廓形。",
        whyItFits: "秋型适合自然材质和厚实色块，胡歌这类成熟气质和大地色系很容易形成统一感。",
      },
      {
        name: "黄轩",
        feature: "温和、克制、偏自然松弛的文气",
        colorsAndStyle: "焦糖棕、军绿、米咖，适合极简通勤、毛呢和低调配饰。",
        whyItFits: "秋型不是靠抢眼，而是靠稳定，黄轩这种偏自然的气质很适合土系与复古层次。",
      },
    ],
  },
  winter: {
    title: "冬型",
    subtitle: "清冷、高对比、边界分明的强视觉感",
    overview:
      "冬型适合黑白分明、色块干净、对比清楚的配色。它可以很锋利，也可以很克制，但核心都在于清晰。纯黑、纯白、宝蓝、正红、冰蓝都会非常有力量。",
    coreTraits: ["高对比", "冷调清晰", "适合纯净色块", "轮廓感强"],
    stylingFocus: ["用黑白蓝红建立强边界感", "减少发灰发脏的颜色", "适合挺括、干净、线条明确的服装"],
    stylingSummary:
      "冬型的关键是对比度和边界。颜色不必复杂，但必须足够干净、足够明确，才能把气场和轮廓完整地撑起来。",
    celebrityCases: [
      {
        name: "刘雯",
        feature: "冷感、强骨架、国际化的清晰轮廓",
        colorsAndStyle: "纯黑、冷白、宝蓝，适合长线条、极简套装和高结构单品。",
        whyItFits: "冬型最怕颜色发浑，刘雯这种骨感轮廓和高完成度造型，最适合用清晰对比拉出力量感。",
      },
      {
        name: "唐嫣",
        feature: "明亮、冷净、带高光感的精致气质",
        colorsAndStyle: "深宝蓝、冷红、纯白，适合干净连衣裙、修身大衣和明确的色块组合。",
        whyItFits: "冬型强调清晰和纯度，唐嫣的高亮感在强对比色里会更有存在感。",
      },
      {
        name: "易烊千玺",
        feature: "利落、克制、轮廓非常清楚",
        colorsAndStyle: "黑白灰、冷蓝、深红，适合简洁剪裁、廓形外套和低噪音配色。",
        whyItFits: "冬型适合把信息收紧，易烊千玺这类清晰轮廓和克制表达，用强对比最能放大气场。",
      },
      {
        name: "王鹤棣",
        feature: "锋利、饱满、适合强视觉冲击",
        colorsAndStyle: "纯黑、冰白、正红，适合皮质、挺括面料和高对比单品。",
        whyItFits: "冬型可以很有攻击力，王鹤棣这种高存在感气质和高对比色块配合度很高。",
      },
    ],
  },
};
