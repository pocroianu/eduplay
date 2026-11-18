import { describe, expect, it } from "vitest";
import { classifyDeclarations, unresolvedVariables } from "../../../scripts/check-css-classes";

it("identifies unresolved variables while allowing definitions, fallbacks and runtime values", () => {
  expect(unresolvedVariables("var(--missing) var(--defined) var(--optional, red) var(--mantine-color) var(--curve-color)", new Set(["--defined"]))).toEqual(["--missing"]);
});

describe("CSS declaration classification", () => {
  it("ignores order, whitespace, semicolons and zero units", () => {
    expect(classifyDeclarations([" | padding: 0px;", " | display: flex"], [" | display:flex", " | padding: 0"])).toEqual([]);
  });

  it("reports a literal colour replaced by a colour token", () => {
    expect(classifyDeclarations([" | background-color: #ff6b6b"], [" | background-color: var(--color-coral)"])[0].kind).toBe("token-aligned");
  });

  it("reports a literal colour replaced by a token mix", () => {
    expect(classifyDeclarations([" | color: rgb(0 0 0)"], [" | color: color-mix(in oklab, var(--color-ink) 10%, transparent)"])[0].kind).toBe("token-aligned");
  });

  it("rejects changed sizes and colours without a token", () => {
    expect(classifyDeclarations([" | width: 4px", " | color: #fff"], [" | width: 8px", " | color: #000"]).map((diff) => diff.kind)).toEqual(["real", "real"]);
  });

  it("rejects removed declarations", () => {
    expect(classifyDeclarations([" | display: flex"], [])[0].kind).toBe("real");
  });

  it("preserves media context when comparing declarations", () => {
    expect(classifyDeclarations(["@media (width: 40rem) | color: #fff"], ["@media (width: 40rem) | color: var(--color-surface)"])[0].kind).toBe("token-aligned");
    expect(classifyDeclarations(["@media (width: 40rem) | color: #fff"], ["@media (width: 50rem) | color: var(--color-surface)"])[0].kind).toBe("real");
  });
});
