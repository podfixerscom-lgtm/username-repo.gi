import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getDhakaDate,
  parseDhakaDate,
  resolveDhakaDateRange,
} from "./date-range";

describe("Dhaka reporting date ranges", () => {
  it("uses Bangladesh local dates and UTC boundaries", () => {
    assert.equal(getDhakaDate(new Date("2026-11-23T20:00:00.000Z")), "2026-11-24");
    const { range } = resolveDhakaDateRange(
      "2026-11-24",
      "2026-11-24",
      "2026-11-24",
      "2026-11-24",
    );
    assert.equal(range.startsAt.toISOString(), "2026-11-23T18:00:00.000Z");
    assert.equal(range.endsBefore.toISOString(), "2026-11-24T18:00:00.000Z");
  });

  it("rejects impossible dates and excessive ranges with a visible error", () => {
    assert.equal(parseDhakaDate("2026-02-31"), null);
    const result = resolveDhakaDateRange(
      "2024-01-01",
      "2026-11-24",
      "2026-11-24",
      "2026-11-24",
    );
    assert.match(result.error ?? "", /৩৬৬/);
    assert.equal(result.range.from, "2026-11-24");
  });
});
