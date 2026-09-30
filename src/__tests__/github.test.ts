import { describe, it, expect } from "vitest";
import { parseRepoInput } from "../connect/github.js";

describe("parseRepoInput", () => {
  it("parses owner/name shorthand", () => {
    expect(parseRepoInput("acme/widgets")).toEqual({ owner: "acme", name: "widgets" });
  });

  it("parses a full https URL", () => {
    expect(parseRepoInput("https://github.com/acme/widgets")).toEqual({
      owner: "acme",
      name: "widgets",
    });
  });

  it("strips a trailing .git", () => {
    expect(parseRepoInput("https://github.com/acme/widgets.git")).toEqual({
      owner: "acme",
      name: "widgets",
    });
  });

  it("extracts a branch ref from a /tree/ URL", () => {
    expect(parseRepoInput("https://github.com/acme/widgets/tree/feature/foo")).toEqual({
      owner: "acme",
      name: "widgets",
      ref: "feature/foo",
    });
  });

  it("accepts a bare host without scheme", () => {
    expect(parseRepoInput("github.com/acme/widgets")).toEqual({ owner: "acme", name: "widgets" });
  });

  it("throws on unparseable input", () => {
    expect(() => parseRepoInput("not-a-repo")).toThrow();
  });
});
