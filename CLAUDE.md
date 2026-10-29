# 프로젝트 규칙
- 계획서: docs/shared-calendar-plan.md. 현재는 웹 우선(Vercel + Supabase), Capacitor는 보류.
- 응답은 한국어로 한다.
- 스택: React + TypeScript + Vite(`web/`), Supabase(`supabase/`). 이 외 라이브러리 추가 전에 이유를 설명하고 승인받을 것.
- 모든 테이블은 RLS 활성화. 새 테이블을 만들면 정책도 함께 작성하고, `supabase/tests/rls_check.sql`에 허용/거부 테스트를 추가할 것.
- 클라이언트에서 service role 키 사용 금지. 키는 환경변수로만 관리하고 커밋하지 말 것.
- 찌르기/초대 수락 같은 권한 로직은 클라이언트가 아니라 DB(RPC/제약)에서 강제할 것.
- 시간은 DB에 timestamptz로 저장, 날짜 경계는 KST(Asia/Seoul) 기준으로 계산할 것.
- 네이티브 플러그인/OAuth/푸시는 기억에 의존하지 말고 공식 문서를 확인한 뒤 작성하고, 확인한 문서 링크를 남길 것.
- 한 번에 한 기능만 구현하고, 구현 후 직접 확인 방법(실행 절차)을 함께 제시할 것.
- 확실하지 않은 부분은 단정하지 말고 "검증 필요"로 표시할 것.

# 실행
1. Supabase SQL Editor에서 `supabase/migrations/*.sql`을 이름 순서대로 실행 → `supabase/tests/rls_check.sql` 실행 (마지막 결과가 'ALL RLS CHECKS PASSED')
2. `cd web && cp .env.example .env` 후 값 입력 → `npm i && npm run dev` / 파서 테스트: `npm test`
3. 푸시(찌르기/일정 알림)
   - `npx web-push generate-vapid-keys` → Public Key는 `web/.env`와 Vercel 환경변수 `VITE_VAPID_PUBLIC_KEY`에
   - `npx supabase login` → `npx supabase link --project-ref mnqzvqpmmpvvxrhbwvyc`
   - `npx supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:<이메일> CRON_SECRET=<임의 긴 문자열>`
   - `npx supabase functions deploy notify --no-verify-jwt --use-api`
   - Database > Extensions에서 pg_cron, pg_net 켜고 `supabase/cron.sql`의 <CRON_SECRET>을 바꿔 SQL Editor에서 실행
