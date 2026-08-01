/*
  화면 표시용 포맷터.

  **타임존을 고정한다** (PR #84 Codex 지적). 콘솔 목록을 서버에서 실어 보내면서(#81)
  날짜 포맷이 SSR과 브라우저 하이드레이션에서 **둘 다** 돌게 됐다. 타임존을 지정하지 않으면
  각자의 기본값을 쓰므로 날짜 경계에 걸친 값에서 문자열이 갈린다 — `2026-08-01T16:00:00Z`는
  UTC로 8월 1일이지만 KST로는 8월 2일이다. 그러면 React 하이드레이션 불일치가 나서 날짜가
  깜빡이거나 클라이언트가 그 트리를 다시 그린다. 프리페치 전에는 목록이 마운트 후에만
  렌더돼 클라이언트에서만 돌았기 때문에 드러나지 않았다.

  `Asia/Seoul`로 고정하는 근거: 로케일이 이미 `ko-KR`로 고정돼 있고(표시 형식을 사용자
  환경에 맡기지 않는다), 배포도 서울 리전을 전제로 한다(#71). 둘의 기준을 맞춘다.
*/
export const DISPLAY_TIME_ZONE = "Asia/Seoul";
export const DISPLAY_LOCALE = "ko-KR";

/**
 * ISO 8601 → 화면용 날짜. 파싱할 수 없으면 원문을 그대로 돌려준다.
 *
 * **유효성은 `catch`가 아니라 `getTime()`으로 판정한다.** `toLocaleDateString`은 Invalid
 * Date에 예외를 던지지 않고 문자열 `"Invalid Date"`를 돌려주므로, `try/catch`만으로는
 * 원문 폴백이 걸리지 않는다 — 옮겨 오기 전 코드가 그랬고, 화면에 `Invalid Date`가 그대로
 * 나갔다. `catch`는 로케일·타임존 옵션이 거부될 때를 위해 남긴다(그때는 RangeError다).
 */
export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  try {
    return date.toLocaleDateString(DISPLAY_LOCALE, { timeZone: DISPLAY_TIME_ZONE });
  } catch {
    return iso;
  }
}
