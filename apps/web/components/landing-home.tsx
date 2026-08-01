import Link from "next/link";

const FLOW = [
  {
    number: "01",
    title: "목업을 연결합니다",
    body: "빌드 결과 ZIP을 올리거나, 브라우저 확장으로 로그인 뒤 화면을 그대로 연결합니다.",
  },
  {
    number: "02",
    title: "화면 위에 설명합니다",
    body: "원하는 상태를 화면으로 등록하고, 요소를 눌러 번호와 기획 의도를 직접 남깁니다.",
  },
  {
    number: "03",
    title: "HTML 하나로 보냅니다",
    body: "화면·설명·이동 흐름을 한 파일로 내보냅니다. 받는 사람은 로그인 없이 열어봅니다.",
  },
] as const;

export function LandingHome() {
  return (
    <main className="l-main">
      <section className="l-hero" aria-labelledby="landing-title">
        <div className="l-hero-copy">
          <p className="l-eyebrow">MOCKUP-AS-SPEC</p>
          <h1 id="landing-title">
            보이는 화면에 설명을 달면,{" "}
            <span>기획서가 됩니다.</span>
          </h1>
          <p className="l-lead">
            목업을 수정하지 않고 화면 위에서 기획 의도를 기록하세요. MockSpec이 화면과 설명을
            네트워크 없이 열리는 HTML 파일 하나로 묶어 줍니다.
          </p>
          <div className="l-actions">
            <Link href="/login" className="l-primary-action">
              내 프로젝트 시작
              <span aria-hidden="true">→</span>
            </Link>
            <a href="/sample" target="_blank" rel="noopener noreferrer" className="l-text-action">
              샘플 산출물 보기
              <span aria-hidden="true">↗</span>
            </a>
          </div>
          <ul className="l-principles" aria-label="서비스 특징">
            <li>목업 소스 수정 없음</li>
            <li>추측 없이 사람이 입력</li>
            <li>오프라인 HTML 한 파일</li>
          </ul>
        </div>

        <div
          className="l-product-preview"
          role="img"
          aria-label="목업 화면의 요소에 번호를 붙이고 오른쪽 패널에서 설명을 작성하는 MockSpec 편집 화면 예시"
        >
          <div className="l-preview-bar">
            <span />
            <span />
            <span />
            <b>주문 화면 목업</b>
            <em>저장됨 ✓</em>
          </div>
          <div className="l-preview-body">
            <div className="l-mockup-canvas">
              <div className="l-mockup-nav">
                <i />
                <span />
                <span />
                <span />
              </div>
              <div className="l-mockup-content">
                <div className="l-mockup-heading">
                  <div>
                    <span />
                    <strong />
                  </div>
                  <button type="button" tabIndex={-1} aria-hidden="true">
                    새 주문
                  </button>
                  <b className="l-pin l-pin-one">1</b>
                </div>
                <div className="l-mockup-stats">
                  <span />
                  <span />
                  <span />
                </div>
                <div className="l-mockup-table">
                  <div />
                  <div />
                  <div />
                  <div />
                  <b className="l-pin l-pin-two">2</b>
                </div>
              </div>
            </div>
            <aside className="l-description-panel">
              <div className="l-panel-heading">
                <span>화면 설명</span>
                <i>2</i>
              </div>
              <div className="l-note is-active">
                <b>1</b>
                <div>
                  <strong>새 주문 버튼</strong>
                  <p>클릭하면 주문 등록 화면으로 이동합니다.</p>
                </div>
              </div>
              <div className="l-note">
                <b>2</b>
                <div>
                  <strong>주문 목록</strong>
                  <p>최근 수정한 주문부터 표시합니다.</p>
                </div>
              </div>
              <div className="l-panel-footer">
                <span />
                <span />
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className="l-flow" aria-labelledby="flow-title">
        <div className="l-section-heading">
          <p>HOW IT WORKS</p>
          <h2 id="flow-title">목업에서 기획서까지, 끊기지 않는 한 흐름</h2>
        </div>
        <ol>
          {FLOW.map((step) => (
            <li key={step.number}>
              <span>{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="l-paths" aria-labelledby="paths-title">
        <div className="l-section-heading">
          <p>START YOUR WAY</p>
          <h2 id="paths-title">지금 가진 목업 형태로 시작하세요</h2>
        </div>
        <div className="l-path-grid">
          <article>
            <span className="l-path-icon" aria-hidden="true">ZIP</span>
            <div>
              <p>빌드 결과물이 있다면</p>
              <h3>ZIP 업로드</h3>
              <span>정적 목업을 올려 바로 편집합니다.</span>
            </div>
          </article>
          <article>
            <span className="l-path-icon" aria-hidden="true">EXT</span>
            <div>
              <p>로그인 뒤 화면이라면</p>
              <h3>브라우저 확장</h3>
              <span>내 브라우저에 열린 화면 위에서 편집합니다.</span>
            </div>
          </article>
        </div>
        <Link href="/guide" className="l-guide-link">
          어떤 방법이 맞는지 사용 가이드에서 확인하기 <span aria-hidden="true">→</span>
        </Link>
      </section>

      <section className="l-closing" aria-labelledby="closing-title">
        <p>목업은 이미 충분히 많은 것을 보여 줍니다.</p>
        <h2 id="closing-title">이제 그 위에 의도만 더하세요.</h2>
        <Link href="/login" className="l-primary-action">
          프로젝트 만들기
          <span aria-hidden="true">→</span>
        </Link>
      </section>
    </main>
  );
}
