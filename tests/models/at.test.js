import { describe } from "@jest/globals";
import { at } from "../../src/models/at.js";
import { testDataUrls } from "./comftest";
import { loadTestData, validateResult } from "./testUtils"; // Import shared utilities

let returnArray = false;

// use top-level await to load test data before tests are defined.
let { testData, tolerances } = await loadTestData(testDataUrls.at, returnArray);

describe("at", () => {
  test.each(testData.data)("Test case #%#", (testCase) => {
    const { inputs, outputs: expectedOutput } = testCase;
    const { tdb, rh, v, q } = inputs;
    const modelResult = at(tdb, rh, v, q);

    validateResult(modelResult, expectedOutput, tolerances, inputs);
  });
});

// ---------------------------------------------------------------------------
// Scalar hardcoded tests
// Expected values obtained from pythermalcomfort reference implementation.
//
// Scenarios covered:
//   SC-1  Warm and humid conditions without solar radiation
//   SC-2  Cool and windy conditions → wind chill effect reduces AT below tdb
//   SC-3  Hot conditions with high relative humidity → humidity raises AT above tdb
//   SC-4  Solar radiation included (q=200 W/m2) → AT higher than without solar load
//   SC-5  Low humidity conditions without solar radiation
// ---------------------------------------------------------------------------
describe("at scalar tests (hardcoded)", () => {
  test("SC-1 Warm and humid conditions without solar radiation", () => {
    const result = at(30, 70, 0.5);
    expect(Math.abs(result.at - 35.5)).toBeLessThanOrEqual(tolerances.at);
  });

  test("SC-2 Cool and windy conditions → wind chill effect reduces AT below tdb", () => {
    const result = at(15, 50, 3.0);
    expect(Math.abs(result.at - 11.7)).toBeLessThanOrEqual(tolerances.at);
  });

  test("SC-3 Hot conditions with high relative humidity → humidity raises AT above tdb", () => {
    const result = at(35, 80, 0.2);
    expect(Math.abs(result.at - 45.7)).toBeLessThanOrEqual(tolerances.at);
  });

  test("SC-4 Solar radiation included (q=200 W/m2) → AT higher than without solar load", () => {
    const result = at(28, 60, 0.5, 200);
    expect(Math.abs(result.at - 44.6)).toBeLessThanOrEqual(tolerances.at);
  });

  test("SC-5 Low humidity conditions without solar radiation", () => {
    const result = at(28, 20, 0.5);
    expect(Math.abs(result.at - 26.1)).toBeLessThanOrEqual(tolerances.at);
  });
});
