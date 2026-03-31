import { describe } from "@jest/globals";
import { ankle_draft } from "../../src/models/ankle_draft.js";
import { testDataUrls } from "./comftest";
import { loadTestData, validateResult } from "./testUtils"; // Import shared utilities

let returnArray = false;

// use top-level await to load test data before tests are defined.
let { testData, tolerances } = await loadTestData(
  testDataUrls.ankleDraft,
  returnArray,
);

describe("ankle_draft", () => {
  test.each(testData.data)("Test case #%#", (testCase) => {
    const { inputs, outputs: expectedOutput } = testCase;
    const { tdb, tr, vr, rh, met, clo, v_ankle, units } = inputs;
    const modelResult = ankle_draft(tdb, tr, vr, rh, met, clo, v_ankle, units);

    validateResult(modelResult, expectedOutput, tolerances, inputs);
  });
});

// ---------------------------------------------------------------------------
// Scalar hardcoded tests
// Expected values obtained from pythermalcomfort reference implementation.
//
// Scenarios covered:
//   SC-1  Typical office conditions → low ankle draft PPD
//   SC-2  Higher ankle velocity → increased PPD
//   SC-3  Warm conditions with moderate ankle draft
//   SC-4  High ankle velocity → PPD exceeds 20% not acceptable
//   SC-5  IP units conversion
// ---------------------------------------------------------------------------
describe("ankle_draft scalar tests (hardcoded)", () => {
  test("SC-1 Typical office conditions → low ankle draft PPD", () => {
    const result = ankle_draft(25, 25, 0.2, 50, 1.2, 0.5, 0.1);
    expect(Math.abs(result.ppd_ad - 11.0)).toBeLessThanOrEqual(
      tolerances.ppd_ad,
    );
    expect(result.acceptability).toBe(true);
  });

  test("SC-2 Higher ankle velocity → increased PPD", () => {
    const result = ankle_draft(25, 25, 0.2, 50, 1.2, 0.5, 0.4);
    expect(Math.abs(result.ppd_ad - 23.5)).toBeLessThanOrEqual(
      tolerances.ppd_ad,
    );
    expect(result.acceptability).toBe(false);
  });

  test("SC-3 Warm conditions with moderate ankle draft", () => {
    const result = ankle_draft(27, 27, 0.2, 60, 1.2, 0.5, 0.2);
    expect(Math.abs(result.ppd_ad - 7.6)).toBeLessThanOrEqual(
      tolerances.ppd_ad,
    );
    expect(result.acceptability).toBe(true);
  });

  test("SC-4 High ankle velocity → PPD exceeds 20% not acceptable", () => {
    const result = ankle_draft(25, 25, 0.2, 50, 1.2, 0.5, 0.6);
    expect(Math.abs(result.ppd_ad - 36.1)).toBeLessThanOrEqual(
      tolerances.ppd_ad,
    );
    expect(result.acceptability).toBe(false);
  });

  test("SC-5 IP units conversion", () => {
    const result = ankle_draft(77, 77, 0.656, 50, 1.2, 0.5, 0.66, "IP");
    expect(Math.abs(result.ppd_ad - 14.4)).toBeLessThanOrEqual(
      tolerances.ppd_ad,
    );
    expect(result.acceptability).toBe(true);
  });
});
