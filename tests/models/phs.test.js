import { expect, describe, test } from "@jest/globals";
import { phs } from "../../src/models/phs";
import { testDataUrls } from "./comftest"; // Import test URLs from comftest.js
import { assertNonEmptyRows, loadTestData } from "./testUtils.js";

const testDataUrl = testDataUrls.phs;

// Load data at module scope so test.each registers one test per row.
// loadTestData filters out array-input rows; the secondary filter below
// also drops rows whose outputs are missing or contain arrays.
const { testData, tolerances } = await loadTestData(testDataUrl, false);

const scalarRows = assertNonEmptyRows(
  testData.data.filter(({ outputs }) => {
    if (outputs === undefined || outputs === null) return false;
    return !Object.values(outputs).some((value) => Array.isArray(value));
  }),
  "phs scalar rows with finite outputs",
);

describe("phs", () => {
  test.each(scalarRows)("row #%#", ({ inputs, outputs }) => {
    const result = phs(
      inputs.tdb,
      inputs.tr,
      inputs.v,
      inputs.rh,
      inputs.met,
      inputs.clo,
      inputs.posture,
      inputs.wme,
      "7933-2004",
      inputs,
    );

    // Per-key tolerances: d_lim accumulates float boundary crossings (+/- 1.5
    // minute), sweat_loss_g / evap_load_wm2_min accumulate larger absolute
    // error (+/- 10), sweat_rate_watt diverges by +/- 0.3 because JS uses
    // half-up rounding while Python uses banker's rounding.
    for (let [key, value] of Object.entries(outputs)) {
      if (key.startsWith("d_lim")) {
        expect(Math.abs(result[key] - value)).toBeLessThanOrEqual(1.5);
      } else if (key === "sweat_loss_g" || key === "evap_load_wm2_min") {
        expect(Math.abs(result[key] - value)).toBeLessThanOrEqual(10);
      } else if (key === "sweat_rate_watt") {
        expect(Math.abs(result[key] - value)).toBeLessThanOrEqual(0.3);
      } else {
        const tol =
          tolerances && tolerances[key] !== undefined
            ? tolerances[key]
            : 0.0001;
        expect(Math.abs(result[key] - value)).toBeLessThanOrEqual(tol);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Input validation tests
// ---------------------------------------------------------------------------
describe("phs input validation", () => {
  test.each([
    ["tdb", "40", 40, 0.3, 33.85, 2.5, 0.5, "standing"],
    ["tr", 40, "40", 0.3, 33.85, 2.5, 0.5, "standing"],
    ["v", 40, 40, "0.3", 33.85, 2.5, 0.5, "standing"],
    ["rh", 40, 40, 0.3, "33.85", 2.5, 0.5, "standing"],
    ["met", 40, 40, 0.3, 33.85, "2.5", 0.5, "standing"],
    ["clo", 40, 40, 0.3, 33.85, 2.5, "0.5", "standing"],
    ["wme", 40, 40, 0.3, 33.85, 2.5, 0.5, "standing", "0"],
  ])("throws TypeError if %s is not a number", (_, ...args) => {
    expect(() => phs(...args)).toThrow(TypeError);
  });

  test("throws Error if model is not a valid enum", () => {
    expect(() =>
      phs(40, 40, 0.3, 33.85, 2.5, 0.5, "standing", 0, "INVALID"),
    ).toThrow(Error);
  });

  test("throws TypeError if kwargs.round is not a boolean", () => {
    expect(() =>
      phs(40, 40, 0.3, 33.85, 2.5, 0.5, "standing", 0, "7933-2023", {
        round: "true",
      }),
    ).toThrow(TypeError);
  });

  test("throws Error if posture is an invalid string", () => {
    expect(() => phs(40, 40, 0.3, 33.85, 2.5, 0.5, "invalid")).toThrow(Error);
  });

  test("throws Error if posture is an invalid number", () => {
    expect(() => phs(40, 40, 0.3, 33.85, 2.5, 0.5, 5)).toThrow(Error);
  });

  test.each([
    ["i_mst", { i_mst: "0.38" }],
    ["a_p", { a_p: "0.54" }],
    ["weight", { weight: "75" }],
    ["height", { height: "1.8" }],
    ["walk_sp", { walk_sp: "0" }],
    ["theta", { theta: "0" }],
    ["acclimatized", { acclimatized: "100" }],
    ["duration", { duration: "480" }],
    ["f_r", { f_r: "0.42" }],
    ["t_sk", { t_sk: "34.1" }],
    ["t_cr", { t_cr: "36.8" }],
    ["t_re", { t_re: "36.8" }],
    ["t_cr_eq", { t_cr_eq: "36.8" }],
    ["t_sk_t_cr_wg", { t_sk_t_cr_wg: "0.3" }],
    ["sweat_rate_watt", { sweat_rate_watt: "0" }],
    ["evap_load_wm2_min", { evap_load_wm2_min: "0" }],
  ])("throws TypeError if kwargs.%s is not a number", (_, kwargs) => {
    expect(() =>
      phs(40, 40, 0.3, 33.85, 2.5, 0.5, "standing", 0, "7933-2023", kwargs),
    ).toThrow(TypeError);
  });

  test("throws Error if kwargs.drink is not a valid enum", () => {
    expect(() =>
      phs(40, 40, 0.3, 33.85, 2.5, 0.5, "standing", 0, "7933-2023", {
        drink: 2,
      }),
    ).toThrow(Error);
  });
});
