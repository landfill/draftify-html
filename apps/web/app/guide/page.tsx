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
              목업 프로젝트를 <b>상대 경로로</b> 빌드하고 결과물 폴더만 압축합니다. 예:{" "}
              <code>npx vite build --base=./</code> → <code>zip -r mockup.zip dist</code>
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
          <p className="g-note">
            <b>상대 경로 빌드가 필수인 이유:</b> 업로드한 목업은 <code>/m/{"{프로젝트ID}"}/</code>{" "}
            아래에서 열립니다. <code>/assets/app.js</code>처럼 <code>/</code>로 시작하는 절대 경로는 이
            경로 밖을 가리켜 파일을 찾지 못합니다(HTML <code>&lt;base&gt;</code>는 상대 경로에만
            적용되므로 서비스가 대신 고쳐 줄 수 없습니다). 빌드 설정은{" "}
            <code>vite build --base=./</code>, CRA는 <code>package.json</code>에{" "}
            <code>&quot;homepage&quot;: &quot;.&quot;</code>를 넣습니다.
          </p>
          <p className="g-note">
            <b>기존 빌드를 그대로 두고 업로드용만 따로 만들려면</b> 출력 폴더를 분리합니다. 사내
            서버·다른 호스팅에 이미 절대 경로 빌드를 쓰고 있다면 그쪽을 건드릴 필요가 없습니다.
          </p>
          <pre className="g-code">
            <code>
              {`# package.json 의 scripts 에 한 줄 추가
"build:public": "vite build --base=./ --outDir dist-public"

# 기존 dist/ 는 그대로 두고 업로드용만 추가로 빌드
npm run build:public
zip -r mockup-public.zip dist-public`}
            </code>
          </pre>
          <p className="g-note">
            빌드 도구는 프로젝트에 설치돼 있어 <code>vite</code>를 그대로 치면{" "}
            <code>command not found</code>가 납니다. 위처럼 <code>npm run</code>으로 실행하거나, 한
            번만 쓸 거라면 <code>npx vite build --base=./ --outDir dist-public</code>처럼{" "}
            <code>npx</code>를 붙입니다.
          </p>
          <p className="g-note">
            어느 폴더가 업로드용인지 헷갈릴 때는 <code>index.html</code>을 열어{" "}
            <code>src=&quot;./assets/…&quot;</code>(업로드용) 인지{" "}
            <code>src=&quot;/assets/…&quot;</code>(아님) 인지 보면 됩니다.
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
