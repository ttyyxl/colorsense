import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import {
  analyzeSeasonWithDoubao,
  prepareVisionImage,
  readVisionConfigFromEnv,
  normalizeArkCompletion,
  VISION_DEFAULTS,
  VISION_THINKING_DISABLED,
  VisionError,
  type VisionCompletionRequest,
} from "../src/lib/doubao-vision.ts";

const projectRoot = resolve(process.cwd());
const pngBuffer = new Uint8Array(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  ),
);

const testConfig = {
  apiKey: "unit-test-key",
  modelId: "unit-test-model",
  baseURL: "https://example.invalid/v3",
  timeoutMs: 1000,
  enabled: true,
};

const validObject = {
  season_scores: { spring: 0.15, summer: 0.55, autumn: 0.1, winter: 0.2 },
  most_likely_season: "summer",
  skin_undertone: "cool",
  brightness: "light",
  saturation: "soft",
  feature_contrast: "low",
  lighting_warning: false,
  filter_warning: false,
  can_judge_reliably: true,
  reason: "观察到肤色偏冷白、整体明度较高，瞳色与肤色对比柔和，据此推断为夏季型。",
};
const validContent = JSON.stringify(validObject);

function silent<T>(fn: () => Promise<T>): Promise<T> {
  const info = console.info;
  const error = console.error;
  console.info = () => {};
  console.error = () => {};
  return fn().finally(() => {
    console.info = info;
    console.error = error;
  });
}

test("successful mocked call returns validated result and call metadata", async () => {
  let captured: VisionCompletionRequest | undefined;
  const result = await silent(() =>
    analyzeSeasonWithDoubao(pngBuffer, "image/png", {
      config: testConfig,
      completionFn: async (request) => {
        captured = request;
        return { content: validContent, usage: null };
      },
    }),
  );

  assert.equal(result.result.most_likely_season, "summer");
  assert.equal(result.meta.modelId, "unit-test-model");
  assert.equal(result.meta.attempts, 1);
  assert.equal(result.meta.responseFormat, "json_schema");
  assert.equal(result.meta.usage.source, "unavailable");
  assert.equal(result.meta.usage.total_tokens, null);

  assert.ok(captured);
  assert.equal(captured.response_format.type, "json_schema");
  assert.equal(captured.messages[0].role, "system");
  const userParts = captured.messages[1];
  assert.equal(userParts.role, "user");
  if (userParts.role === "user") {
    const imagePart = userParts.content.find((part) => part.type === "image_url");
    assert.ok(imagePart && imagePart.type === "image_url");
    assert.ok(imagePart.image_url.url.startsWith("data:image/png;base64,"));
  }
});

test("season hints from color card self-test are appended as a weak prior", async () => {
  let captured: VisionCompletionRequest | undefined;
  await silent(() =>
    analyzeSeasonWithDoubao(pngBuffer, "image/png", {
      config: testConfig,
      seasonHints: ["spring", "autumn"],
      completionFn: async (request) => {
        captured = request;
        return { content: validContent, usage: null };
      },
    }),
  );

  const userParts = captured?.messages[1];
  assert.ok(userParts && userParts.role === "user");
  const textPart = userParts.content.find((part) => part.type === "text");
  assert.ok(textPart && textPart.type === "text");
  assert.ok(textPart.text.includes("弱先验"));
  assert.ok(textPart.text.includes("「春型」「秋型」"));
  assert.ok(textPart.text.includes("以照片为准"));
});

test("model refusal (can_judge_reliably=false) is a successful response and is never retried", async () => {
  let calls = 0;
  const refusalContent = JSON.stringify({
    ...validObject,
    can_judge_reliably: false,
    lighting_warning: true,
    filter_warning: true,
    reason: "照片经过明显的色彩处理，无法据此可靠判断季节型。",
  });
  const result = await silent(() =>
    analyzeSeasonWithDoubao(pngBuffer, "image/png", {
      config: testConfig,
      completionFn: async () => {
        calls += 1;
        return { content: refusalContent, usage: null };
      },
    }),
  );

  // 主动拒判是合法结构化响应：正常返回、不抛错、不触发任何重试。
  assert.equal(calls, 1);
  assert.equal(result.meta.attempts, 1);
  assert.equal(result.result.can_judge_reliably, false);
  assert.equal(result.result.lighting_warning, true);
  assert.equal(result.result.filter_warning, true);
});

test("missing API key / model id returns a configuration error", () => {  assert.throws(
    () => readVisionConfigFromEnv({}),
    (error: unknown) => error instanceof VisionError && error.code === "CONFIG_MISSING",
  );
  assert.throws(
    () => readVisionConfigFromEnv({ ARK_API_KEY: "only-key" }),
    (error: unknown) => error instanceof VisionError && error.code === "CONFIG_MISSING",
  );
});

test("API timeout is classified correctly and retried at most once", async () => {
  let calls = 0;
  await silent(async () => {
    await assert.rejects(
      () =>
        analyzeSeasonWithDoubao(pngBuffer, "image/png", {
          config: testConfig,
          sleep: async () => {},
          completionFn: async () => {
            calls += 1;
            const timeout = new Error("Request timed out");
            timeout.name = "TimeoutError";
            throw timeout;
          },
        }),
      (error: unknown) => {
        assert.ok(error instanceof VisionError);
        assert.equal(error.code, "TIMEOUT");
        return true;
      },
    );
  });
  assert.equal(calls, 2);
});

test("401 is classified as auth failure without retry", async () => {
  let calls = 0;
  await silent(async () => {
    await assert.rejects(
      () =>
        analyzeSeasonWithDoubao(pngBuffer, "image/png", {
          config: testConfig,
          completionFn: async () => {
            calls += 1;
            throw Object.assign(new Error("unauthorized"), { status: 401 });
          },
        }),
      (error: unknown) => error instanceof VisionError && error.code === "AUTH_FAILED",
    );
  });
  assert.equal(calls, 1);
});

test("invalid JSON response is rejected", async () => {
  await silent(async () => {
    await assert.rejects(
      () =>
        analyzeSeasonWithDoubao(pngBuffer, "image/png", {
          config: testConfig,
          completionFn: async () => ({ content: "{ this is not json", usage: null }),
        }),
      (error: unknown) => error instanceof VisionError && error.code === "INVALID_RESPONSE",
    );
  });
});

test("schema violation is rejected without leaking model content", async () => {
  const sentinel = "SENSITIVE_MODEL_CONTENT_SENTINEL";
  await silent(async () => {
    await assert.rejects(
      () =>
        analyzeSeasonWithDoubao(pngBuffer, "image/png", {
          config: testConfig,
          completionFn: async () => ({
            content: JSON.stringify({ ...validObject, debug_payload: sentinel }),
            usage: null,
          }),
        }),
      (error: unknown) => {
        assert.ok(error instanceof VisionError);
        assert.equal(error.code, "INVALID_RESPONSE");
        assert.ok(!error.message.includes(sentinel));
        assert.ok(error.fields?.includes("debug_payload"));
        return true;
      },
    );
  });
});

test("unsupported json_schema parameter falls back to json_object once", async () => {
  let calls = 0;
  const result = await silent(() =>
    analyzeSeasonWithDoubao(pngBuffer, "image/png", {
      config: testConfig,
      completionFn: async (request) => {
        calls += 1;
        if (request.response_format.type === "json_schema") {
          throw Object.assign(new Error("response_format json_schema is not supported"), { status: 400 });
        }
        return { content: validContent, usage: null };
      },
    }),
  );
  assert.equal(calls, 2);
  assert.equal(result.meta.attempts, 2);
  assert.equal(result.meta.responseFormat, "json_object");
  assert.equal(result.result.most_likely_season, "summer");
});

test("429 is retried once and then succeeds", async () => {
  let calls = 0;
  const result = await silent(() =>
    analyzeSeasonWithDoubao(pngBuffer, "image/png", {
      config: testConfig,
      sleep: async () => {},
      completionFn: async () => {
        calls += 1;
        if (calls === 1) throw Object.assign(new Error("rate limited"), { status: 429 });
        return { content: validContent, usage: { prompt_tokens: 10, completion_tokens: 5 } };
      },
    }),
  );
  assert.equal(calls, 2);
  assert.equal(result.meta.usage.source, "partial");
  assert.equal(result.meta.usage.prompt_tokens, 10);
  assert.equal(result.meta.usage.total_tokens, null);
});

test("image signature mismatch is rejected", async () => {
  await assert.rejects(
    () => prepareVisionImage(new Uint8Array(Buffer.from("not an image")), "image/jpeg"),
    (error: unknown) => error instanceof VisionError && error.code === "INVALID_IMAGE_DATA",
  );
  await assert.rejects(
    () => prepareVisionImage(pngBuffer, "image/webp"),
    (error: unknown) => error instanceof VisionError && error.code === "INVALID_IMAGE_DATA",
  );
});

test("disabled feature without injected client never creates a request", async () => {
  await silent(async () => {
    await assert.rejects(
      () =>
        analyzeSeasonWithDoubao(pngBuffer, "image/png", {
          config: { ...testConfig, enabled: false },
        }),
      (error: unknown) => error instanceof VisionError && error.code === "FEATURE_DISABLED",
    );
  });
});

test("test script dry-run performs no paid API request", () => {
  const tempDir = mkdtempSync(resolve(tmpdir(), "colorsense-vision-"));
  const imagePath = resolve(tempDir, "sample.png");
  try {
    writeFileSync(imagePath, Buffer.from(pngBuffer));
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", "./scripts/test-doubao-vision.ts", imagePath],
      { cwd: projectRoot, encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /\[dry-run\]/);
    assert.doesNotMatch(result.stdout, /\[live\]/);
    assert.match(result.stdout, /value hidden/);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

// --- 真实调用空内容问题的回归测试（全部离线） ---

test("request disables deep thinking and uses a sufficient output budget", async () => {
  let captured: VisionCompletionRequest | undefined;
  await silent(() =>
    analyzeSeasonWithDoubao(pngBuffer, "image/png", {
      config: testConfig,
      completionFn: async (request) => {
        captured = request;
        return { content: validContent };
      },
    }),
  );
  assert.ok(captured);
  assert.deepEqual(captured.thinking, VISION_THINKING_DISABLED);
  assert.equal(captured.thinking?.type, "disabled");
  assert.equal(captured.max_completion_tokens, VISION_DEFAULTS.maxCompletionTokens);
  assert.ok(captured.max_completion_tokens >= 2048);
  assert.equal(captured.response_format.type, "json_schema");
});

test("normalizeArkCompletion extracts safe diagnostics without any reasoning text", () => {
  const secretReasoning = "内部思考内容不应出现在任何输出中-SENSITIVE";
  const normalized = normalizeArkCompletion(
    {
      id: "chatcmpl-123",
      model: "doubao-seed-2-0-lite-260428",
      _request_id: "req-from-payload",
      choices: [
        {
          finish_reason: "stop",
          message: { content: "", reasoning_content: secretReasoning },
        },
      ],
      usage: {
        prompt_tokens: 1200,
        completion_tokens: 1024,
        total_tokens: 2224,
        completion_tokens_details: { reasoning_tokens: 1024 },
      },
    },
    200,
    "req-from-header",
  );

  assert.equal(normalized.content, "");
  assert.equal(normalized.diagnostics?.httpStatus, 200);
  assert.equal(normalized.diagnostics?.finishReason, "stop");
  assert.equal(normalized.diagnostics?.contentEmpty, true);
  assert.equal(normalized.diagnostics?.reasoningContentPresent, true);
  assert.equal(normalized.diagnostics?.reasoningContentLength, secretReasoning.length);
  assert.equal(normalized.diagnostics?.reasoningTokens, 1024);
  assert.equal(normalized.diagnostics?.promptTokens, 1200);
  assert.equal(normalized.diagnostics?.requestId, "req-from-header");
  assert.equal(normalized.diagnostics?.modelReturned, "doubao-seed-2-0-lite-260428");
  assert.equal(JSON.stringify(normalized).includes(secretReasoning), false);
});

test("empty content with finish_reason=length is reported as budget exhaustion", async () => {
  await silent(async () => {
    await assert.rejects(
      () =>
        analyzeSeasonWithDoubao(pngBuffer, "image/png", {
          config: testConfig,
          completionFn: async () => ({
            content: "",
            diagnostics: {
              httpStatus: 200,
              finishReason: "length",
              contentEmpty: true,
              contentLength: 0,
              reasoningContentLength: 900,
              reasoningTokens: 1024,
              requestId: "req-length",
            },
          }),
        }),
      (error: unknown) => {
        assert.ok(error instanceof VisionError);
        assert.equal(error.code, "INVALID_RESPONSE");
        assert.match(error.message, /budget exhausted|finish_reason=length/);
        assert.equal(error.diagnostics?.finishReason, "length");
        assert.equal(error.diagnostics?.reasoningTokens, 1024);
        assert.equal(error.diagnostics?.requestId, "req-length");
        return true;
      },
    );
  });
});

test("empty content with reasoning tokens reports deep-thinking hint", async () => {
  await silent(async () => {
    await assert.rejects(
      () =>
        analyzeSeasonWithDoubao(pngBuffer, "image/png", {
          config: testConfig,
          completionFn: async () => ({
            content: null,
            diagnostics: { finishReason: "stop", reasoningContentPresent: true, reasoningTokens: 800 },
          }),
        }),
      (error: unknown) => {
        assert.ok(error instanceof VisionError);
        assert.match(error.message, /deep-thinking/);
        assert.equal(error.diagnostics?.reasoningContentPresent, true);
        return true;
      },
    );
  });
});

test("successful response exposes safe diagnostics in meta and usage", async () => {
  const result = await silent(() =>
    analyzeSeasonWithDoubao(pngBuffer, "image/png", {
      config: testConfig,
      maxCompletionTokens: 4096,
      completionFn: async (request) => {
        assert.equal(request.max_completion_tokens, 4096);
        return normalizeArkCompletion(
          {
            choices: [{ finish_reason: "stop", message: { content: validContent, reasoning_content: "不应输出" } }],
            usage: {
              prompt_tokens: 100,
              completion_tokens: 200,
              total_tokens: 300,
              completion_tokens_details: { reasoning_tokens: 0 },
            },
          },
          200,
          "req-ok",
        );
      },
    }),
  );
  assert.equal(result.meta.response.finishReason, "stop");
  assert.equal(result.meta.response.httpStatus, 200);
  assert.equal(result.meta.response.contentEmpty, false);
  assert.equal(result.meta.response.requestId, "req-ok");
  assert.equal(result.meta.usage.reasoning_tokens, 0);
  assert.equal(result.meta.usage.source, "api_usage");
  assert.equal(JSON.stringify(result.meta).includes("不应输出"), false);
});

test("truncated JSON with finish_reason=length is never accepted as success", async () => {
  await silent(async () => {
    await assert.rejects(
      () =>
        analyzeSeasonWithDoubao(pngBuffer, "image/png", {
          config: testConfig,
          completionFn: async () => ({
            content: '{"season_scores":{"spring":0.2',
            diagnostics: { finishReason: "length", contentLength: 30, contentEmpty: false },
          }),
        }),
      (error: unknown) => {
        assert.ok(error instanceof VisionError);
        assert.equal(error.code, "INVALID_RESPONSE");
        assert.match(error.message, /finish_reason=length/);
        return true;
      },
    );
  });
});
