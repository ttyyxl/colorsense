# ColorSense

ColorSense 是面向中文用户的 AI 四季色彩诊断 Web App。用户上传正面照后，系统分析肤色特征，判断春 / 夏 / 秋 / 冬四季型，并输出色卡和风格建议。

## 当前阶段

本仓库目前完成阶段一 MVP 骨架：

- Next.js App Router 页面结构
- 首页、登录、上传、处理、结果、历史页面占位
- 四季型基础数据与 TypeScript 类型
- API Route 占位返回统一 JSON
- FastAPI 推理服务骨架
- 环境变量模板

## 目录结构

```text
src/
  app/
    page.tsx
    auth/page.tsx
    upload/page.tsx
    processing/page.tsx
    result/[id]/page.tsx
    history/page.tsx
    api/
  components/
  lib/
inference_service/
```

## 本地运行

前端：

```bash
npm install
npm run dev
```

Python 推理服务：

```bash
cd inference_service
python -m venv venv
pip install -r requirements.txt
uvicorn main:app --reload
```

## 环境变量

复制 `.env.local` 并填入真实服务配置：

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
INFERENCE_SERVICE_URL=http://localhost:8000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 下一步

1. 接入 Supabase Auth。
2. 完成照片上传到 Supabase Storage。
3. 将 `/api/diagnose` 连接 FastAPI 服务。
4. 接入 Claude API 生成中文风格文案。
5. 完成分享卡片下载和历史记录 CRUD。
