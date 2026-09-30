import path from "node:path";
import { describe, it, expect } from "vitest";
import { toRepoRelative } from "../sense/paths.js";

describe("toRepoRelative", () => {
  it("relativizes an absolute path under the repo root", () => {
    const repo = path.resolve("fixtures/vulnerable-shop");
    const abs = path.join(repo, "server.js");
    expect(toRepoRelative(repo, abs)).toBe("server.js");
  });

  it("leaves an already-relative path relative, using forward slashes", () => {
    const repo = path.resolve("fixtures/vulnerable-shop");
    expect(toRepoRelative(repo, "server.js")).toBe("server.js");
  });

  it("handles nested paths", () => {
    const repo = path.resolve("fixtures/vulnerable-shop");
    const abs = path.join(repo, "src", "routes", "coupon.js");
    expect(toRepoRelative(repo, abs)).toBe("src/routes/coupon.js");
  });
});
