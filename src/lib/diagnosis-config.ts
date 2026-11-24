/**
 * 第三阶段「动态权重与异常诊断」的阈值与参数集中管理。
 *
 * 重要声明：
 * - 以下数值均为开发阶段的初始实验配置，**尚未经过独立验证集校准**，不是科学验证结果。
 * - 禁止在其他文件中重复硬编码这些阈值；禁止为了让正常诊断比例变高而随意放宽。
 * - 未来调整应使用验证集选参，再用独立测试集评估，并记录实验依据。
 *
 * Phase 3.3「季型诊断决策机制优化」说明：
 * - 取消「最高融合评分必须达到 50% 才能确认季型」的业务限制。分数阈值只用于生成
 *   **不确定性提示**，不再决定是否返回季型。
 * - 只要图片通过必要的质量检测，且至少一个模型能给出合法有效的季型评分，就采用
 *   argmax 选取最终评分最高的季型。
 * - 诊断可信程度（CONFIDENT / UNCERTAIN / DEGRADED）与业务可执行性**解耦**：
 *   只有硬阻断场景（严重图像质量问题、两模型均不可用）才不产出季型。
 */

/** 季型顺序，与 vision-schema.ts / fusion.ts 保持一致。 */
export const SEASON_ORDER = ["spring", "summer", "autumn", "winter"] as const;

/** 分数比较容差，与 fusion.ts 的 TIE_EPSILON 一致，保证并列处理确定性。 */
export const SCORE_TIE_EPSILON = 1e-9;

/**
 * Phase 3.3 季型决策策略（业务规则，不含可调数值）。
 *
 * 这里只声明**规则**，不存放阈值；阈值仍在 UNCERTAINTY_THRESHOLDS 中集中管理，
 * 避免同一类参数散落在多个文件里。
 */
export const SEASON_DECISION_POLICY = {
  /**
   * 是否要求最高融合评分达到 minTopScore 才允许给出季型。
   * Phase 3.3 起为 false：分数不足只提示不确定性，不再阻断季型输出。
   */
  requireMinTopScoreForSeason: false,
  /**
   * 是否允许「至少一个模型给出合法评分」即确定季型。
   * true：单模型（CNN 或豆包）结果同样有效，豆包不得单方面否决有效的 CNN 判断。
   */
  allowSingleValidModel: true,
  /**
   * UNCERTAIN / DEGRADED 是否允许继续执行业务（展示季型、色板、画像、生成穿搭建议）。
   * true：可信程度只用于提示，不阻断业务链路。
   */
  allowUncertainExecution: true,
  /**
   * 硬阻断状态集合：这些状态下不产生任何季型，禁止生成虚假诊断结果。
   */
  blockingStatuses: ["RETAKE_REQUIRED", "FAILED"] as const,
} as const;

/**
 * 不确定性阈值（初始配置，待独立验证集校准）。
 *
 * Phase 3.3 起，这些阈值**只用于生成不确定性提示**（状态标记与风险信息），
 * 不再作为「是否返回季型结果」的门槛。
 */
export const UNCERTAINTY_THRESHOLDS = {
  /** 综合最高季型分数低于该值 → 记录不确定性提示（不再阻断季型输出）。 */
  minTopScore: 0.5,
  /** 融合结果第一名与第二名差距低于该值 → 明显分类模糊（记录不确定性提示）。 */
  minTopGap: 0.1,
  /** 两模型总变差距离达到该值 → 较大分布分歧（记录不确定性提示）。 */
  totalVariationDistance: 0.4,
  /** 单模型 top1-top2 差距低于该值 → 该模型自身区分度不足（记录不确定性提示）。 */
  minModelTopGap: 0.08,
} as const;

/** 不确定性阈值的可变副本类型；仅用于离线实验覆盖，生产默认取上面的常量。 */
export type UncertaintyThresholds = {
  -readonly [K in keyof typeof UNCERTAINTY_THRESHOLDS]: number;
};

/**
 * 诊断风险分层（Phase 3.2）。
 *
 * 每个诊断原因都归入唯一的风险等级、相关性分组与所属域：
 * - SOFT_WARNING：轻度质量/环境提示，保留但**不单独**阻止正式诊断。
 * - DECISIVE_RISK：足以影响诊断可信度，命中即进入 UNCERTAIN。
 *   Phase 3.3 起它**只影响诊断状态的可靠性标记**，不再阻断业务链路
 *   （仍会返回季型、色板、画像与穿搭建议，只是附带不确定性提示）。
 * - BLOCKING_ISSUE：无法支持可靠诊断，对应 RETAKE_REQUIRED / FAILED。
 *   这是**唯一**会阻断业务、且不得产出任何季型的等级。
 *
 * 分组的意义：同一分组内的多条风险高度相关，不应被重复计为「多项相互独立的
 * 风险」。例如 IMAGE_QUALITY_WARNING 与 DOUBAO_LIGHTING_WARNING 都属于
 * image-condition 组，多条同时出现并不代表更严重的可靠性问题。
 *
 * 域（domain）的意义：只有「图像侧风险」与「模型侧风险」同时出现时，才说明
 * 两个相互独立的因素同时影响了诊断可靠性；单纯的图像侧多条警告不算。
 */
export const DIAGNOSIS_RISK_CLASSIFICATION = {
  // ---- 阻断性异常：图像或服务无法支持可靠诊断 ----
  IMAGE_QUALITY_REJECT: { level: "BLOCKING_ISSUE", group: "blocking", domain: "blocking", escalates: false },
  ALL_MODELS_UNAVAILABLE: { level: "BLOCKING_ISSUE", group: "blocking", domain: "blocking", escalates: false },
  WEIGHT_NORMALIZATION_FAILED: { level: "BLOCKING_ISSUE", group: "blocking", domain: "blocking", escalates: false },
  NO_CLEAR_FACE: { level: "BLOCKING_ISSUE", group: "blocking", domain: "blocking", escalates: false },
  MULTIPLE_FACES: { level: "BLOCKING_ISSUE", group: "blocking", domain: "blocking", escalates: false },
  LOW_FACE_CONFIDENCE: { level: "BLOCKING_ISSUE", group: "blocking", domain: "blocking", escalates: false },
  RESOLUTION_TOO_LOW: { level: "BLOCKING_ISSUE", group: "blocking", domain: "blocking", escalates: false },
  OVEREXPOSED: { level: "BLOCKING_ISSUE", group: "blocking", domain: "blocking", escalates: false },
  UNDEREXPOSED: { level: "BLOCKING_ISSUE", group: "blocking", domain: "blocking", escalates: false },
  SEVERE_BLUR: { level: "BLOCKING_ISSUE", group: "blocking", domain: "blocking", escalates: false },

  // ---- 决定性风险：模型侧（只影响可靠性标记，不阻断业务） ----
  TOP_SCORE_BELOW_THRESHOLD: { level: "DECISIVE_RISK", group: "score-margin", domain: "model", escalates: false },
  TOP_GAP_BELOW_THRESHOLD: { level: "DECISIVE_RISK", group: "score-margin", domain: "model", escalates: false },
  MODEL_DISTRIBUTION_DISAGREEMENT: { level: "DECISIVE_RISK", group: "model-agreement", domain: "model", escalates: false },
  CNN_LOW_DISCRIMINATION: { level: "DECISIVE_RISK", group: "model-discrimination", domain: "model", escalates: false },
  DOUBAO_LOW_DISCRIMINATION: { level: "DECISIVE_RISK", group: "model-discrimination", domain: "model", escalates: false },
  /** 豆包 API 调用成功，但模型明确表示当前照片无法支持可靠判断（主动拒判）。 */
  DOUBAO_REFUSED: { level: "DECISIVE_RISK", group: "model-refusal", domain: "model", escalates: false },
  /** 仅一个模型可用（服务不可用/被禁用/网络异常等），属于服务降级。 */
  SINGLE_MODEL_DEGRADED: { level: "DECISIVE_RISK", group: "model-availability", domain: "model", escalates: false },
  /** 多项相互独立的风险同时命中（图像侧 + 模型侧）。 */
  MULTIPLE_INDEPENDENT_RISKS: { level: "DECISIVE_RISK", group: "risk-combination", domain: "model", escalates: false },

  // ---- 决定性风险：图像侧 ----
  /**
   * 严重颜色分布异常（channelCast >= channelCastSevere）。
   * 季型判断本质依赖颜色信息，颜色分布严重失衡时其结论不可作为正式结果；
   * 但这**不是**滤镜识别，也不能据此直接拒绝诊断，因此只降级为 UNCERTAIN。
   */
  SEVERE_COLOR_DISTORTION: { level: "DECISIVE_RISK", group: "color-processing", domain: "image", escalates: false },

  // ---- 普通软警告：图像侧 ----
  /** 质量等级为 WARNING 的通用标记；不参与「多项独立风险」升级。 */
  IMAGE_QUALITY_WARNING: { level: "SOFT_WARNING", group: "image-condition", domain: "image", escalates: false },
  /** info 级（轻度色偏）：在样本中接近普遍出现，不参与升级判定。 */
  POSSIBLE_COLOR_CAST: { level: "SOFT_WARNING", group: "image-condition", domain: "image", escalates: false },
  RESOLUTION_UNKNOWN: { level: "SOFT_WARNING", group: "image-condition", domain: "image", escalates: false },
  POSSIBLE_OVEREXPOSURE: { level: "SOFT_WARNING", group: "image-condition", domain: "image", escalates: true },
  POSSIBLE_UNDEREXPOSURE: { level: "SOFT_WARNING", group: "image-condition", domain: "image", escalates: true },
  POSSIBLE_BLUR: { level: "SOFT_WARNING", group: "image-condition", domain: "image", escalates: true },
  FACE_TOO_SMALL: { level: "SOFT_WARNING", group: "image-condition", domain: "image", escalates: true },
  /** 疑似较强色彩处理：尚未达到「严重颜色分布异常」，仅作软提示。 */
  SUSPECTED_COLOR_PROCESSING: { level: "SOFT_WARNING", group: "image-condition", domain: "image", escalates: true },
  LOCAL_PRECHECK_UNAVAILABLE: { level: "SOFT_WARNING", group: "image-condition", domain: "image", escalates: true },
  DOUBAO_LIGHTING_WARNING: { level: "SOFT_WARNING", group: "image-condition", domain: "image", escalates: true },
  DOUBAO_FILTER_WARNING: { level: "SOFT_WARNING", group: "image-condition", domain: "image", escalates: true },

  // ---- 普通软警告：模型侧 ----
  /** 两模型 Top-1 不一致但完整分布差异较小：单独出现时不阻止正式诊断。 */
  MODEL_TOP1_MISMATCH: { level: "SOFT_WARNING", group: "model-agreement", domain: "model", escalates: true },

  // ---- 历史兼容：Phase 3.1 记录中的「视觉模型不可靠」，等价于主动拒判 ----
  DOUBAO_UNRELIABLE: { level: "DECISIVE_RISK", group: "model-refusal", domain: "model", escalates: false },
} as const satisfies Record<string, RiskClassification>;

/** 风险分类条目类型。 */
export type RiskClassification = {
  level: "SOFT_WARNING" | "DECISIVE_RISK" | "BLOCKING_ISSUE";
  group: string;
  domain: "image" | "model" | "blocking";
  /** 软警告是否参与「多项相互独立风险」升级判定。 */
  escalates: boolean;
};

/**
 * 风险策略。
 *
 * - mode="layered"（生产默认）：软警告单独不触发 UNCERTAIN；只有决定性风险，
 *   或命中多个**相互独立**的风险分组时，才判为 UNCERTAIN。
 * - mode="legacy"：Phase 3.1 的旧规则（除 MODEL_TOP1_MISMATCH 外任何原因都判
 *   UNCERTAIN）。**仅用于离线对照复现历史结果，不得用于生产。**
 *
 * Phase 3.3 说明：无论哪种模式，风险策略只决定**诊断状态**（可信程度），
 * 不再决定是否返回季型或是否阻断业务。
 */
export const RISK_POLICY = {
  mode: "layered" as "layered" | "legacy",
  /**
   * 分层模式下，软警告需要同时命中多少个相互独立的风险分组才升级为决定性风险。
   * 默认 2：单一软警告不阻止诊断；「图像质量风险 + 模型分歧」这类跨组组合才升级。
   */
  softWarningGroupsToEscalate: 2,
} as const;

/** 风险策略的可变副本类型；仅用于离线实验覆盖。 */
export type RiskPolicyConfig = {
  mode: "layered" | "legacy";
  softWarningGroupsToEscalate: number;
};

/**
 * 动态权重调整限制（初始配置，待独立验证集校准）。
 */
export const WEIGHT_LIMITS = {
  /** 两模型都可用时，相对基准权重的最大单侧调整幅度。 */
  maxShiftPerModel: 0.1,
  /** 归一化容差：总和偏差小于该值即认为等于 1。 */
  sumTolerance: 1e-6,
} as const;

/**
 * 图像质量阈值（初始配置，待独立验证集校准）。
 *
 * 检测对象说明：
 * - Node 层没有可靠的人脸框，曝光/肤色区域使用「画面中心 40% 区域」作为人脸近似区，
 *   因此相关指标标记为近似值；无法可靠判断时返回 unknown，不默认通过。
 * - 滤镜/美颜/妆容无法从单张图片可靠识别，这里只给「疑似」风险提示，不作为硬性拒绝依据。
 */
export const IMAGE_QUALITY_THRESHOLDS = {
  /** CNN 模型输入的最小边长（像素）。 */
  minDimension: 224,
  /** 内部分析用的缩放边长（性能与精度折中）。 */
  analysisDimension: 256,
  /** 中心人脸近似区域占画面比例。 */
  centerRegionRatio: 0.4,

  /** 过曝：中心区域高亮截断像素比例达到该值 → REJECT。 */
  clippedBrightReject: 0.35,
  /** 过曝：中心区域高亮截断像素比例达到该值 → WARNING。 */
  clippedBrightWarning: 0.12,
  /** 欠曝：中心区域暗部截断像素比例达到该值 → REJECT。 */
  clippedDarkReject: 0.35,
  /** 欠曝：中心区域暗部截断像素比例达到该值 → WARNING。 */
  clippedDarkWarning: 0.12,
  /** 高亮截断判定亮度（0-255）。 */
  brightClipLevel: 248,
  /** 暗部截断判定亮度（0-255）。 */
  darkClipLevel: 8,

  /** 模糊：拉普拉斯方差低于该值 → REJECT（严重模糊）。 */
  laplacianVarianceReject: 45,
  /** 模糊：拉普拉斯方差低于该值 → WARNING。 */
  laplacianVarianceWarning: 110,

  /** 色偏：RGB 通道均值最大差（归一化到 0-1）达到该值 → WARNING。 */
  channelCastWarning: 0.11,
  /** 色偏：达到该值 → 高风险提示（仍不直接 REJECT）。 */
  channelCastHigh: 0.2,
  /**
   * 严重颜色分布异常：达到该值 → 颜色信息可靠性不足，诊断降级为 UNCERTAIN。
   *
   * 该阈值来自 Phase 3.2 离线标定（768 张受控样本）：受控强色彩处理变体
   * 63/64 命中，原始样本仅 3/64 命中（约原始分布的 95 分位）。
   * **它不是滤镜识别阈值**，也不构成拒绝依据，仅用于决定
   * 「颜色信息是否足以支撑正式季型结论」。
   */
  channelCastSevere: 0.3,

  /** 人脸置信度下限，与 inference_service/face_detector.py 的 MIN_FACE_CONFIDENCE 对齐。 */
  minFaceConfidence: 0.8,
  /** 人脸框面积占比下限，低于该值视为人脸过小。 */
  minFaceAreaRatio: 0.03,

  /** 整体质量评分分级的边界。 */
  overallQualityRejectBelow: 0.4,
  overallQualityWarningBelow: 0.7,
} as const;

/** 图像质量阈值的可变副本类型；仅用于离线实验覆盖，生产默认取上面的常量。 */
export type ImageQualityThresholds = {
  -readonly [K in keyof typeof IMAGE_QUALITY_THRESHOLDS]: number;
};

/** 所有阈值的校准状态说明，供文档与响应元信息引用。 */
export const THRESHOLD_CALIBRATION_NOTE =
  "所有阈值均为开发阶段初始配置，尚待独立验证集校准；不代表已验证的准确率。";
