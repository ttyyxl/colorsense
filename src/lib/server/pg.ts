/**
 * 服务端 PostgreSQL 访问层（仅可在 Node 运行时使用）。
 *
 * CloudBase PG 模式基于 PostgREST 暴露 HTTP 接口，使用服务端管理员密钥
 * （CLOUDBASE_APIKEY，role=service_role）访问，前端永远不直连数据库。
 */

const ENV_ID = process.env.NEXT_PUBLIC_CLOUDBASE_ENV_ID;
const API_KEY = process.env.CLOUDBASE_APIKEY;

export class PostgrestError extends Error {
  status: number;
  code?: string;
  details?: string;
  hint?: string;

  constructor(message: string, status: number, payload?: { code?: string; details?: string; hint?: string }) {
    super(message);
    this.name = "PostgrestError";
    this.status = status;
    this.code = payload?.code;
    this.details = payload?.details;
    this.hint = payload?.hint;
  }
}

export function isDatabaseConfigured() {
  return Boolean(ENV_ID && API_KEY);
}

function restBase() {
  if (!ENV_ID) {
    throw new Error("尚未配置 NEXT_PUBLIC_CLOUDBASE_ENV_ID，无法访问数据库。");
  }
  return `https://${ENV_ID}.api.tcloudbasegateway.com/v1/rdb/rest`;
}

type FilterValue = string | number | boolean | null;

/** `[列名, 操作符, 值]`，操作符遵循 PostgREST 语法：eq / neq / gt / gte / lt / lte / like / in / is */
export type Filter = [column: string, operator: string, value: FilterValue];

export interface QueryOptions {
  select?: string;
  filters?: Filter[];
  order?: string;
  limit?: number;
}

function buildQuery(options: QueryOptions) {
  const params = new URLSearchParams();
  if (options.select) {
    params.set("select", options.select);
  }
  for (const [column, operator, value] of options.filters ?? []) {
    const rendered = value === null ? "null" : String(value);
    params.append(column, `${operator}.${rendered}`);
  }
  if (options.order) {
    params.set("order", options.order);
  }
  if (typeof options.limit === "number") {
    params.set("limit", String(options.limit));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  prefer?: string[];
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!API_KEY) {
    throw new Error("尚未配置 CLOUDBASE_APIKEY，无法访问数据库。");
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${API_KEY}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (options.prefer?.length) {
    headers.Prefer = options.prefer.join(",");
  }

  const response = await fetch(`${restBase()}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store",
  });

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    const detail = (payload ?? {}) as { message?: string; code?: string; details?: string; hint?: string };
    throw new PostgrestError(
      detail.message ?? `数据库请求失败（${response.status}）`,
      response.status,
      { code: detail.code, details: detail.details, hint: detail.hint },
    );
  }

  return payload as T;
}

export async function pgSelect<T = Record<string, unknown>>(
  table: string,
  options: QueryOptions = {},
): Promise<T[]> {
  const rows = await request<T[]>(`/${table}${buildQuery(options)}`);
  return Array.isArray(rows) ? rows : [];
}

export async function pgSelectOne<T = Record<string, unknown>>(
  table: string,
  options: QueryOptions = {},
): Promise<T | null> {
  const rows = await pgSelect<T>(table, { ...options, limit: options.limit ?? 1 });
  return rows.length > 0 ? rows[0] : null;
}

export async function pgInsert<T = Record<string, unknown>>(
  table: string,
  rows: Record<string, unknown> | Record<string, unknown>[],
  options: { select?: string; onConflict?: string } = {},
): Promise<T[]> {
  const prefer = ["return=representation"];
  if (options.onConflict) {
    prefer.push("resolution=merge-duplicates");
  }
  const query = new URLSearchParams();
  if (options.select) {
    query.set("select", options.select);
  }
  if (options.onConflict) {
    query.set("on_conflict", options.onConflict);
  }
  const suffix = query.toString() ? `?${query.toString()}` : "";
  const payload = await request<T[]>(`/${table}${suffix}`, {
    method: "POST",
    body: Array.isArray(rows) ? rows : [rows],
    prefer,
  });
  return Array.isArray(payload) ? payload : [];
}

export async function pgUpsert<T = Record<string, unknown>>(
  table: string,
  rows: Record<string, unknown> | Record<string, unknown>[],
  options: { select?: string; onConflict: string },
): Promise<T[]> {
  return pgInsert<T>(table, rows, { select: options.select, onConflict: options.onConflict });
}

export async function pgUpdate<T = Record<string, unknown>>(
  table: string,
  filters: Filter[],
  patch: Record<string, unknown>,
  options: { select?: string } = {},
): Promise<T[]> {
  const payload = await request<T[]>(`/${table}${buildQuery({ select: options.select, filters })}`, {
    method: "PATCH",
    body: patch,
    prefer: ["return=representation"],
  });
  return Array.isArray(payload) ? payload : [];
}

export async function pgDelete<T = Record<string, unknown>>(
  table: string,
  filters: Filter[],
  options: { select?: string } = {},
): Promise<T[]> {
  const payload = await request<T[]>(`/${table}${buildQuery({ select: options.select, filters })}`, {
    method: "DELETE",
    prefer: ["return=representation"],
  });
  return Array.isArray(payload) ? payload : [];
}

export async function pgRpc<T = unknown>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  return request<T>(`/rpc/${fn}`, { method: "POST", body: args });
}

/** 按主键 id 过滤。 */
export function byId(id: string): Filter[] {
  return [["id", "eq", id]];
}

/** 按用户 id 过滤。 */
export function byUser(userId: string): Filter {
  return ["user_id", "eq", userId];
}
