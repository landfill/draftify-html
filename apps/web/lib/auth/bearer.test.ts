import { describe, expect, it } from "vitest";
import { hasBearerAuth } from "./bearer.js";

describe("hasBearerAuth", () => {
  it("Bearer 헤더가 있으면 true", () => {
    const req = new Request("http://x", { headers: { Authorization: "Bearer tok_x" } });
    expect(hasBearerAuth(req)).toBe(true);
  });

  it("없으면 false", () => {
    expect(hasBearerAuth(new Request("http://x"))).toBe(false);
  });
});
