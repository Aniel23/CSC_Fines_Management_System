import { describe, expect, it } from "vitest";
import { parseConfiguredFineTypes } from "@/lib/configuredFineTypes";

describe("parseConfiguredFineTypes", () => {
  it("returns no violations when there is no admin configuration", () => {
    expect(parseConfiguredFineTypes(null)).toEqual([]);
    expect(parseConfiguredFineTypes("not-json")).toEqual([]);
  });

  it("returns only unique violations with valid positive amounts", () => {
    expect(
      parseConfiguredFineTypes(
        JSON.stringify([
          { name: " Lost Book ", amount: "125.50" },
          { name: "lost book", amount: 200 },
          { name: "No Amount", amount: 0 },
          { name: "Missing Name", amount: 50 },
          { name: "Equipment Damage", amount: 300 },
        ]),
      ),
    ).toEqual([
      { name: "Lost Book", amount: 125.5 },
      { name: "Equipment Damage", amount: 300 },
    ]);
  });
});
