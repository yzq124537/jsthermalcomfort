import { describe, test } from "@jest/globals";
import { a_pmv } from "../../src/models/a_pmv.js";
import { testDataUrls } from "./comftest";
import { loadTestData, validateResult } from "./testUtils"; // Use the utils

let returnArray = false;

// use top-level await to load test data before tests are defined.
let { testData, tolerances } = await loadTestData(
  testDataUrls.aPmv,
  returnArray,
);

describe("a_pmv", () => {
  // automatically number each test case
  test.each(testData.data)("Test case #%#", (testCase) => {
    const { inputs, outputs: expectedOutput } = testCase;
    const { tdb, tr, vr, rh, met, clo, a_coefficient, wme } = inputs;

    const modelResult = a_pmv(tdb, tr, vr, rh, met, clo, a_coefficient, wme);

    validateResult(modelResult, expectedOutput, tolerances, inputs);
  });
});

// ---------------------------------------------------------------------------
// Scalar hardcoded tests
// Expected values obtained from pythermalcomfort reference implementation.
//
// Scenarios covered:
//   SC-1  Neutral comfort conditions
//   SC-2  Warm conditions with positive a_pmv
//   SC-3  Cool conditions with negative a_pmv
//   SC-4  Out-of-range tdb with limit_inputs=true → a_pmv is NaN
//   SC-5  Higher a_coefficient with warm inputs
// ---------------------------------------------------------------------------
describe("a_pmv scalar tests (hardcoded)", () => {
  test("SC-1 Neutral comfort conditions", () => {
    const result = a_pmv(22, 22, 0.1, 50, 1.2, 0.8, 0.293);
    expect(Math.abs(result.a_pmv - -0.2)).toBeLessThanOrEqual(tolerances.a_pmv);
  });

  test("SC-2 Warm conditions with positive a_pmv", () => {
    const result = a_pmv(28, 28, 0.1, 60, 1.4, 0.5, 0.293);
    expect(Math.abs(result.a_pmv - 0.91)).toBeLessThanOrEqual(tolerances.a_pmv);
  });

  test("SC-3 Cool conditions with negative a_pmv", () => {
    const result = a_pmv(18, 18, 0.1, 40, 1.2, 1.0, 0.293);
    expect(Math.abs(result.a_pmv - -1.06)).toBeLessThanOrEqual(
      tolerances.a_pmv,
    );
  });

  test("SC-4 Out-of-range tdb with limit_inputs=true → a_pmv is NaN", () => {
    const result = a_pmv(35, 35, 0.1, 50, 1.2, 0.5, 0.293, 0, {
      limit_inputs: true,
    });
    expect(result.a_pmv).toBeNaN();
  });

  test("SC-5 Higher a_coefficient with warm inputs", () => {
    const result = a_pmv(27, 27, 0.1, 55, 1.3, 0.6, 0.5);
    expect(Math.abs(result.a_pmv - 0.65)).toBeLessThanOrEqual(tolerances.a_pmv);
  });
});
