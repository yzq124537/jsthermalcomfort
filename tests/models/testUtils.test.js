// Meta-tests for the shared validation harness in `testUtils.js`.
//
// These tests target the harness itself, not any model. They guard against
// the silent-skip class of bugs raised in Week 9 §一: a test wrapper that
// runs zero assertions yet reports green. Each case uses
// `expect.hasAssertions()` so the meta-tests cannot themselves silent-skip
// with zero effective assertions.

import { describe, expect, test } from "@jest/globals";
import {
  validateResult,
  filterScalarRows,
  assertNonEmptyRows,
} from "./testUtils.js";

describe("validateResult — silent-skip guards", () => {
  test("throws when expectedOutputs is an empty object", () => {
    expect.hasAssertions();
    // Without a guard, Object.keys({}).forEach runs zero assertions and
    // validateResult returns silently — the canonical silent-skip path.
    expect(() => validateResult({ a: 1 }, {}, {}, {})).toThrow();
  });

  test("throws when expectedOutputs is null", () => {
    expect.hasAssertions();
    expect(() => validateResult({ a: 1 }, null, {}, {})).toThrow();
  });

  test("throws when expectedOutputs is undefined", () => {
    expect.hasAssertions();
    expect(() => validateResult({ a: 1 }, undefined, {}, {})).toThrow();
  });

  test("throws when modelResult is null but expectedOutputs is non-empty", () => {
    expect.hasAssertions();
    expect(() => validateResult(null, { a: 1 }, {}, {})).toThrow();
  });

  test("throws when modelResult is undefined but expectedOutputs is non-empty", () => {
    expect.hasAssertions();
    expect(() => validateResult(undefined, { a: 1 }, {}, {})).toThrow();
  });
});

describe("validateResult — numeric comparison", () => {
  test("passes when actual is within tolerance", () => {
    expect.hasAssertions();
    expect(() =>
      validateResult({ a: 1.0001 }, { a: 1.0 }, { a: 0.001 }, {}),
    ).not.toThrow();
  });

  test("throws when actual exceeds tolerance", () => {
    expect.hasAssertions();
    expect(() =>
      validateResult({ a: 1.01 }, { a: 1.0 }, { a: 0.001 }, {}),
    ).toThrow();
  });

  test("falls back to default tolerance 0.0001 when tolerances is missing", () => {
    expect.hasAssertions();
    // Within default tolerance — passes.
    expect(() =>
      validateResult({ a: 1.00005 }, { a: 1.0 }, undefined, {}),
    ).not.toThrow();
    // Outside default tolerance — throws.
    expect(() =>
      validateResult({ a: 1.001 }, { a: 1.0 }, undefined, {}),
    ).toThrow();
  });

  test("treats null in expectedOutputs as NaN and matches NaN actual", () => {
    expect.hasAssertions();
    expect(() => validateResult({ a: NaN }, { a: null }, {}, {})).not.toThrow();
  });

  test("throws when expected is NaN but actual is finite", () => {
    expect.hasAssertions();
    expect(() => validateResult({ a: 1.0 }, { a: NaN }, {}, {})).toThrow();
  });

  test("throws when expected is finite but actual is NaN", () => {
    expect.hasAssertions();
    expect(() => validateResult({ a: NaN }, { a: 1.0 }, {}, {})).toThrow();
  });
});

describe("validateResult — array comparison", () => {
  test("passes element-wise within tolerance", () => {
    expect.hasAssertions();
    expect(() =>
      validateResult(
        { a: [1.0001, 2.0001] },
        { a: [1.0, 2.0] },
        { a: 0.001 },
        {},
      ),
    ).not.toThrow();
  });

  test("throws when actual is shorter than expected", () => {
    expect.hasAssertions();
    expect(() =>
      validateResult({ a: [1.0] }, { a: [1.0, 2.0] }, { a: 0.001 }, {}),
    ).toThrow();
  });

  test("throws when actual is longer than expected (silent-skip guard)", () => {
    expect.hasAssertions();
    // Without an explicit length check, extra trailing elements are not
    // asserted against, so a wrong-length output slips past silently.
    expect(() =>
      validateResult(
        { a: [1.0, 2.0, 999.0] },
        { a: [1.0, 2.0] },
        { a: 0.001 },
        {},
      ),
    ).toThrow();
  });

  test("throws when actual is not an array but expected is", () => {
    expect.hasAssertions();
    expect(() =>
      validateResult({ a: 1.0 }, { a: [1.0] }, { a: 0.001 }, {}),
    ).toThrow();
  });
});

describe("validateResult — non-numeric comparison", () => {
  test("passes when boolean values match", () => {
    expect.hasAssertions();
    expect(() =>
      validateResult({ a: true }, { a: true }, {}, {}),
    ).not.toThrow();
  });

  test("throws when boolean values differ", () => {
    expect.hasAssertions();
    expect(() => validateResult({ a: false }, { a: true }, {}, {})).toThrow();
  });

  test("passes when string values match", () => {
    expect.hasAssertions();
    expect(() =>
      validateResult({ a: "moderate" }, { a: "moderate" }, {}, {}),
    ).not.toThrow();
  });

  test("throws when string values differ", () => {
    expect.hasAssertions();
    expect(() =>
      validateResult({ a: "strong" }, { a: "moderate" }, {}, {}),
    ).toThrow();
  });
});

describe("filterScalarRows", () => {
  test("keeps rows whose inputs are all scalar", () => {
    expect.hasAssertions();
    const rows = [
      { inputs: { tdb: 25, rh: 50 }, outputs: { x: 1 } },
      { inputs: { tdb: 26, rh: 60 }, outputs: { x: 2 } },
    ];
    expect(filterScalarRows(rows)).toHaveLength(2);
  });

  test("drops rows containing any array input", () => {
    expect.hasAssertions();
    const rows = [
      { inputs: { tdb: 25, rh: 50 }, outputs: { x: 1 } },
      { inputs: { tdb: [25, 26], rh: 50 }, outputs: { x: 2 } },
    ];
    const kept = filterScalarRows(rows);
    expect(kept).toHaveLength(1);
    expect(kept[0].inputs.tdb).toBe(25);
  });

  test("returns empty array when every row has array inputs", () => {
    expect.hasAssertions();
    const rows = [
      { inputs: { tdb: [25, 26] }, outputs: { x: 1 } },
      { inputs: { rh: [50, 60] }, outputs: { x: 2 } },
    ];
    expect(filterScalarRows(rows)).toEqual([]);
  });
});

describe("assertNonEmptyRows", () => {
  test("returns the rows unchanged when non-empty", () => {
    expect.hasAssertions();
    const rows = [{ inputs: { tdb: 25 } }];
    expect(assertNonEmptyRows(rows, "label")).toBe(rows);
  });

  test("throws when the array is empty (post-filter silent-skip guard)", () => {
    expect.hasAssertions();
    // This is the path callers like pmv_ppd_ashrae.test.js / two_nodes.test.js
    // depend on: a fixture-drift filter that yields zero rows would otherwise
    // hand `test.each([])` an empty list and report green.
    expect(() => assertNonEmptyRows([], "pmv_ppd_ashrae rows")).toThrow(
      /pmv_ppd_ashrae rows/,
    );
  });

  test("throws when input is not an array", () => {
    expect.hasAssertions();
    expect(() => assertNonEmptyRows(undefined, "label")).toThrow();
  });
});
