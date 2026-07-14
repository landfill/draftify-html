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

  it("S2 확장 — proxy 소스·마스킹 필드가 계약에 포함된다 (version 1 유지)", () => {
    const now = new Date().toISOString();
    const project: SpecProject = {
      version: 1,
      id: "prj_test000002",
      name: "프록시 샘플",
      createdAt: now,
      updatedAt: now,
      mockupSource: { type: "proxy", originUrl: "https://mockup.team-a.internal", registeredAt: now },
      sceneCodeSeq: 2,
      scenes: [
        {
          id: "scn_test00001",
          code: "SCR-001",
          title: "홈",
          route: "/",
          order: 0,
          annoNumberSeq: 1,
          snapshotAsset: "asset_orig00000001",
          maskedSnapshotAsset: "asset_mask00000001",
          maskedAt: now,
        },
      ],
      annotations: [],
      maskingRules: [{ id: "msk_test000001", find: "hong@corp.com", replace: "user@example.com" }],
    };
    // 직렬화 왕복 무손실 — spec.json 저장 형식과 동일
    expect(JSON.parse(JSON.stringify(project))).toEqual(project);
    expect(project.mockupSource.type).toBe("proxy");
  });

  it("S2.5 확장 — snippet 소스(경로 D)가 계약에 포함된다 (version 1 유지, 토큰 필드 없음)", () => {
    const now = new Date().toISOString();
    const project: SpecProject = {
      version: 1,
      id: "prj_test000003",
      name: "확장 주입 샘플",
      createdAt: now,
      updatedAt: now,
      mockupSource: { type: "snippet", registeredAt: now, lastSeenOrigin: "https://app.internal" },
      sceneCodeSeq: 1,
      scenes: [],
      annotations: [],
    };
    // 직렬화 왕복 무손실 + 토큰이 계약(spec.json)에 존재하지 않음을 형태로 보증
    expect(JSON.parse(JSON.stringify(project))).toEqual(project);
    expect(project.mockupSource.type).toBe("snippet");
    expect(Object.keys(project.mockupSource)).not.toContain("token");
    expect(Object.keys(project.mockupSource)).not.toContain("tokenHash");
  });

  it("전이 확장 — Annotation.transition이 계약에 포함되고 왕복 무손실 (version 1 유지)", () => {
    const now = new Date().toISOString();
    const anchor = {
      selector: "body > button:nth-of-type(1)",
      text: "로그인",
      rect: { x: 0.1, y: 0.2, w: 0.05, h: 0.03 },
    };
    const project: SpecProject = {
      version: 1,
      id: "prj_test000004",
      name: "전이 샘플",
      createdAt: now,
      updatedAt: now,
      mockupSource: { type: "upload", originalFilename: "mockup.zip", uploadedAt: now },
      sceneCodeSeq: 3,
      scenes: [
        { id: "scn_login00001", code: "SCR-001", title: "로그인", route: "/login", order: 0, annoNumberSeq: 2 },
        { id: "scn_home000001", code: "SCR-002", title: "홈", route: "/", order: 1, annoNumberSeq: 1 },
      ],
      annotations: [
        {
          id: "ann_test000001",
          sceneId: "scn_login00001",
          number: 1,
          anchor,
          title: "로그인 버튼",
          description: "성공하면 홈으로",
          transition: { toSceneId: "scn_home000001", condition: "성공 시" },
        },
        {
          // condition 없는 전이 — 라벨 없는 화살표
          id: "ann_test000002",
          sceneId: "scn_login00001",
          number: 2,
          anchor,
          title: "취소",
          description: "",
          transition: { toSceneId: "scn_home000001" },
        },
      ],
    };
    // 직렬화 왕복 무손실 — spec.json 저장 형식과 동일
    expect(JSON.parse(JSON.stringify(project))).toEqual(project);
    expect(project.annotations[0].transition?.toSceneId).toBe("scn_home000001");
    // transition 없는 기존(S1~S2.5) 어노테이션은 필드 자체가 없어 하위 호환
    const legacy: SpecProject = { ...project, annotations: [{ ...project.annotations[0], transition: undefined }] };
    expect(JSON.parse(JSON.stringify(legacy)).annotations[0]).not.toHaveProperty("transition");
  });

  it("작성자 라벨(T29) — ownerLabel이 계약에 포함되고 왕복 무손실, 없으면 하위 호환", () => {
    const now = new Date().toISOString();
    const project: SpecProject = {
      version: 1,
      id: "prj_test000005",
      name: "라벨 샘플",
      ownerLabel: "김기획",
      createdAt: now,
      updatedAt: now,
      mockupSource: { type: "upload", originalFilename: "mockup.zip", uploadedAt: now },
      sceneCodeSeq: 1,
      scenes: [],
      annotations: [],
    };
    expect(JSON.parse(JSON.stringify(project))).toEqual(project);
    expect(project.ownerLabel).toBe("김기획");
    // ownerLabel 없는 기존 spec은 필드 자체가 없어 하위 호환 (인증 아님 — 표시용)
    const legacy: SpecProject = { ...project, ownerLabel: undefined };
    expect(JSON.parse(JSON.stringify(legacy))).not.toHaveProperty("ownerLabel");
  });
});
