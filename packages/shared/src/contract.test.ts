import { describe, it, expect } from "vitest";
import {
  WORKING_NAME,
  RESERVED_PATH_PREFIX,
  type SpecProject,
} from "./index.js";

/**
 * T1 스모크: shared의 타입 계약과 상수가 런타임/컴파일 양쪽에서 유효한지 확인.
 * 소비 패키지(sdk·server·viewer)의 import 연결은 `tsc -b` 빌드 통과로 검증된다.
 */
describe("shared contract", () => {
  it("워킹네임 상수가 한 곳에서 노출된다", () => {
    expect(WORKING_NAME).toBe("mockspec");
    expect(RESERVED_PATH_PREFIX).toBe("/__mockspec");
  });

  it("SpecProject 형태가 계약과 일치한다", () => {
    const now = new Date().toISOString();
    const project: SpecProject = {
      version: 1,
      id: "prj_test000001",
      name: "샘플",
      createdAt: now,
      updatedAt: now,
      mockupSource: { type: "upload", originalFilename: "mockup.zip", uploadedAt: now },
      sceneCodeSeq: 1,
      scenes: [],
      annotations: [],
    };
    expect(project.version).toBe(1);
    expect(project.scenes).toHaveLength(0);
  });
});
