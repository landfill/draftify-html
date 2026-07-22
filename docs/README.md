# Mockup-as-Spec (mockspec) 문서 인덱스

> 각자가 이미 만든 목업을 등록하면, 그 위에 어노테이션을 달아
> 단독 실행 가능한 기획서 HTML을 만들어 주는 서비스.
> (현 배포 = 사내 서비스. 공개 URL 멀티테넌트 전환은 **open-service 트랙** — 아래 §6·§7.)

**서비스를 실행하는 방법**은 루트 [README.md](../README.md)(빠른 시작),
**세 가지 연결 방식(경로 A·B·D)의 상세 사용법**은 [user-guide.md](./user-guide.md)(사용 가이드)에 있다.
이 인덱스는 제품·기술 스펙 문서의 지도다.

## 문서 체계

읽는 순서대로:

| 문서 | 지위 | 내용 |
|------|------|------|
| [user-guide.md](./user-guide.md) | 사용 가이드 | 세 연결 방식(ZIP 업로드·URL 프록시·내 화면에서 편집)의 사용법·동작 원리·제약·적합한 경우, 편집·마스킹·산출물 읽는 법 |
| [PRD.md](./PRD.md) | 제품 요구사항 정의서 | 서비스 정의·용어·핵심 프로세스·기능 요구사항(FR-\*)·Non-Goal·로드맵·성공 지표 |
| [detailed-spec.md](./detailed-spec.md) | 상세 기획서 | 콘솔/편집기/뷰어 화면별 상세, 인터랙션 시퀀스, 제품 정책(POL-M\*), 엣지 케이스, 수용 기준 |
| [technical-spec.md](./technical-spec.md) | 기술 스펙 | 아키텍처·스택·데이터 모델·API·앵커/캡처 알고리즘·보안·테스트·WBS |
| [output-standard.md](./output-standard.md) | 산출물 규범 | 기획서 HTML의 ID 체계(SCR-###, POL-###, 어노테이션 번호)·섹션 구조·표기 규칙 — 기존 auto-draft-guideline을 대체하는 신규 설계 |
| [implementation-decisions.md](./implementation-decisions.md) | 구현 결정 보충 | 미정의 지점 확정 ID-01~15 (실행 모델, 브라우저, 앵커 알고리즘 상세, API 에러 형식, asset 수명 등) — "단순하고 범용적"이 판단 기준 |
| [PROGRESS.md](./PROGRESS.md) | 진행 로그 | 현재 단계·WBS 체크리스트·세션 로그. **작업 시작 시 먼저 읽고 끝날 때 갱신** — 세션·에이전트 간 인수인계의 단일 소스 |

## 작업 규약 (에이전트)

세션·에이전트가 바뀌어도 이어서 작업하기 위한 규약은 저장소 루트에 있다:

- [../AGENTS.md](../AGENTS.md) — 에이전트 작업 규약 (읽는 순서, 진행 갱신 규약, 결정 변경 절차)
- [../CLAUDE.md](../CLAUDE.md) — AGENTS.md를 가리키는 진입점

## 원 결정 문서 (guide/)

위 문서들의 근거이자 원본. 충돌 시 결정 변경 절차(s1-kickoff-spec §11)를 따른다.

1. [guide/mockup-as-spec-guide.md](../guide/mockup-as-spec-guide.md) — 코어 개념 (장면·앵커·캡처)
2. [guide/mockup-as-spec-service-architecture.md](../guide/mockup-as-spec-service-architecture.md) — 서비스 구성 (온보딩 4경로, 컴포넌트, S1~S3)
3. [guide/s1-kickoff-spec.md](../guide/s1-kickoff-spec.md) — S1 확정 사양 (재검토 대상 아님)
4. [guide/s2-kickoff-spec.md](../guide/s2-kickoff-spec.md) — S2 확정 사양: 경로 B(URL 프록시)·SSRF/쿠키 보안·마스킹·CI (재검토 대상 아님)
5. [guide/pathD-kickoff-spec.md](../guide/pathD-kickoff-spec.md) — S2.5 확정 사양: 경로 D(브라우저 확장 클라이언트 주입)·프로젝트 토큰 인증 (재검토 대상 아님)
6. [guide/open-service-kickoff-spec.md](../guide/open-service-kickoff-spec.md) — open-service 트랙 착수 계약: 공개 멀티테넌트 개편(Vercel + Supabase·소유자 RLS), 서버 계층 이식·경로 A/D만 (재검토 대상 아님)
7. [guide/open-service-rfc.md](../guide/open-service-rfc.md) — 위 킥오프의 근거 RFC (논의·대안 비교·리뷰 반영 이력, 킥오프로 승격됨)

## 한눈에 보는 핵심

```
[온보딩]           [편집]                    [산출]              [소비]
목업 등록    →    장면 선언 + 어노테이션   →   단일 HTML 조립   →   file://로 열람
(zip 업로드)       + 캡처(사용자 브라우저)      (서버는 조립만)      (네트워크 0건)
```

- **의도는 추론하지 않는다** — 사람이 입력한 것만 렌더 (LLM은 S3에서 초안 보조만)
- **사용자는 목업을 수정하지 않는다** — SDK 주입은 서비스가 대신
- **편집은 라이브, 산출물은 캡처** — 백엔드 문제의 구조적 해소
- **산출물은 단독 HTML 하나** — 탈 PPT가 프로젝트 출발 동기
