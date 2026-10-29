# 커플 공유 캘린더 앱 — 개발 계획서 (v0.1)

> 작성일: 2026-10-29
> 상태: **초안.** 아래 SQL, 플러그인 이름, 정책은 제 지식 기준이라 **구현 전에 공식 문서로 대조 검증이 필요**합니다. 검증이 필요한 항목은 `[검증 필요]`로 표시했습니다.

---

## 0-0. 범위 변경 (2026-10-29): 웹 우선 + Vercel 배포

- 당분간 **웹 앱만** 만듭니다. Capacitor 앱 래핑과 앱 배포(Phase 3, 5)는 **보류**하고, 웹이 안정된 뒤 다시 판단합니다.
- 배포: **Vercel(프론트) + Supabase(백엔드)**

### 웹 전용일 때 기능별 영향

| 기능 | 웹 전용에서의 상태 |
|---|---|
| 공유 캘린더, 사진 업로드/다운로드, 찌르기 | 그대로 가능 (사진 다운로드는 앱보다 오히려 단순) |
| **기기 캘린더 가져오기** | **웹에서는 직접 불가능.** 대안: ① `.ics` 파일 가져오기(캘린더 앱에서 내보낸 파일을 업로드) ② 구글 캘린더 API 연동(OAuth 권한 범위와 미검증 앱 경고 등 확인 필요 `[검증 필요]`). 원래 의도한 "폰 캘린더 직접 읽기"는 앱 단계로 보류 |
| **알림 (7/3/1/0일 전), 찌르기 알림** | **푸시가 가장 큰 변수.** Web Push는 안드로이드 Chrome에서는 가능하지만, iOS는 홈 화면에 추가한 웹앱(PWA)에서만 가능한 것으로 알고 있습니다 `[검증 필요]`. 대안/병행: 이메일 알림, 앱 내 알림 배지. 이 때문에 **Q1(기기 종류)은 웹 단계에서도 중요**합니다 |
| 구글/카카오 로그인 | 앱 WebView 문제는 사라짐. 대신 운영 도메인 Redirect URI 등록 필요 |

### Vercel 배포 체크리스트

- [ ] Vite SPA는 `vercel.json`의 rewrites 설정이 없으면 **새로고침/직접 URL 접속 시 404**가 납니다.
- [ ] 환경변수 중 `VITE_` 접두사 값은 **브라우저에 그대로 노출**됩니다. anon key만 넣고, **service role 키는 절대 프론트 환경변수에 넣지 않습니다** (Edge Function 등 서버 측에서만).
- [ ] Supabase Auth의 Site URL / Redirect URLs에 운영 도메인을 등록하고, 구글/카카오 콘솔에는 Supabase 콜백 URL을 등록합니다. Vercel 프리뷰 URL은 배포마다 바뀌므로 와일드카드 허용 방식을 확인합니다 `[검증 필요]`.
- [ ] 스케줄러는 계획서의 `pg_cron + Edge Function` 방식을 유지하는 편이 단순합니다. Vercel Cron은 플랜별 실행 횟수 제한이 있습니다 `[검증 필요]`.
- [ ] Vercel 무료(Hobby) 플랜의 사용 범위(개인/비상업 용도) 약관을 확인합니다 `[검증 필요]`.
- [ ] **"비공개"가 아닙니다.** Vercel URL은 누구나 접속할 수 있고, 가입 화면이 열려 있으면 아무나 계정을 만들 수 있습니다. RLS가 데이터는 막아 주지만, 두 사람이 연결을 마치면 **신규 가입을 막거나 제한**하세요 (Supabase 설정 방법 확인 `[검증 필요]`).

---

## 0. 확정된 요구사항

| 항목 | 내용 |
|---|---|
| 형태 | 웹 앱 + 하이브리드 앱 (React + Capacitor) |
| 사용자 | 2명 (1:1 연결) |
| 배포 | 비공개 (스토어 정식 출시 안 함) |
| 인증 | 회원가입, 구글 SSO, 카카오 SSO |
| 핵심 기능 | ① 공유 캘린더 ② 날짜별 사진 업로드/다운로드 ③ 기기 캘린더 일정 가져오기 ④ 일정 알림 (7일 전 / 3일 전 / 1일 전 / 당일) ⑤ 찌르기 (하루 1회) |

### 미확정 항목 (Phase 0에서 확정)

| # | 질문 | 영향 |
|---|---|---|
| Q1 | **두 사람의 기기: 아이폰 / 안드로이드?** | 비용, Mac 필요 여부, 푸시 설정 범위 (3장 참고) |
| Q2 | 연결 해제 시 데이터 처리 정책 | RLS 설계 (6장 참고) |
| Q3 | 일정 알림 수신자: 둘 다 / 작성자 제외 상대만 | 알림 로직 |
| Q4 | 알림 발송 시각 (제안: 매일 오전 9시 KST) | 스케줄러 설정 |
| Q5 | 기기 캘린더 가져오기: 선택 일정 **복사** (제안) vs 지속 동기화 | 난이도가 크게 달라짐 |

---

## 1. 기술 스택

| 영역 | 선택 | 비고 |
|---|---|---|
| 프론트 | React + TypeScript + Vite | 웹에서 먼저 개발/테스트 |
| 앱 래핑 | Capacitor | 웹 코드를 iOS/Android로 감쌈 |
| 백엔드 | Supabase (Auth, Postgres, Storage, Realtime, Edge Functions) | |
| 푸시 | FCM (Android) / APNs (iOS, FCM 경유 가능) | `[검증 필요]` Capacitor 푸시 플러그인의 현재 권장 구성 |
| 스케줄러 | Supabase `pg_cron` + Edge Function | `[검증 필요]` 플랜별 지원 여부 |

**대안과 비교:** React Native(Expo)는 네이티브 UX가 낫지만 웹과 코드가 분리됩니다. "웹 앱 하이브리드" 요구와 React 경험을 고려해 Capacitor를 1순위로 잡았습니다.

---

## 2. 기능별 리스크 (구현 전에 반드시 검증)

### 2-1. 기기 캘린더 가져오기
- 웹/PWA만으로는 **불가능**합니다. 네이티브 캘린더 플러그인이 필요합니다.
- 플러그인은 유지보수 상태와 iOS 17 이상의 캘린더 권한 방식(전체 접근 vs 쓰기 전용)을 확인해야 합니다. `[검증 필요]`
- MVP는 **선택한 일정을 앱 DB로 복사**합니다. 이때 중복 가져오기를 막기 위해 `source_uid`(기기 일정 ID)로 중복 체크합니다.
- 양방향 동기화는 MVP에서 제외합니다.

### 2-2. 알림
- 기본안: **서버 스케줄링 + 푸시.** 매일 정해진 시각에 서버가 대상 일정을 찾아 발송합니다. 찌르기에도 푸시 인프라가 필요하므로 어차피 구축해야 합니다.
- 보조안(선택): 기기 로컬 알림. 오프라인에서도 동작하지만, 일정이 수정될 때마다 재예약 로직이 필요해서 MVP에서는 제외합니다.
- 중복 발송 방지: `reminder_log`의 유니크 제약으로 처리합니다.
- 시간대: KST 고정. `profiles.timezone` 컬럼은 두되 MVP에서는 사용하지 않습니다.

### 2-3. 사진
- 클라이언트에서 **리사이즈/압축 후 업로드**, 썸네일은 따로 저장합니다.
- 버킷은 **비공개**, 접근은 서명 URL로만 합니다.
- 앱(WebView)에서의 "다운로드"는 웹과 동작이 다릅니다. 기기 앨범에 저장하려면 네이티브 플러그인(파일시스템/미디어 저장)이 필요합니다. `[검증 필요]`

### 2-4. 소셜 로그인 (앱 환경)
- 구글은 앱 내장 WebView에서 OAuth를 막습니다. **웹에서 되는 방식이 앱에서는 실패할 수 있습니다.**
- 해결 방향: ① 네이티브 구글 로그인 플러그인으로 ID 토큰을 받아 Supabase에 전달 / ② 시스템 브라우저 + 딥링크 복귀. 실기기로 검증합니다. `[검증 필요]`
- 카카오는 Supabase의 카카오 OAuth 지원 여부와 **동의항목(이메일 제공 조건)** 을 카카오 개발자 콘솔에서 직접 확인합니다. `[검증 필요]` 이메일 없이도 가입되게 설계합니다.
- 같은 사람이 구글/카카오로 각각 로그인하면 **별개 계정이 됩니다.** MVP에서는 "처음 가입한 방식으로 로그인" 안내로 처리하고, 계정 연동은 후순위로 둡니다.
- 로그인 로직은 **한 모듈로 분리**해서 웹 방식에서 네이티브 방식으로 교체하기 쉽게 만듭니다.

### 2-5. 찌르기 (하루 1회)
- 제한은 **서버/DB**에서 합니다. 클라이언트 검증만으로는 우회됩니다.
- "하루"는 KST 날짜 기준입니다. `(보낸 사람, KST 날짜)` 유니크 제약으로 보장합니다.

---

## 3. 기기별 배포 분기 (Q1 답에 따라 선택)

| | 안드로이드 | 아이폰 |
|---|---|---|
| 설치 방법 | APK 직접 설치 (또는 Play 내부 테스트) | TestFlight |
| 비용 | APK는 무료. Play 개발자 등록은 1회 비용 | Apple Developer Program 연 $99 |
| 빌드 환경 | Android Studio (Windows/Mac 가능) | **Mac + Xcode 필수** |
| 제약 | "출처 불명 앱 설치 허용" 필요 | TestFlight 빌드는 약 90일 후 만료되어 재업로드 필요 |
| 푸시 | FCM 설정 | APNs 키 설정 + FCM 연동 |

위 비용과 제약은 제 지식 기준입니다. 현재 정책은 각 공식 페이지에서 확인하세요. `[검증 필요]`

- **둘 다 안드로이드:** 비용 없이 가장 빠름
- **둘 다 아이폰:** 연 $99 + Mac 필요
- **혼합:** 두 경로 모두 진행. 아이폰 쪽이 일정을 결정

---

## 4. 데이터 모델 (초안)

| 테이블 | 용도 |
|---|---|
| `profiles` | 사용자 프로필 (auth.users 1:1) |
| `couples` | 커플 단위 |
| `couple_members` | 커플 소속 (1인 1커플, 커플당 최대 2명) |
| `invites` | 초대 코드 (만료/1회 사용) |
| `events` | 일정 |
| `photos` | 사진 메타데이터 |
| `pokes` | 찌르기 기록 |
| `device_tokens` | 푸시 토큰 |
| `reminder_log` | 알림 발송 기록 (중복 방지) |

---

## 5. Phase 0 스키마 SQL (초안, 미검증)

> **주의:** 실행 전에 Supabase 로컬/테스트 프로젝트에서 먼저 돌려 보세요. 이 SQL은 아직 한 번도 실행해 보지 않은 초안입니다.

```sql
-- 확장
create extension if not exists pgcrypto;

-- 프로필
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  timezone text not null default 'Asia/Seoul',
  created_at timestamptz not null default now()
);

-- 커플
create table public.couples (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

-- 커플 소속: 1인 1커플 (user_id 유니크)
create table public.couple_members (
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (couple_id, user_id)
);

-- 초대 코드 (클라이언트 직접 접근 금지, RPC로만 사용)
create table public.invites (
  code text primary key,
  couple_id uuid not null references public.couples(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz
);

-- 일정
create table public.events (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  title text not null check (char_length(title) between 1 and 200),
  note text,
  start_at timestamptz not null,
  end_at timestamptz,
  all_day boolean not null default false,
  source text not null default 'manual' check (source in ('manual','device')),
  source_uid text,                         -- 기기 캘린더 일정 ID (중복 가져오기 방지)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index events_device_dedupe
  on public.events (couple_id, created_by, source_uid)
  where source_uid is not null;
create index events_couple_start on public.events (couple_id, start_at);

-- 사진
create table public.photos (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id),
  photo_date date not null,
  storage_path text not null,
  thumb_path text,
  created_at timestamptz not null default now()
);
create index photos_couple_date on public.photos (couple_id, photo_date);

-- 찌르기: 하루 1회는 유니크 제약으로 보장 (KST 날짜 기준)
create table public.pokes (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  sender_id uuid not null references auth.users(id),
  receiver_id uuid not null references auth.users(id),
  poke_date date not null default ((now() at time zone 'Asia/Seoul')::date),
  created_at timestamptz not null default now(),
  unique (sender_id, poke_date)
);

-- 푸시 토큰
create table public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null,
  platform text not null check (platform in ('ios','android')),
  updated_at timestamptz not null default now(),
  unique (user_id, token)
);

-- 알림 발송 기록 (중복 방지)
create table public.reminder_log (
  event_id uuid not null references public.events(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('7d','3d','1d','0d')),
  sent_at timestamptz not null default now(),
  primary key (event_id, recipient_id, kind)
);
```

### 5-1. 헬퍼 함수와 RPC

```sql
-- 현재 사용자의 커플 ID
create or replace function public.my_couple_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select couple_id from public.couple_members where user_id = auth.uid()
$$;

-- 초대 코드 생성 (커플이 없으면 새로 만든다)
create or replace function public.create_invite()
returns text
language plpgsql security definer
set search_path = public
as $$
declare
  cid uuid;
  new_code text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  cid := public.my_couple_id();
  if cid is null then
    insert into public.couples default values returning id into cid;
    insert into public.couple_members (couple_id, user_id) values (cid, auth.uid());
  end if;

  if (select count(*) from public.couple_members where couple_id = cid) >= 2 then
    raise exception 'couple already full';
  end if;

  new_code := upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8));
  insert into public.invites (code, couple_id, created_by, expires_at)
  values (new_code, cid, auth.uid(), now() + interval '24 hours');
  return new_code;
end $$;

-- 초대 코드 수락
create or replace function public.accept_invite(p_code text)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  inv public.invites%rowtype;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if public.my_couple_id() is not null then raise exception 'already in a couple'; end if;

  select * into inv from public.invites
   where code = upper(p_code) for update;

  if not found or inv.used_at is not null or inv.expires_at < now() then
    raise exception 'invalid or expired code';
  end if;
  if (select count(*) from public.couple_members where couple_id = inv.couple_id) >= 2 then
    raise exception 'couple already full';
  end if;

  insert into public.couple_members (couple_id, user_id) values (inv.couple_id, auth.uid());
  update public.invites set used_at = now() where code = inv.code;
  return inv.couple_id;
end $$;

-- 찌르기: 상대를 서버에서 결정하고, 하루 1회 제한은 유니크 제약이 막는다
create or replace function public.send_poke()
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  cid uuid := public.my_couple_id();
  partner uuid;
begin
  if cid is null then raise exception 'no couple'; end if;
  select user_id into partner from public.couple_members
   where couple_id = cid and user_id <> auth.uid();
  if partner is null then raise exception 'no partner yet'; end if;

  insert into public.pokes (couple_id, sender_id, receiver_id)
  values (cid, auth.uid(), partner);
  -- 유니크 위반(오늘 이미 찌름)은 클라이언트에서 "오늘은 이미 찔렀어요"로 처리
  -- 푸시 발송은 Edge Function 또는 DB webhook에서 처리 (Phase 4)
end $$;
```

---

## 6. RLS 정책 (초안, 미검증)

```sql
alter table public.profiles       enable row level security;
alter table public.couples        enable row level security;
alter table public.couple_members enable row level security;
alter table public.invites        enable row level security;  -- 정책 없음 = 클라이언트 접근 차단
alter table public.events         enable row level security;
alter table public.photos         enable row level security;
alter table public.pokes          enable row level security;
alter table public.device_tokens  enable row level security;
alter table public.reminder_log   enable row level security;  -- 정책 없음 = 서버(service role)만

-- profiles: 본인 + 같은 커플의 상대 조회, 수정은 본인만
create policy profiles_select on public.profiles for select
  using (id = auth.uid()
      or id in (select user_id from public.couple_members where couple_id = public.my_couple_id()));
create policy profiles_insert on public.profiles for insert with check (id = auth.uid());
create policy profiles_update on public.profiles for update using (id = auth.uid());

-- couples / couple_members: 내 커플만 조회 (생성/변경은 RPC로만)
create policy couples_select on public.couples for select using (id = public.my_couple_id());
create policy members_select on public.couple_members for select using (couple_id = public.my_couple_id());

-- events: 같은 커플만 CRUD
create policy events_select on public.events for select using (couple_id = public.my_couple_id());
create policy events_insert on public.events for insert
  with check (couple_id = public.my_couple_id() and created_by = auth.uid());
create policy events_update on public.events for update using (couple_id = public.my_couple_id());
create policy events_delete on public.events for delete using (couple_id = public.my_couple_id());

-- photos: 같은 커플 조회, 업로드는 본인 명의, 삭제는 업로더만
create policy photos_select on public.photos for select using (couple_id = public.my_couple_id());
create policy photos_insert on public.photos for insert
  with check (couple_id = public.my_couple_id() and uploaded_by = auth.uid());
create policy photos_delete on public.photos for delete using (uploaded_by = auth.uid());

-- pokes: 조회만 허용, 삽입은 send_poke() RPC로만
create policy pokes_select on public.pokes for select
  using (sender_id = auth.uid() or receiver_id = auth.uid());

-- device_tokens: 본인 것만
create policy tokens_all on public.device_tokens for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
```

### 6-1. Storage (사진 버킷)

- 버킷 이름: `photos` (**비공개**)
- 경로 규칙: `{couple_id}/{YYYY-MM-DD}/{uuid}.jpg`, 썸네일은 `{couple_id}/{YYYY-MM-DD}/thumb_{uuid}.jpg`
- Storage 정책은 경로 첫 폴더가 내 `couple_id`와 같을 때만 읽기/쓰기를 허용합니다.
- 정책 문법은 Supabase 버전에 따라 다를 수 있어 **공식 문서를 보고 작성**하세요. `[검증 필요]`

### 6-2. 연결 해제 정책 (Q2, 확정 필요)

제안 기본값입니다. 동의하지 않으면 바꿔야 하고, RLS와 RPC에 반영해야 합니다.

1. 한쪽이 해제하면 **양쪽 모두 즉시 접근이 끊깁니다.**
2. 해제 전에 사진 일괄 다운로드를 할 수 있게 안내합니다.
3. 데이터는 `couple_id`에 남겨 두고, 양쪽 모두 떠난 커플은 30일 후 삭제하는 정리 작업을 둡니다.
4. 해제 후 새 커플에 가입하면 이전 데이터는 보이지 않습니다.

### 6-3. RLS 검증 체크리스트 (AI가 만든 정책을 그대로 믿지 말 것)

테스트 계정 3개(A, B = 한 커플, C = 무관한 사용자)로 아래를 직접 확인합니다.

- [ ] C가 A/B의 events, photos, pokes를 select 했을 때 0건
- [ ] C가 A/B 커플의 `couple_id`로 events insert 시도 → 거부
- [ ] A가 B의 명의(`created_by`/`uploaded_by`)로 insert 시도 → 거부
- [ ] 비공개 버킷에 로그인 없이 직접 URL 접근 → 거부
- [ ] 만료/사용된 초대 코드 → 거부
- [ ] 이미 커플인 사용자가 다른 코드 수락 → 거부
- [ ] 한 커플에 3번째 사용자가 가입 시도 → 거부
- [ ] 같은 날 찌르기 2회 → 두 번째 실패 (KST 자정 전후도 확인)
- [ ] 클라이언트에서 `invites`, `reminder_log` 직접 조회 → 0건/거부

---

## 7. 알림 설계

- **스케줄:** 매일 09:00 KST (UTC 00:00) 1회 실행 (Q4 확정 후 조정)
- **대상 판정:** KST 기준 일정 시작일이 오늘 기준 +7 / +3 / +1 / +0 일인 일정
- **중복 방지:** `reminder_log`에 `insert ... on conflict do nothing`으로 넣고, **실제로 삽입된 행에 대해서만** 푸시를 발송
- **수신자:** Q3 확정에 따름 (기본 제안: 커플 두 명 모두)
- **일정 수정 시:** 날짜가 바뀌면 해당 일정의 `reminder_log`를 지워서 새 날짜 기준으로 다시 알림이 가게 함
- **주의:** 이미 지난 알림 구간(예: 어제 만든 일정이 2일 뒤 시작)은 7d/3d 알림이 소급 발송되지 않게 "해당 일 정확히 일치" 조건을 유지
- **실패 처리:** 토큰 만료(무효 토큰) 응답 시 `device_tokens`에서 삭제

---

## 8. 개발 단계와 완료 기준

각 단계는 **실제로 동작 확인 후** 다음으로 넘어갑니다.

### Phase 0 — 세팅 및 정책 확정
- [ ] Q1~Q5 확정
- [ ] Supabase 프로젝트 생성, 5장/6장 SQL 적용 (테스트 프로젝트에서 먼저)
- [ ] 구글/카카오 개발자 콘솔 앱 등록, Redirect URI 설정
- [ ] **RLS 체크리스트(6-3) 통과**
- [ ] 프로젝트 규칙 문서(9장) 저장
- 완료 기준: SQL 오류 없이 적용되고 RLS 테스트 전부 통과

### Phase 1 — 웹 MVP (인증 + 연결 + 캘린더)
- [ ] 구글/카카오 로그인 (웹)
- [ ] 초대 코드 생성/수락
- [ ] 공유 캘린더 월/일 뷰, 일정 CRUD, Realtime 반영
- 완료 기준: 서로 다른 브라우저/계정 두 개로 연결 → 한쪽 수정이 다른 쪽에 실시간 반영

### Phase 2 — 사진
- [ ] 날짜별 업로드 (리사이즈/압축/썸네일)
- [ ] 갤러리, 서명 URL 조회, 웹 다운로드
- 완료 기준: 큰 사진(수 MB)도 업로드되고, 상대 계정에서만 보이며, 제3자 계정에서는 접근 불가

### Phase 3 — 앱 래핑 + 네이티브 기능 **(보류: 웹 단계 이후 재검토)**
- [ ] Capacitor 적용, 실기기 설치
- [ ] **앱에서 구글/카카오 로그인 재검증** (실패 시 2-4의 대안 적용)
- [ ] 기기 캘린더 가져오기 (선택 일정 복사, 중복 방지)
- [ ] 앨범 저장(다운로드)
- 완료 기준: 실기기에서 로그인, 캘린더 가져오기, 사진 저장이 모두 동작

### Phase 4 — 푸시 / 알림 / 찌르기 **(웹 전용 기준: Web Push 또는 이메일 알림으로 대체, 0-0장 참고)**
- [ ] 푸시 토큰 등록 및 갱신
- [ ] 스케줄러 + 4단계 알림, 중복 방지 확인
- [ ] 찌르기 (RPC + 푸시), 하루 1회 제한 확인
- 완료 기준: 실기기에서 테스트 일정으로 7/3/1/0일 전 알림이 각 1회만 도착

### Phase 5 — 배포 **(웹 단계에서는 Vercel 배포로 대체, 0-0장 체크리스트 참고. 아래는 앱 단계 재개 시 적용)**
- 안드로이드: APK 또는 Play 내부 테스트
- 아이폰: TestFlight (90일 만료 주기 관리)
- 후속 과제(선택): 계정 삭제 기능, 계정 연동, 정식 출시 시 Apple 로그인 검토

---

## 9. AI 바이브 코딩 운영 규칙

### 9-1. 프로젝트 규칙 문서 (CLAUDE.md 등으로 저장)

```markdown
# 프로젝트 규칙
- 스택: React + TypeScript + Vite, Supabase, Capacitor. 이 외 라이브러리 추가 전에 이유를 설명하고 승인받을 것.
- 모든 테이블은 RLS 활성화. 새 테이블을 만들면 정책도 함께 작성하고, 허용/거부 테스트 케이스를 같이 제안할 것.
- 클라이언트에서 service role 키 사용 금지. 키는 환경변수로만 관리하고 커밋하지 말 것.
- 찌르기/초대 수락 같은 권한 로직은 클라이언트가 아니라 DB(RPC/제약)에서 강제할 것.
- 시간은 DB에 timestamptz로 저장, 날짜 경계는 KST(Asia/Seoul) 기준으로 계산할 것.
- 네이티브 플러그인/OAuth/푸시는 기억에 의존하지 말고 공식 문서를 확인한 뒤 작성하고, 확인한 문서 링크를 남길 것.
- 한 번에 한 기능만 구현하고, 구현 후 직접 확인 방법(실행 절차)을 함께 제시할 것.
- 확실하지 않은 부분은 단정하지 말고 "검증 필요"로 표시할 것.
```

### 9-2. 단계별 요청 프롬프트 예시

**Phase 0 (스키마 적용 후 검토):**
```
첨부한 스키마와 RLS를 검토해줘. 다른 커플의 데이터가 보이거나 수정될 수 있는 경로,
RPC(security definer)의 권한 우회 가능성, 유니크 제약의 허점을 찾아서 근거와 함께 알려줘.
문제가 없다고 결론 내리지 말고 반증 테스트 SQL을 같이 작성해줘.
```

**Phase 1 (웹 인증/연결):**
```
Vite + React + TS 프로젝트에 Supabase 클라이언트를 설정하고,
구글/카카오 로그인 버튼, 로그인 후 프로필 생성, 초대 코드 생성/입력 화면(create_invite, accept_invite RPC 사용)을 구현해줘.
로그인 로직은 나중에 네이티브 방식으로 교체할 수 있게 auth 모듈 하나로 분리해줘.
Supabase 공식 문서의 현재 방식을 확인하고 작성해줘.
```

**Phase 3 (앱 래핑):**
```
Capacitor를 적용하고 앱에서 구글/카카오 로그인이 동작하게 만들어줘.
WebView에서 구글 OAuth가 막히는 문제를 어떻게 피할지 공식 문서 기준 방법 2가지를 비교하고,
권장안을 근거와 함께 제시한 뒤 구현해줘. 실기기에서 확인할 절차도 알려줘.
```

---

## 10. 주요 위험 요약

| 위험 | 가능성 | 대응 |
|---|---|---|
| 앱 환경에서 구글 로그인 실패 | 높음 | Phase 3 초반에 단독 검증, 네이티브 방식 준비 |
| AI가 만든 RLS 허점 | 중간 | 6-3 체크리스트로 직접 테스트 |
| 네이티브 플러그인 비호환/미유지보수 | 중간 | 플러그인 선정 전 최근 릴리스/이슈/지원 OS 버전 확인 |
| 아이폰 TestFlight 만료 | 확정 (90일) | 재업로드 일정 관리 (아이폰 사용 시) |
| 알림 중복/누락 | 중간 | `reminder_log` 제약 + 테스트 일정으로 검증 |
| 계정 중복 (구글/카카오 각각 가입) | 중간 | MVP는 안내로 처리, 후순위로 연동 |

---

## 11. 다음 행동

1. Q1(기기 종류)과 Q2~Q5에 대한 결정
2. 테스트 Supabase 프로젝트 생성 후 5장/6장 SQL 적용 및 6-3 체크리스트 실행
3. Phase 1 착수
