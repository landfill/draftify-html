import Link from "next/link";
import { ShellHeader } from "@/components/shell-header.js";

function FaqItem({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="g-faq-item">
      <summary>{q}</summary>
      <div className="g-faq-a">{children}</div>
    </details>
  );
}

export default function FaqPage() {
  return (
    <>
      <ShellHeader active="faq" />
      <main className="g-shell">
        <div className="g-hero">
          <h1>자주 묻는 질문</h1>
          <p>
            사용 순서 전반은 <Link href="/guide">사용 가이드</Link>에서 확인할 수 있습니다.
          </p>
        </div>

        <section className="g-faq-group">
          <h2>시작하기</h2>
          <div className="g-faq-card">
            <FaqItem q="zip 업로드가 거부됩니다.">
              <p>
                압축 파일 기준 50MB, 압축을 풀었을 때도 50MB·1500개 파일 제한입니다.{" "}
                <code>node_modules</code>를 제외하고 빌드 결과물 폴더만 압축하세요. 루트(또는 한 겹
                폴더 안)에 <code>index.html</code>이 있어야 합니다. 한 계정에 프로젝트는 20개까지
                만들 수 있습니다.
              </p>
            </FaqItem>
            <FaqItem q="업로드는 됐는데 편집 화면이 비어 있거나 스타일이 깨집니다.">
              <p>
                목업이 <b>절대 경로</b>로 빌드된 경우입니다. 브라우저 개발자도구 콘솔에{" "}
                <code>/assets/…</code> 404가 찍혀 있다면 이 문제입니다.
              </p>
              <p>
                업로드한 목업은 <code>/m/{"{프로젝트ID}"}/</code> 아래에서 열리는데,{" "}
                <code>/</code>로 시작하는 경로는 그 밖을 가리켜 파일을 찾지 못합니다. HTML{" "}
                <code>&lt;base&gt;</code>는 상대 경로에만 적용되므로 서비스가 대신 고쳐 줄 수
                없습니다.
              </p>
              <p>
                <b>상대 경로로 다시 빌드해 새로 업로드하세요.</b> Vite는{" "}
                <code>npx vite build --base=./</code>, CRA는 <code>package.json</code>에{" "}
                <code>&quot;homepage&quot;: &quot;.&quot;</code>를 넣습니다. 빌드 결과의{" "}
                <code>index.html</code>에서 <code>src=&quot;./assets/…&quot;</code>처럼{" "}
                <code>./</code>로 시작하면 정상입니다.
              </p>
            </FaqItem>
            <FaqItem q="로그인은 어떻게 하나요?">
              <p>
                Google 계정 또는 이메일 매직링크로 로그인합니다. 프로젝트는 로그인한 계정에만 연결되며, 다른
                사용자는 볼 수 없습니다.
              </p>
            </FaqItem>
          </div>
        </section>

        <section className="g-faq-group">
          <h2>스냅샷과 산출물</h2>
          <div className="g-faq-card">
            <FaqItem q="목업을 수정했는데 반영되지 않습니다.">
              <p>
                ZIP 업로드는 업로드 시점으로 고정됩니다 — 새 zip으로 프로젝트를 다시 만드세요. 이미 등록한
                화면은 캡처본이므로, 바뀐 상태를 다시 만들고 화면 행의 ⟳(다시 캡처)를 누르면 교체됩니다.
              </p>
            </FaqItem>
            <FaqItem q="산출물 HTML을 받은 사람에게도 서버가 필요한가요?">
              <p>
                아니요. 산출물은 단독 HTML 1개 파일로, 네트워크 요청 없이 <code>file://</code>로 열립니다.
              </p>
            </FaqItem>
          </div>
        </section>
      </main>
    </>
  );
}
