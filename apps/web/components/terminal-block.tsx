"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 가이드의 명령 예시를 터미널 창 형태로 보여 준다 (이슈 #65).
 *
 * 색 구분(성공 초록·주의 노랑)은 **명령과 출력이 함께 있을 때만** 값어치가 있다. 명령만
 * 늘어놓고 창 chrome을 씌우면 장식에 그친다 — 그래서 이 컴포넌트는 출력 라인을 1급으로
 * 다루고, 가이드도 사용자가 자기 화면과 대조할 수 있는 실제 출력을 함께 싣는다.
 *
 * 의미 구조는 `<pre><code>`를 유지한다: 브라우저 검색·스크린리더·드래그 복사가 그대로 된다.
 * 창 chrome(신호등)은 장식이라 `aria-hidden`이고, 복사 버튼만 인터랙티브 요소로 남는다.
 */

export type TerminalLine =
  | { kind: "command"; text: string }
  /** 실행 결과 — 회색. 사용자가 자기 터미널과 대조하는 기준선이다. */
  | { kind: "output"; text: string }
  /** 이 단계가 성공했음을 알리는 줄 — 초록. */
  | { kind: "ok"; text: string }
  /** 잘못됐을 때의 신호나 1회성 값 — 노랑. */
  | { kind: "warn"; text: string }
  | { kind: "blank" };

type TerminalBlockProps = {
  /** 상단 바 우측 라벨. 다단계 절차의 위치 표시("Step 2 of 4")나 짧은 제목. */
  label?: string;
  lines: TerminalLine[];
  /** 하단 구분선 아래 완료 문구 — 이 블록을 마치면 무엇을 얻는지. */
  done?: string;
};

const PROMPT = "$ ";

/**
 * 클립보드 실패 시 값을 잃지 않게 `prompt`로 보여 준다 — 콘솔의 연결 코드 복사와 같은 방식
 * (`components/console-home.tsx`). file://이나 권한 거부 환경에서도 사용자가 직접 복사할 수 있다.
 */
async function copyOrPrompt(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    window.prompt("명령 (복사해 터미널에 붙여넣으세요):", text);
    return false;
  }
}

export function TerminalBlock({ label, lines, done }: TerminalBlockProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 복사 표시를 되돌리는 타이머는 언마운트 시 정리한다 — 사라진 컴포넌트에 setState하지 않게.
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function handleCopy(index: number, text: string) {
    const copied = await copyOrPrompt(text);
    if (!copied) return;
    setCopiedIndex(index);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopiedIndex(null), 1600);
  }

  const copiedLine = copiedIndex === null ? null : lines[copiedIndex];
  const copiedCommand = copiedLine && copiedLine.kind === "command" ? copiedLine.text : "";

  return (
    <div className="g-term">
      <div className="g-term-bar">
        <div className="g-term-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        {label ? <div className="g-term-label">{label}</div> : null}
      </div>

      <pre className="g-term-body">
        <code>
          {lines.map((line, index) => {
            if (line.kind === "blank") {
              return <div key={index} className="g-term-line is-blank" />;
            }

            if (line.kind === "command") {
              const isCopied = copiedIndex === index;
              return (
                <div key={index} className="g-term-line">
                  <span>
                    <span className="g-term-prompt">{PROMPT}</span>
                    {line.text}
                  </span>
                  <button
                    type="button"
                    className={`g-term-copy${isCopied ? " is-copied" : ""}`}
                    onClick={() => void handleCopy(index, line.text)}
                    // `aria-label`은 버튼 안 텍스트를 덮어쓴다 — 라벨을 고정해 두면 화면에서는
                    // "복사됨"으로 바뀌는데 스크린리더에는 계속 "명령 복사"로 들린다. 상태를
                    // 라벨에도 반영하고, 아래 status 영역으로 완료를 한 번 더 알린다.
                    aria-label={`${isCopied ? "복사됨" : "명령 복사"}: ${line.text}`}
                  >
                    {isCopied ? "복사됨" : "복사"}
                  </button>
                </div>
              );
            }

            const tone =
              line.kind === "ok" ? "g-term-ok" : line.kind === "warn" ? "g-term-warn" : "g-term-out";
            return (
              <div key={index} className="g-term-line">
                <span className={tone}>{line.text}</span>
              </div>
            );
          })}
        </code>
      </pre>

      {done ? <div className="g-term-foot">{done}</div> : null}

      {/*
        복사 성공은 화면에서는 버튼 글자로 알 수 있지만, 라벨이 붙은 버튼의 이름 변경을
        읽어 주는지는 스크린리더마다 다르다. 라이브 리전으로 한 번 더 알린다 (PR #76 Codex 지적).
        비어 있는 상태로 먼저 렌더돼 있어야 이후 내용 변경이 알림으로 잡힌다 — 그래서
        조건부 렌더가 아니라 항상 두고 문자열만 바꾼다.

        **메시지에 복사한 명령을 싣는 이유**: 한 블록에 복사 버튼이 여럿이라, 문구가 고정이면
        다른 명령을 이어서 복사해도 텍스트 노드가 그대로여서 React가 DOM을 건드리지 않고
        두 번째 성공이 알려지지 않는다. (같은 버튼을 연속으로 누르면 메시지가 같아 다시
        알리지 않는데, 이미 복사한 명령을 한 번 더 복사한 경우라 실사용에서 문제되지 않는다.)
      */}
      <div className="g-sr-only" role="status" aria-live="polite">
        {copiedIndex === null ? "" : `${copiedCommand} 명령을 클립보드에 복사했습니다.`}
      </div>
    </div>
  );
}
