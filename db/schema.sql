-- ============================================================
-- ColorSense × 腾讯云 CloudBase（PostgreSQL 模式）建表脚本
-- 使用方式：CloudBase 控制台 → 数据库 → SQL 编辑器 → 全量粘贴执行
-- 可重复执行（幂等）
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 1. 季型诊断记录（原 Firestore: diagnoses）
-- ------------------------------------------------------------
create table if not exists cs_diagnoses (
  id                  uuid primary key default gen_random_uuid(),
  user_id             text not null,
  season_type         text not null,
  confidence          double precision not null default 0,
  color_palette       text[] not null default '{}',
  style_keywords      text[] not null default '{}',
  avoid_colors        text[] not null default '{}',
  ai_description      text not null default '',
  lab_features        jsonb,
  source              text not null default 'model',
  scores              jsonb,
  face_detected       boolean,
  used_original_image boolean,
  face_confidence     double precision,
  ai_advice           jsonb,
  doubao_advice       jsonb,
  created_at          timestamptz not null default now()
);
create index if not exists cs_diagnoses_user_created_idx
  on cs_diagnoses (user_id, created_at desc);

-- ------------------------------------------------------------
-- 2. 用户（账号资料 + 风格问卷），原 Firestore: users/{uid}
--    与 users/{uid}/profile/questionnaire
-- ------------------------------------------------------------
create table if not exists cs_users (
  user_id                text primary key,
  email                  text not null default '',
  nickname               text not null default '',
  onboarding_completed   boolean not null default false,
  profile_version        integer not null default 2,
  profile                jsonb,
  generated_profile_advice jsonb,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 3. 穿搭灵感记录（原 Firestore: outfitRecords）
-- ------------------------------------------------------------
create table if not exists cs_outfit_records (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  request     jsonb not null default '{}'::jsonb,
  result      jsonb not null default '{}'::jsonb,
  source      text not null default 'mock',
  image_url   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists cs_outfit_records_user_created_idx
  on cs_outfit_records (user_id, created_at desc);

-- ------------------------------------------------------------
-- 4. 社区动态（原 Firestore: community_posts）
-- ------------------------------------------------------------
create table if not exists cs_community_posts (
  id          uuid primary key default gen_random_uuid(),
  uid         text not null,
  user_email  text not null default '',
  user_name   text not null default '',
  content     text not null,
  season_type text,
  tags        text[] not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists cs_community_posts_created_idx
  on cs_community_posts (created_at desc);

-- ------------------------------------------------------------
-- 5. 社区点赞（原 Firestore: community_posts/{id}/likes/{uid}）
-- ------------------------------------------------------------
create table if not exists cs_post_likes (
  post_id    uuid not null references cs_community_posts (id) on delete cascade,
  uid        text not null,
  user_email text not null default '',
  created_at timestamptz not null default now(),
  primary key (post_id, uid)
);
create index if not exists cs_post_likes_post_idx on cs_post_likes (post_id);

-- ------------------------------------------------------------
-- 6. 社区评论（原 Firestore: community_posts/{id}/comments）
-- ------------------------------------------------------------
create table if not exists cs_post_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references cs_community_posts (id) on delete cascade,
  uid        text not null,
  user_email text not null default '',
  user_name  text not null default '',
  content    text not null,
  created_at timestamptz not null default now()
);
create index if not exists cs_post_comments_post_created_idx
  on cs_post_comments (post_id, created_at asc);

-- ============================================================
-- 权限：全部业务数据只允许服务端（API Key / service_role）访问。
-- 前端一律通过 Next.js 的 /api/* 路由读写，不直连数据库。
-- ============================================================
alter table cs_diagnoses      enable row level security;
alter table cs_users          enable row level security;
alter table cs_outfit_records enable row level security;
alter table cs_community_posts enable row level security;
alter table cs_post_likes     enable row level security;
alter table cs_post_comments  enable row level security;

-- 显式放行 service_role（无论其是否具备 BYPASSRLS 都能访问）
do $$
declare
  t text;
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant usage on schema public to service_role';
    foreach t in array array[
      'cs_diagnoses', 'cs_users', 'cs_outfit_records',
      'cs_community_posts', 'cs_post_likes', 'cs_post_comments'
    ] loop
      execute format('grant all privileges on table %I to service_role', t);
      execute format(
        'drop policy if exists %I on %I',
        t || '_service_all', t
      );
      execute format(
        'create policy %I on %I for all to service_role using (true) with check (true)',
        t || '_service_all', t
      );
    end loop;

    execute 'grant usage, select on all sequences in schema public to service_role';
  end if;
end $$;
