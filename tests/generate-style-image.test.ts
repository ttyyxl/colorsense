import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import type { DiagnosisSnapshot, StyleImageConfig, StyleImageDeps } from "../src/app/api/generate-style-image/route.ts";

// 所有外部服务均通过依赖注入 Mock，不发起真实网络调用。
const ROOT = process.cwd();
const route = await import("../src/app/api/generate-style-image/route.ts");

const OWNER_ID = "user-owner";
const OTHER_ID = "user-other";
const DIAGNOSIS_ID = "123e4567-e89b-42d3-a456-426614174000";
const TEST_KEY = "test-image-key";

const PALETTE = ["#FFB5A7", "#FFC9A0", "#FFE5A0", "#C8F0C0", "#B0D8FF", "#FFD4E8"];

function baseConfig(overrides: Partial<StyleImageConfig> = {}): StyleImageConfig {
  return {
    enabled: true,
    apiKey: TEST_KEY,
    baseUrl: "https://ark.example.com/api/v3",
    model: "doubao-seedream-5-0-flash-260915",
    size: "2816x1584",
    timeoutMs: 5000,
    ...overrides,
  };
}

function baseRecord(overrides: Partial<DiagnosisSnapshot> = {}): DiagnosisSnapshot {
  return {
    userId: OWNER_ID,
    seasonType: "spring",
    colorPalette: PALETTE,
    labFeatures: { L: 62, a: 7, b: 12 },
    ...overrides,
  };
}

interface HarnessOptions {
  config?: Partial<StyleImageConfig>;
  record?: Partial<DiagnosisSnapshot> | null;
  authenticated?: boolean;
  upstream?: (url: string, init: RequestInit) => Promise<Response>;
}

function makeHarness(options: HarnessOptions = {}) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const diagnosisLoads: Array<{ diagnosisId: string; uid: string }> = [];
  const upstream =
    options.upstream ??
    (async () =>
      new Response(JSON.stringify({ data: [{ url: "https://cdn.example.com/style.png" }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }));

  const deps: StyleImageDeps = {
    authenticate: async () => (options.authenticated === false ? null : { uid: OWNER_ID }),
    loadDiagnosis: async (diagnosisId, uid) => {
      diagnosisLoads.push({ diagnosisId, uid });
      return options.record === undefined ? baseRecord() : options.record;
    },
    fetchImpl: async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return upstream(url, init);
    },
    config: baseConfig(options.config),
    now: () => Date.now(),
  };

  return { deps, calls, diagnosisLoads };
}

function post(body: unknown): Request {
  return new Request("https://colorsense.app/api/generate-style-image", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const REFERENCE_IMAGE = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a";

/* ------------------------------------------------------------------ */
/* 鉴权与归属                                                          */
/* ------------------------------------------------------------------ */

test("未授权用户无法调用付费生图接口", async () => {
  route.POST.testHooks.resetStyleImageRateLimit();
  const { deps, calls } = makeHarness({ authenticated: false });
  const res = await route.POST.testHooks.handleGenerateStyleImage(post({ diagnosisId: DIAGNOSIS_ID }), deps);
  assert.equal(res.status, 401);
  assert.equal(calls.length, 0);
});

test("无法访问他人诊断记录时拒绝生成", async () => {
  route.POST.testHooks.resetStyleImageRateLimit();
  const { deps, calls } = makeHarness({ record: baseRecord({ userId: OTHER_ID }) });
  const res = await route.POST.testHooks.handleGenerateStyleImage(post({ diagnosisId: DIAGNOSIS_ID }), deps);
  assert.equal(res.status, 403);
  assert.equal(calls.length, 0);
});

test("诊断记录不存在时返回 404", async () => {
  route.POST.testHooks.resetStyleImageRateLimit();
  const { deps, calls } = makeHarness({ record: null });
  const res = await route.POST.testHooks.handleGenerateStyleImage(post({ diagnosisId: DIAGNOSIS_ID }), deps);
  assert.equal(res.status, 404);
  assert.equal(calls.length, 0);
});

/* ------------------------------------------------------------------ */
/* 诊断状态机                                                          */
/* ------------------------------------------------------------------ */

// Phase 3.3：只有硬阻断状态（RETAKE_REQUIRED / FAILED）不产出有效季型结果，禁止生图。
for (const status of ["RETAKE_REQUIRED", "FAILED"]) {
  test(`${status} 状态不会绕过限制生成推荐图卡`, async () => {
    route.POST.testHooks.resetStyleImageRateLimit();
    const { deps, calls } = makeHarness({
      record: baseRecord({
        diagnosisStatus: status,
        fusionDiagnosis: { version: "2.0", diagnosisStatus: status },
      }),
    });
    const res = await route.POST.testHooks.handleGenerateStyleImage(post({ diagnosisId: DIAGNOSIS_ID }), deps);
    assert.equal(res.status, 403);
    assert.equal(calls.length, 0);
  });
}

// Phase 3.3：低置信度不再阻断下游——已有合法季型结果即可生成个性化图卡。
for (const status of ["UNCERTAIN", "DEGRADED"]) {
  test(`${status} 状态存在有效季型结果，允许继续生成推荐图卡`, async () => {
    route.POST.testHooks.resetStyleImageRateLimit();
    const { deps, calls } = makeHarness({
      record: baseRecord({
        diagnosisStatus: status,
        fusionDiagnosis: { version: "2.0", diagnosisStatus: status },
      }),
    });
    const res = await route.POST.testHooks.handleGenerateStyleImage(post({ diagnosisId: DIAGNOSIS_ID }), deps);
    assert.equal(res.status, 200);
    assert.equal(calls.length, 1);
  });
}

test("CONFIDENT 状态允许生成", async () => {
  route.POST.testHooks.resetStyleImageRateLimit();
  const { deps, calls } = makeHarness({
    record: baseRecord({ diagnosisStatus: "CONFIDENT", fusionDiagnosis: { version: "2.0", diagnosisStatus: "CONFIDENT" } }),
  });
  const res = await route.POST.testHooks.handleGenerateStyleImage(post({ diagnosisId: DIAGNOSIS_ID }), deps);
  assert.equal(res.status, 200);
  assert.equal(calls.length, 1);
});

test("老记录（无诊断状态字段）按 CONFIDENT 处理", async () => {
  route.POST.testHooks.resetStyleImageRateLimit();
  const { deps, calls } = makeHarness();
  const res = await route.POST.testHooks.handleGenerateStyleImage(post({ diagnosisId: DIAGNOSIS_ID }), deps);
  assert.equal(res.status, 200);
  assert.equal(calls.length, 1);
});

/* ------------------------------------------------------------------ */
/* 服务可用性与配置                                                    */
/* ------------------------------------------------------------------ */

test("缺少生图配置时返回服务不可用且不发起付费请求", async () => {
  route.POST.testHooks.resetStyleImageRateLimit();
  const { deps, calls } = makeHarness({ config: { apiKey: "" } });
  const res = await route.POST.testHooks.handleGenerateStyleImage(post({ diagnosisId: DIAGNOSIS_ID }), deps);
  assert.equal(res.status, 503);
  assert.equal(calls.length, 0);
});

test("生图开关关闭时返回服务不可用且不发起付费请求", async () => {
  route.POST.testHooks.resetStyleImageRateLimit();
  const { deps, calls } = makeHarness({ config: { enabled: false } });
  const res = await route.POST.testHooks.handleGenerateStyleImage(post({ diagnosisId: DIAGNOSIS_ID }), deps);
  assert.equal(res.status, 503);
  assert.equal(calls.length, 0);
});

/* ------------------------------------------------------------------ */
/* 输入校验                                                            */
/* ------------------------------------------------------------------ */

test("缺少 diagnosisId 时返回 400", async () => {
  route.POST.testHooks.resetStyleImageRateLimit();
  const { deps, calls } = makeHarness();
  const res = await route.POST.testHooks.handleGenerateStyleImage(post({}), deps);
  assert.equal(res.status, 400);
  assert.equal(calls.length, 0);
});

test("非法 diagnosisId 被拒绝", async () => {
  route.POST.testHooks.resetStyleImageRateLimit();
  const { deps, calls } = makeHarness();
  const res = await route.POST.testHooks.handleGenerateStyleImage(post({ diagnosisId: "../other/collection" }), deps);
  assert.equal(res.status, 400);
  assert.equal(calls.length, 0);
});

test("参考图格式非法时返回 400 且不发起付费请求", async () => {
  route.POST.testHooks.resetStyleImageRateLimit();
  const { deps, calls } = makeHarness();
  const res = await route.POST.testHooks.handleGenerateStyleImage(
    post({ diagnosisId: DIAGNOSIS_ID, image: "data:text/html;base64,PHNjcmlwdD4=" }),
    deps,
  );
  assert.equal(res.status, 400);
  assert.equal(calls.length, 0);
});

test("请求体过大时返回 413", async () => {
  route.POST.testHooks.resetStyleImageRateLimit();
  const { deps, calls } = makeHarness();
  const huge = "data:image/jpeg;base64," + "A".repeat(6 * 1024 * 1024);
  const res = await route.POST.testHooks.handleGenerateStyleImage(post({ diagnosisId: DIAGNOSIS_ID, image: huge }), deps);
  assert.equal(res.status, 413);
  assert.equal(calls.length, 0);
});

test("诊断记录中没有合法色卡时拒绝生成", async () => {
  route.POST.testHooks.resetStyleImageRateLimit();
  const { deps, calls } = makeHarness({ record: baseRecord({ colorPalette: ["not-a-color", "#GGG"] }) });
  const res = await route.POST.testHooks.handleGenerateStyleImage(post({ diagnosisId: DIAGNOSIS_ID }), deps);
  assert.equal(res.status, 422);
  assert.equal(calls.length, 0);
});

/* ------------------------------------------------------------------ */
/* 成功路径                                                            */
/* ------------------------------------------------------------------ */

test("生成成功时按 CloudBase UID 读取 PostgreSQL 诊断并透传参考照片", async () => {
  route.POST.testHooks.resetStyleImageRateLimit();
  const { deps, calls, diagnosisLoads } = makeHarness();
  const res = await route.POST.testHooks.handleGenerateStyleImage(
    post({ diagnosisId: DIAGNOSIS_ID, image: REFERENCE_IMAGE }),
    deps,
  );
  assert.equal(res.status, 200);
  assert.deepEqual(diagnosisLoads, [{ diagnosisId: DIAGNOSIS_ID, uid: OWNER_ID }]);
  const payload = (await res.json()) as { success: boolean; url: string; usedReference: boolean };
  assert.equal(payload.success, true);
  assert.equal(payload.url, "https://cdn.example.com/style.png");
  assert.equal(payload.usedReference, true);

  assert.equal(calls.length, 1);
  const init = calls[0].init as RequestInit & { headers: Record<string, string> };
  assert.equal(init.headers.Authorization, `Bearer ${TEST_KEY}`);
  assert.match(calls[0].url, /\/images\/generations$/);

  const body = JSON.parse(String(init.body));
  assert.equal(body.model, "doubao-seedream-5-0-flash-260915");
  assert.equal(body.size, "2816x1584");
  assert.equal(body.watermark, false);
  assert.equal(body.response_format, "url");
  assert.equal(body.image, REFERENCE_IMAGE);
  for (const color of PALETTE) {
    assert.ok(body.prompt.includes(color), `prompt 应包含色值 ${color}`);
  }
  assert.ok(body.prompt.includes("纯色"));
});

test("缺少参考图时安全降级为文生图", async () => {
  route.POST.testHooks.resetStyleImageRateLimit();
  const { deps, calls } = makeHarness();
  const res = await route.POST.testHooks.handleGenerateStyleImage(post({ diagnosisId: DIAGNOSIS_ID }), deps);
  assert.equal(res.status, 200);
  const payload = (await res.json()) as { usedReference: boolean };
  assert.equal(payload.usedReference, false);

  const init = calls[0].init as RequestInit & { headers: Record<string, string> };
  const body = JSON.parse(String(init.body));
  assert.equal(body.image, undefined);
  assert.ok(body.prompt.includes("不换脸"));
});

test("服务端以诊断记录为准，忽略客户端传入的颜色与季型", async () => {
  route.POST.testHooks.resetStyleImageRateLimit();
  const { deps, calls } = makeHarness();
  const res = await route.POST.testHooks.handleGenerateStyleImage(
    post({ diagnosisId: DIAGNOSIS_ID, colors: ["#000000"], season: "winter", labFeatures: { L: 1, a: 1, b: 1 } }),
    deps,
  );
  assert.equal(res.status, 200);
  const init = calls[0].init as RequestInit;
  const body = JSON.parse(String(init.body));
  assert.ok(body.prompt.includes("#FFB5A7"));
  assert.ok(!body.prompt.includes("#000000"));
  assert.ok(body.prompt.includes("春日清新"));
});

/* ------------------------------------------------------------------ */
/* 第三方异常处理                                                      */
/* ------------------------------------------------------------------ */

test("第三方失败时不向客户端透传敏感响应细节", async () => {
  route.POST.testHooks.resetStyleImageRateLimit();
  const { deps } = makeHarness({
    upstream: async () =>
      new Response(JSON.stringify({ error: { message: "invalid api key ark-secret-value" } }), {
        status: 401,
        headers: { "content-type": "application/json" },
      }),
  });
  const res = await route.POST.testHooks.handleGenerateStyleImage(post({ diagnosisId: DIAGNOSIS_ID }), deps);
  assert.equal(res.status, 502);
  const text = await res.text();
  assert.ok(!text.includes("ark-secret-value"));
  assert.ok(!text.includes("invalid api key"));
});

test("第三方返回空结果时返回 502", async () => {
  route.POST.testHooks.resetStyleImageRateLimit();
  const { deps } = makeHarness({
    upstream: async () => new Response(JSON.stringify({ data: [] }), { status: 200 }),
  });
  const res = await route.POST.testHooks.handleGenerateStyleImage(post({ diagnosisId: DIAGNOSIS_ID }), deps);
  assert.equal(res.status, 502);
});

test("请求超时时返回 504", async () => {
  route.POST.testHooks.resetStyleImageRateLimit();
  const { deps } = makeHarness({
    config: { timeoutMs: 20 },
    upstream: (_url, init) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        });
      }),
  });
  const res = await route.POST.testHooks.handleGenerateStyleImage(post({ diagnosisId: DIAGNOSIS_ID }), deps);
  assert.equal(res.status, 504);
});

/* ------------------------------------------------------------------ */
/* 频率限制                                                            */
/* ------------------------------------------------------------------ */

test("超过调用频率限制后返回 429", async () => {
  route.POST.testHooks.resetStyleImageRateLimit();
  const { deps, calls } = makeHarness();
  for (let index = 0; index < 5; index += 1) {
    const res = await route.POST.testHooks.handleGenerateStyleImage(post({ diagnosisId: DIAGNOSIS_ID }), deps);
    assert.equal(res.status, 200);
  }
  const res = await route.POST.testHooks.handleGenerateStyleImage(post({ diagnosisId: DIAGNOSIS_ID }), deps);
  assert.equal(res.status, 429);
  assert.equal(calls.length, 5);
});

/* ------------------------------------------------------------------ */
/* 纯函数                                                              */
/* ------------------------------------------------------------------ */

test("色卡只保留合法 hex 色值", () => {
  assert.deepEqual(route.POST.testHooks.pickPalette({ colorPalette: ["#FFB5A7", "bad", "#C8F0C0"] }), ["#FFB5A7", "#C8F0C0"]);
  assert.deepEqual(route.POST.testHooks.pickPalette({}), []);
});

test("参考图只接受 jpeg/png/webp 的 base64 data URL", () => {
  assert.equal(route.POST.testHooks.normalizeReferenceImage(REFERENCE_IMAGE).ok, true);
  assert.equal(route.POST.testHooks.normalizeReferenceImage("data:image/gif;base64,R0lGOD").ok, false);
  assert.equal(route.POST.testHooks.normalizeReferenceImage("not-a-data-url").ok, false);
  assert.equal(route.POST.testHooks.normalizeReferenceImage(undefined).ok, false);
});

test("base64 data URL 的 MIME 会被归一化为小写", () => {
  const result = route.POST.testHooks.normalizeReferenceImage("data:image/JPEG;base64," + "A".repeat(16));
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.ok(result.image.startsWith("data:image/jpeg;base64,"));
  }
});

test("提示词包含六种颜色与单色约束", () => {
  const prompt = route.POST.testHooks.buildPrompt(PALETTE, "spring", { L: 62, a: 7, b: 12 }, false);
  assert.ok(prompt.includes("第6张"));
  assert.ok(prompt.includes("单一纯色") || prompt.includes("一种纯色"));
  assert.ok(prompt.includes("春日清新"));
  // 图卡下方色卡标签必须使用中文颜色名。
  assert.ok(prompt.includes("简体中文"));
  assert.ok(prompt.includes("「浅红色系」") || prompt.includes("「中红色系」"));
});

/* ------------------------------------------------------------------ */
/* 密钥安全                                                            */
/* ------------------------------------------------------------------ */

test("新增代码中不存在硬编码 API Key", () => {
  const files = [
    "src/app/api/generate-style-image/route.ts",
    "src/components/StyleImageCard.tsx",
    "src/lib/client/uploaded-image.ts",
  ];
  for (const file of files) {
    const source = fs.readFileSync(path.join(ROOT, file), "utf8");
    assert.ok(!/ark-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(source), `${file} 不应包含硬编码密钥`);
    assert.ok(!/sk-[A-Za-z0-9]{16,}/.test(source), `${file} 不应包含硬编码密钥`);
  }
});
