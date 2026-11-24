#!/usr/bin/env node
/**
 * 独立视觉诊断测试入口。
 *
 * 默认只做本地检查（配置存在性 + 图片格式/大小），不会发起任何付费 API 请求。
 * 只有显式传入 --live 才会调用一次豆包视觉模型。
 *
 * 本脚本不会：触发正式 /api/diagnose、写数据库、调用穿搭建议、保存原始照片、
 * 打印 API Key / Base64 / 图片内容。
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  analyzeSeasonWithDoubao,
  prepareVisionImage,
  readVisionConfigFromEnv,
  VisionError,
  type VisionResponseDiagnostics,
} from "../src/lib/doubao-vision.ts";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const envPath = resolve(projectRoot, ".env.local");

/** 最小 .env 解析器：只读取 KEY=VALUE，不做任何输出。 */
function parseEnvLocal(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const rawLine of content.split(/\r?\n/)) {
    let line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("export ")) line = line.slice(7).trim();
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

function applyEnvFromFile(env: Record<string, string>): void {
  const keys = [
    "ARK_API_KEY",
    "ARK_VISION_MODEL",
    "ARK_BASE_URL",
    "VISION_DIAGNOSIS_ENABLED",
  ];
  for (const key of keys) {
    if (env[key] !== undefined) process.env[key] = env[key];
  }
}

function guessMimeType(path: string): string | null {
  const ext = path.split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return null;
}

function printUsage(): void {
  console.log("用法:");
  console.log('  npm run test:vision -- "D:\\test-images\\face.jpg"          # 默认 dry-run，不产生费用');
  console.log('  npm run test:vision -- "D:\\test-images\\face.jpg" --live   # 显式授权后才发起真实 API 请求');
}

/**
 * 只打印安全的响应元数据：状态码、finish_reason、长度、token 计数、请求 ID。
 * 绝不打印 API Key、图片/Base64、原始思考内容、模型原始文本或用户画像。
 */
function printDiagnostics(label: string, d: VisionResponseDiagnostics): void {
  console.log(`[diagnostics:${label}] HTTP status:`, d.httpStatus ?? "n/a");
  console.log(`[diagnostics:${label}] finish_reason:`, d.finishReason ?? "n/a");
  console.log(`[diagnostics:${label}] content: empty=${d.contentEmpty} length=${d.contentLength}`);
  console.log(
    `[diagnostics:${label}] reasoning_content: present=${d.reasoningContentPresent} length=${d.reasoningContentLength}`,
  );
  console.log(`[diagnostics:${label}] tokens: prompt=${d.promptTokens ?? "n/a"} completion=${d.completionTokens ?? "n/a"} reasoning=${d.reasoningTokens ?? "n/a"} total=${d.totalTokens ?? "n/a"}`);
  console.log(`[diagnostics:${label}] model returned:`, d.modelReturned ?? "n/a");
  console.log(`[diagnostics:${label}] request id:`, d.requestId ?? "n/a");
}

function printConfigState(): void {
  try {
    const config = readVisionConfigFromEnv();
    console.log("[config] modelId:", config.modelId);
    console.log("[config] baseURL:", config.baseURL);
    console.log("[config] VISION_DIAGNOSIS_ENABLED:", config.enabled ? "true" : "false");
    console.log("[config] ARK_API_KEY: present (value hidden)");
  } catch (error) {
    if (error instanceof VisionError && error.code === "CONFIG_MISSING") {
      console.log("[config] INCOMPLETE:", error.message);
    } else {
      console.log("[config] INCOMPLETE: unable to read configuration");
    }
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const live = args.includes("--live");
  const imageArg = args.find((arg) => !arg.startsWith("--"));

  if (!imageArg) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  if (!existsSync(envPath)) {
    console.error("[error] 找不到项目根目录的 .env.local:", envPath);
    process.exitCode = 1;
    return;
  }
  applyEnvFromFile(parseEnvLocal(readFileSync(envPath, "utf8")));

  const imagePath = resolve(process.cwd(), imageArg);
  if (!existsSync(imagePath)) {
    console.error("[error] 图片文件不存在:", imagePath);
    process.exitCode = 1;
    return;
  }
  const mimeType = guessMimeType(imagePath);
  if (!mimeType) {
    console.error("[error] 仅支持 .jpg / .jpeg / .png / .webp 图片");
    process.exitCode = 1;
    return;
  }

  const imageBuffer = new Uint8Array(readFileSync(imagePath));
  const prepared = await prepareVisionImage(imageBuffer, mimeType);

  console.log("[image] mimeType:", prepared.mimeType);
  console.log("[image] bytes:", prepared.originalBytes, "->", prepared.sentBytes);
  console.log("[image] dimensions:", prepared.width ?? "unknown", "x", prepared.height ?? "unknown");
  console.log("[image] metadata stripped:", prepared.metadataStripped);
  console.log("[image] exif orientation:", prepared.orientation ?? "none", "applied:", prepared.orientationApplied);
  printConfigState();

  if (!live) {
    console.log("[dry-run] 本地检查完成；未发起任何 API 请求，未访问数据库。");
    console.log("[dry-run] 如需真实调用，请确认 VISION_DIAGNOSIS_ENABLED=true 后追加 --live。");
    printUsage();
    return;
  }

  console.log("[live] 发起 1 次真实视觉诊断请求 ...");
  const { result, meta } = await analyzeSeasonWithDoubao(imageBuffer, mimeType);

  console.log("[result] season diagnosis:");
  console.log(JSON.stringify(result, null, 2));
  console.log("[meta] call information:");
  console.log(
    JSON.stringify(
      {
        modelId: meta.modelId,
        durationMs: meta.durationMs,
        attempts: meta.attempts,
        responseFormat: meta.responseFormat,
        usage: meta.usage,
        image: meta.image,
      },
      null,
      2,
    ),
  );
  printDiagnostics("success", meta.response);
}

main().catch((error: unknown) => {
  if (error instanceof VisionError) {
    console.error(`[error] ${error.code}: ${error.message}`);
    console.error(`[error] status=${error.status ?? "n/a"} durationMs=${error.durationMs}`);
    if (error.diagnostics) printDiagnostics("failure", error.diagnostics);
  } else {
    console.error("[error] unexpected failure:", error instanceof Error ? error.name : "unknown");
  }
  process.exitCode = 1;
});
