import Link from "next/link";
import { ShellHeader } from "@/components/shell-header.js";

export default function GuidePage() {
  return (
    <>
      <ShellHeader active="guide" />
      <main className="g-shell">
        <div className="g-hero">
          <h1>사용 가이드</h1>
          <p>
            목업 ZIP을 업로드하고, 화면 위에 설명을 달고, 파일 하나로 열리는 기획서 HTML로 보내는 과정을
            안내합니다.
          </p>
        </div>

        <section className="g-section">
          <h2>시작하기 — ZIP 업로드</h2>
          <ol className="g-steps">
            <li>
              목업 프로젝트를 빌드하고 결과물 폴더만 압축합니다. 예: <code>npm run build</code> →{" "}
              <code>zip -r mockup.zip dist</code>
            </li>
            <li>콘솔에서 프로젝트 이름(선택)·작성자 라벨(선택)을 입력하고 zip을 선택해 업로드합니다.</li>
            <li>
              완료 안내의 <b>편집 열기</b>를 누르면 편집기가 주입된 목업이 열립니다.
            </li>
          </ol>
          <p className="g-note">
            zip은 50MB 이하(압축을 풀었을 때도 50MB·1500개 파일 이하), 루트(또는 한 겹 폴더 안)에{" "}
            <code>index.html</code>이 있어야 합니다. 업로드 시점으로 고정되므로 목업이 바뀌면 새
            프로젝트로 다시 올립니다.
          </p>
        </section>

        <section className="g-section">
          <h2>편집</h2>
          <ul className="g-list">
            <li>
              <b>화면 등록</b> — 목업을 원하는 상태로 만든 뒤 <b>+ 현재 화면 등록</b>을 누릅니다.
            </li>
            <li>
              <b>어노테이션</b> — 편집 모드(Alt+Shift+E)에서 요소를 클릭해 설명을 답니다.
            </li>
            <li>
              <b>화면 이동</b> — 어노테이션에 이동할 화면과 조건을 지정하면 산출물에 흐름도로 그려집니다.
            </li>
            <li>
              <b>저장</b> — 자동 저장됩니다. 패널 상단의 <code>저장됨 ✓</code>로 확인하세요.
            </li>
          </ul>
        </section>

        <section className="g-section">
          <h2>보내기와 산출물</h2>
          <ul className="g-list">
            <li>
              산출물은 <b>단독 HTML 1개 파일</b>입니다. 네트워크 없이 <code>file://</code>로 열리므로 파일만
              전달하면 됩니다.
            </li>
            <li>
              결과물 예시는 <Link href="/sample">샘플 보기</Link>에서 확인할 수 있습니다.
            </li>
          </ul>
          <p className="g-foot">
            더 자세한 내용은 <Link href="/faq">FAQ</Link>를 참고하세요.
          </p>
        </section>
      </main>
    </>
  );
}
