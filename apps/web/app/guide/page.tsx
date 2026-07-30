import Link from "next/link";
import { ShellHeader } from "@/components/shell-header.js";
import { EXTENSION_RELEASE } from "@/lib/extension-release.js";

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

        <section id="extension-install" className="g-section">
          <h2>zip을 만들 수 없다면 — 확장으로 내 화면 편집</h2>
          <p className="g-note">
            로그인해야 보이는 화면, 사내 시스템, 내 로컬 개발 서버처럼{" "}
            <b>zip으로 뽑을 수 없는 목업</b>에 씁니다. 서버는 그 화면에 접근하지 않습니다 — Chrome
            확장이 <b>내 브라우저에 열린 화면 위에</b> 편집기를 얹고, 저장만 이 서비스로 보냅니다.
          </p>
          <div className="g-download-card">
            <div>
              <span className="g-download-kicker">브라우저 확장</span>
              <h3>MockSpec v{EXTENSION_RELEASE.version}</h3>
              <p>Chrome·Edge 최신 버전 · 개발자 모드로 설치</p>
            </div>
            <a
              className="g-download-button"
              href={EXTENSION_RELEASE.href}
              download={EXTENSION_RELEASE.filename}
            >
              <span aria-hidden="true">↓</span>
              확장 ZIP 다운로드
            </a>
          </div>
          <ol className="g-steps">
            <li>
              위 버튼으로 ZIP을 내려받고 압축을 풉니다. 안에는{" "}
              <code>mockspec-extension</code> 폴더 하나가 있습니다.
            </li>
            <li>
              Chrome에서 <code>chrome://extensions</code>를 열고 우측 상단 <b>개발자 모드</b>를
              켭니다. Edge는 <code>edge://extensions</code>에서 같은 순서로 진행합니다.
            </li>
            <li>
              <b>압축해제된 확장 프로그램을 로드</b>를 눌러 압축을 푼{" "}
              <code>mockspec-extension</code> 폴더를 고릅니다.
            </li>
            <li>
              콘솔의 <b>새 프로젝트 — 내 화면에서 편집 (확장)</b>에서 이름을 넣고 만들면{" "}
              <b>연결 코드</b>가 클립보드에 복사됩니다.
            </li>
            <li>
              편집할 화면이 열린 탭에서 확장 아이콘 → 연결 코드 붙여넣기 → <b>연결</b> → 페이지
              새로고침. 우하단 편집 버튼이 뜨면 설치와 연결이 끝난 것입니다.
            </li>
          </ol>
          <p className="g-note">
            ZIP 설치판은 자동 업데이트되지 않습니다. 콘솔에 표시된 버전이 설치본보다 높으면 새 ZIP을
            내려받아 기존 <code>mockspec-extension</code> 폴더를 교체한 뒤 확장 관리 화면에서 새로고침
            버튼을 누르세요.
          </p>
          <p className="g-note">
            <b>연결 코드에는 토큰이 들어 있습니다</b> — 코드를 공유하면 그 프로젝트에 쓰기 권한을
            주는 것과 같습니다. 코드는 발급 시 한 번만 만들어지고 콘솔을 새로고침하면 사라지므로,
            잃었다면 프로젝트 목록에서 <b>토큰 재발급</b>을 누릅니다(이전 토큰은 즉시 무효가 되니
            확장도 새 코드로 다시 연결해야 합니다).
          </p>
          <p className="g-note">
            캡처가 <b>내 브라우저에서</b> 실행되므로 로그인 후 실제 데이터가 산출물에 그대로
            들어갑니다. 외부로 보내기 전에 가릴 내용이 없는지 확인하세요.
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
