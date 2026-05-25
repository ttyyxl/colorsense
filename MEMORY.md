# ColorSense Development Memory

## 1. 项目基本信息

- 项目名称：ColorSense
- 项目定位：面向中文用户的 AI 四季色彩诊断 Web App
- 前端技术栈：Next.js 14 + TypeScript + Tailwind CSS
- AI 推理服务：FastAPI
- 当前开发目标：完成注册登录、上传诊断、结果展示、历史记录、结果下载的 MVP 流程

## 2. 当前最终技术路线

### 认证

- 认证系统：Firebase Authentication
- 支持邮箱 + 密码注册
- 注册后由 Firebase 自动发送邮箱验证邮件
- 支持邮箱 + 密码登录
- 邮箱密码用户未完成邮箱验证时，不允许进入受保护功能
- 支持 Google OAuth 登录
- 支持退出登录和登录状态保持
- 当前代码由 `AuthProvider` / `useAuth` 维护认证状态，`ProtectedRoute` 保护业务页面

### 数据库

- 数据库：Cloud Firestore
- 用途：保存用户诊断历史和诊断结果
- 当前诊断记录由登录用户在前端写入 Firestore，Firestore Security Rules 负责限制只能访问本人数据

### AI 推理

- 继续保留 FastAPI 推理服务
- Next.js 的 `/api/diagnose` 接收图片并调用 FastAPI
- FastAPI 返回 `season`、`confidence`、`lab_features` 等推理结果
- Next.js 结合 `src/lib/seasons.ts` 生成完整的色卡、关键词、避免色和基础风格建议
- 前端将完整诊断结果写入 Firestore
- FastAPI 不可用或未配置时，当前 API 保留 mock fallback，并在数据中以 `source: "mock"` 标记

### 图片与结果导出

- V1 不强制使用云端图片存储
- 上传图片只用于当前诊断请求和浏览器本地预览
- 历史记录只保存必要诊断结果数据，不保存原图
- 结果导出为用户本地下载
- 当前使用 `html2canvas` 下载 PNG 结果卡片
- 不发送结果邮件

## 3. 已完成内容

- 新增 `src/lib/firebase.ts`，初始化 Firebase App，并提供 Auth 与 Firestore 实例。
- 新增 `src/components/AuthProvider.tsx` 与 `src/lib/useAuth.ts`，维护 `currentUser`、`loading`、`isAuthenticated`、`logout`。
- 新增 `src/components/ProtectedRoute.tsx`，保护 `/upload`、`/processing`、`/result`、`/history`。
- 登录页已改为 Firebase 邮箱注册、邮箱验证、邮箱登录和 Google 登录流程。
- 导航栏已切换为 Firebase 退出登录。
- 新增 `src/lib/firestore-diagnoses.ts`，实现诊断记录写入、查询、详情读取和删除。
- `/api/diagnose` 已停止写入 Supabase/上传云端图片，只负责 FastAPI 推理或 mock fallback。
- 上传页会将诊断结果写入当前用户的 Firestore 记录后跳转结果页。
- 结果页已从 Firestore 加载当前用户记录，显示季型、置信度、推荐色卡、避免色、风格建议和生成时间。
- 结果页保留并使用 PNG 本地下载功能。
- 历史页已从 Firestore 查询当前用户记录，并支持查看详情和删除本人记录。
- 新增 `firestore.rules`，限制已验证邮箱用户或 Google 登录用户只能操作自己的 `diagnoses` 文档。
- `.env.example` 和 `README.md` 已更新为 Firebase/Firestore 技术路线。
- 最近验证结果：`npm run lint` 通过、`npm run build` 通过、开发服务器可启动并响应 `/login` 与 `/upload`。

## 4. 已废弃或停止使用的方案

以下方案不再作为当前主流程使用：

- Supabase Auth
- Supabase 数据库与 Supabase Storage
- Resend 邮箱验证码
- SMTP 邮件发送
- 手机号验证
- 自建 6 位邮箱验证码注册流程
- 购买域名作为注册邮件发送的必要条件

原因：

- Supabase 连接在当前开发过程中不够稳定。
- Resend 在不购买或验证域名时无法稳定向任意用户发送验证码。
- 手机号验证通常不是免费且稳定的大作业 MVP 方案。
- Firebase Auth 可直接支持邮箱验证邮件与 Google 登录，更适合当前 MVP。

代码状态说明：

- 旧 Supabase、Resend、SMTP 和验证码相关文件为避免删除风险而保留，并已标记或视为 deprecated。
- 旧 `/api/auth/*`、`/api/email-result` 和 `/api/diagnoses/*` 接口不再执行旧功能，只返回废弃提示。
- 不要在新开发中重新连接这些旧方案。

## 5. Firebase 需要配置的内容

Firebase Console 中需要完成：

1. 创建 Firebase 项目。
2. 添加 Web App，并复制 Web 配置。
3. 开启 Authentication。
4. 开启 `Email/Password` 登录。
5. 关闭 Email link 无密码登录，不使用该流程。
6. 开启 Google 登录。
7. 创建 Cloud Firestore 数据库。
8. 将项目根目录 `firestore.rules` 发布为 Firestore Security Rules。

`.env.local` 需要填写：

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

INFERENCE_SERVICE_URL=http://localhost:8000
```

不要提交 `.env.local`。

## 6. Firestore 数据结构

- Collection：`diagnoses`
- Document 路径：`diagnoses/{diagnosisId}`

字段：

```text
id
userId
createdAt
seasonType
confidence
labFeatures
aiDescription
colorPalette
styleKeywords
avoidColors
source
scores
```

访问约束：

- 历史记录页只查询当前 `userId` 的数据。
- 结果页根据 `diagnosisId` 读取单条数据，并验证归属当前用户。
- 删除记录时只能删除当前用户自己的记录。
- Firestore rules 要求邮箱用户已验证，或使用 Google provider 登录。

## 7. 主要功能状态

### Firebase 初始化

- 文件：`src/lib/firebase.ts`
- 状态：已实现，导出 `auth` 和 `db`；未填 Firebase 配置时不会在构建期间抛错。

### 认证页面

- 页面：`/login`，兼容入口 `/auth` 和 `/register` 会跳转到登录页。
- 状态：已实现邮箱注册、Firebase 验证邮件、邮箱登录、Google 登录、中文错误提示和 loading 状态。
- 规则：邮箱登录用户必须验证邮箱后才能进入上传与诊断流程。

### 登录状态管理

- 文件：`src/components/AuthProvider.tsx`、`src/lib/useAuth.ts`
- 状态：已实现 `currentUser`、`loading`、`isAuthenticated`、`logout`。

### 路由保护

- 文件：`src/components/ProtectedRoute.tsx`
- 页面：`/upload`、`/processing`、`/result`、`/history`
- 状态：已实现客户端保护；未登录或邮箱未验证用户被转到 `/login`，Google 用户直接放行。

### 诊断流程

- 用户上传图片后调用 `/api/diagnose`。
- Next.js 调用 FastAPI；失败时可使用 mock fallback。
- 返回结果结合 `seasons.ts` 组成完整诊断数据。
- `UploadZone` 将数据写入 Firestore，随后跳转 `/result/[id]`。

### 结果页

- 状态：已改为从 Firestore 读取本人诊断结果。
- 展示：季型、置信度、推荐色卡、避免色、风格建议、生成时间。
- 下载：`html2canvas` 生成 PNG，仅保存到本地，不发送邮件。

### 历史页

- 状态：已改为从 Firestore 查询当前用户诊断记录。
- 展示：诊断时间、季型、置信度、色卡缩略图。
- 支持进入详情页和删除本人记录。

## 8. 下次 CLI 启动时的工作方式

- 每次开始工作前，先读取项目根目录的 `MEMORY.md` 和 `README.md`。
- 以 Firebase Auth + Firestore + FastAPI + 本地 PNG 下载作为唯一当前技术路线。
- 不要重新使用 Supabase、Resend、SMTP 或手机号验证。
- 如果发现代码与 `MEMORY.md` 不一致，先指出差异，再询问是否需要按 `MEMORY.md` 修正。
- 当前工作区可能包含尚未提交的技术路线改造文件；不要回退用户已有修改。

## 9. 当前下一步任务

Firebase 和 Firestore 主流程代码已经完成替换，下一步应优先进行真实 Firebase 联调：

1. 用户在 Firebase Console 完成 Authentication、Google Provider、Firestore 与 Security Rules 配置。
2. 用户在 `.env.local` 填入真实 Firebase Web App 配置，并重启开发服务器。
3. 实测邮箱注册、邮箱验证后登录、Google 登录与退出。
4. 实测上传诊断、FastAPI 可用与 mock fallback 两种路径、结果下载、历史查看和删除。
5. 联调稳定后，评估是否在用户明确授权后移动 deprecated 的 Supabase/Resend/SMTP 文件到回收目录，并从依赖中彻底清理旧包。
6. 如需要服务端级别的路由/API 强校验，再引入 Firebase Admin session 或 ID token 验证；当前 MVP 通过客户端路由保护和 Firestore Security Rules 保障数据访问。
