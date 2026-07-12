/**
 * 스냅샷 이미지 최적화 (실사용 13차 — 킥오프 §11 9차).
 *
 * single-file은 이미지를 원본 그대로 data URI로 임베드한다 — 고해상도 포스터·배경이 많은
 * 페이지는 장면 하나가 수십 MB가 되어 저장·내보내기가 실용성을 잃는다. 동결 직후 HTML
 * 문자열에서 큰 래스터 이미지를 WebP로 재인코딩(+긴 변 상한 다운스케일)해 치환한다.
 *
 * - 대상: data:image/png·jpeg·webp·bmp — GIF(애니메이션 소실)·SVG(벡터·텍스트)는 건드리지 않음
 * - MIN_BYTES 미만은 스킵(아이콘류 보존), 재인코딩 결과가 더 크면 원본 유지
 * - 실패는 이미지 단위로 무시(원본 유지) — 최적화는 best-effort, 동결을 깨지 않는다
 * - OffscreenCanvas·createImageBitmap·WebP 인코딩은 Chrome/Edge 전용이지만 편집 환경은
 *   Chrome/Edge 한정(ID-02)이라 문제없다. 뷰어(산출물)는 표준 <img>로 렌더만 한다.
 */

/** 이 크기(바이트) 이상인 이미지만 재인코딩 — 작은 아이콘·로고는 그대로 둔다. */
const MIN_BYTES = 100 * 1024;
/** 긴 변 상한(px) — 캡처 재현에 충분하고 그 이상은 기획서 용도에 과잉. 업스케일은 없음. */
const MAX_DIMENSION = 2048;
/** WebP 품질 — 시각적 열화가 체감되지 않는 선에서 크기를 크게 줄인다. */
const WEBP_QUALITY = 0.82;

const DATA_URI_PATTERN = /data:image\/(?:png|jpeg|webp|bmp);base64,[A-Za-z0-9+/=]+/g;

/** 재인코더 — 실패·이득 없음이면 null (원본 유지). 테스트에서 주입 가능. */
export type ImageEncoder = (bytes: Uint8Array, mime: string) => Promise<string | null>;

function base64ByteLength(base64: string): number {
  // 4자 = 3바이트, 패딩 보정 — 디코드 없이 크기만 추정
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return (base64.length / 4) * 3 - padding;
}

function decodeBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function blobToDataUri(blob: Blob): Promise<string> {
  const reader = new FileReader();
  return new Promise((resolve, reject) => {
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("FileReader 실패"));
    reader.readAsDataURL(blob);
  });
}

/** 기본 재인코더: createImageBitmap → OffscreenCanvas → WebP. */
const defaultEncoder: ImageEncoder = async (bytes, mime) => {
  const bitmap = await createImageBitmap(new Blob([bytes.buffer as ArrayBuffer], { type: mime }));
  try {
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await canvas.convertToBlob({ type: "image/webp", quality: WEBP_QUALITY });
    return await blobToDataUri(blob);
  } finally {
    bitmap.close();
  }
};

/**
 * 동결 HTML의 큰 이미지 data URI를 재인코딩본으로 치환한다.
 * 같은 URI의 중복 등장(groupDuplicateImages 미적용분 포함)은 한 번만 인코딩해 전부 치환.
 */
export async function optimizeSnapshotImages(
  html: string,
  encoder: ImageEncoder = defaultEncoder,
): Promise<string> {
  const unique = new Set(html.match(DATA_URI_PATTERN) ?? []);
  if (unique.size === 0) return html;

  const replacements = new Map<string, string>();
  for (const uri of unique) {
    const comma = uri.indexOf(",");
    const base64 = uri.slice(comma + 1);
    if (base64ByteLength(base64) < MIN_BYTES) continue;
    const mime = uri.slice(5, uri.indexOf(";"));
    try {
      const optimized = await encoder(decodeBase64(base64), mime);
      // 이득이 있을 때만 치환 — 이미 잘 압축된 이미지는 원본 유지
      if (optimized && optimized.length < uri.length) replacements.set(uri, optimized);
    } catch (err) {
      console.warn("[mockspec] 이미지 최적화 건너뜀:", err);
    }
  }
  if (replacements.size === 0) return html;

  return html.replace(DATA_URI_PATTERN, (match) => replacements.get(match) ?? match);
}
