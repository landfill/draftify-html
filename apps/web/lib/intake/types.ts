/** 브라우저 unzip 결과 — 서버 extractZip(ExtractResult)과 동일 집계 필드. */
export interface ExtractResult {
  fileCount: number;
  excluded: { pattern: string; count: number }[];
  strippedRoot?: string;
}

/** 클라이언트가 Storage 업로드 후 complete API에 통보하는 manifest. */
export interface MockupManifest {
  entries: string[];
  indexPath: string;
  excluded: { pattern: string; count: number }[];
  strippedRoot?: string;
}

export interface ProcessedFile {
  path: string;
  data: Uint8Array;
  contentType: string;
}
