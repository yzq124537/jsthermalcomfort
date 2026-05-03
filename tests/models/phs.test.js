import { expect, describe, it, test, beforeAll } from "@jest/globals";
import fetch from "node-fetch";
import { phs } from "../../src/models/phs";
import { testDataUrls } from "./comftest"; // Import test URLs from comftest.js

const testDataUrl = testDataUrls.phs;

let testData;
let tolerance;

beforeAll(async () => {
  try {
    const response = await fetch(testDataUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch test data: ${response.statusText}`);
    }

    testData = await response.json();
    tolerance = testData.tolerance; // Retrieve tolerance from remote data
  } catch (error) {
    console.error("Unable to fetch or parse test data:", error);
    throw error;
  }
});

describe("phs", () => {
  it("should run tests and skip data that contains arrays or undefined fields", () => {
    if (!testData || !testData.data) {
      throw new Error("Test data is not properly loaded");
    }

    testData.data.forEach(({ inputs, outputs }) => {
      // Check for arrays or undefined values in inputs or outputs
      const hasArrayOrUndefined =
        Object.values(inputs).some(
          (value) => Array.isArray(value) || value === undefined,
        ) || Object.values(outputs).some((value) => Array.isArray(value));

      if (hasArrayOrUndefined || outputs === undefined) {
        console.warn(
          `Skipping test due to missing or invalid inputs/outputs: inputs=${JSON.stringify(
            inputs,
          )}`,
        );
        return;
      }

      let result;
      try {
        result = phs(
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

        // Compare values with field-specific tolerance
        for (let [key, value] of Object.entries(outputs)) {
          if (key.startsWith("d_lim")) {
            // Allow +/- 1.5 minute due to float accumulation boundary crossing
            expect(Math.abs(result[key] - value)).toBeLessThanOrEqual(1.5);
          } else if (key === "sweat_loss_g" || key === "evap_load_wm2_min") {
            // Allow +/- 10 grams / units due to float accumulation
            expect(Math.abs(result[key] - value)).toBeLessThanOrEqual(10);
          } else if (key === "sweat_rate_watt") {
            // Allow +/- 0.3 diff since JS uses half-up rounding (266.15 -> 266.2) vs Python banker's rounding (266.1)
            expect(Math.abs(result[key] - value)).toBeLessThanOrEqual(0.3);
          } else {
            // Use the specified tolerance if available, otherwise default to a strict 0.0001
            const tol =
              tolerance && tolerance[key] !== undefined
                ? tolerance[key]
                : 0.0001;
            expect(Math.abs(result[key] - value)).toBeLessThanOrEqual(tol);
          }
        }
      } catch (error) {
        console.error("Test failed with inputs:", inputs);
        if (typeof result !== "undefined") {
          console.error("Received result:", result);
          console.error("Expected result:", outputs);
        }
        throw error; // Re-throw to display specific error details
      }
    });
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

  test("throws TypeError if kwargs.limit_inputs is not a boolean", () => {
    expect(() =>
      phs(40, 40, 0.3, 33.85, 2.5, 0.5, "standing", 0, "7933-2023", {
        limit_inputs: "true",
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

  test.each([
    ["acclimatized", { acclimatized: 50 }],
    ["acclimatized", { acclimatized: 75 }],
  ])("throws Error if kwargs.%s is not in {0, 100}", (_, kwargs) => {
    expect(() =>
      phs(40, 40, 0.3, 33.85, 2.5, 0.5, "standing", 0, "7933-2023", kwargs),
    ).toThrow(Error);
  });

  test.each([
    ["weight=0", { weight: 0 }],
    ["weight=-1", { weight: -1 }],
    ["weight=1001", { weight: 1001 }],
    ["t_sk_t_cr_wg=-0.1", { t_sk_t_cr_wg: -0.1 }],
    ["t_sk_t_cr_wg=1.1", { t_sk_t_cr_wg: 1.1 }],
    ["sweat_rate_watt=-1", { sweat_rate_watt: -1 }],
    ["evap_load_wm2_min=-1", { evap_load_wm2_min: -1 }],
  ])("throws RangeError if kwargs.%s is out of range", (_, kwargs) => {
    expect(() =>
      phs(40, 40, 0.3, 33.85, 2.5, 0.5, "standing", 0, "7933-2023", kwargs),
    ).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// Scalar tests — out-of-range inputs return all NaN
// ---------------------------------------------------------------------------
describe("phs scalar tests — inputs outside ISO 7933 applicability limits return all NaN", () => {
  const NAN_RESULT_KEYS = [
    "t_re",
    "t_sk",
    "t_cr",
    "t_cr_eq",
    "t_sk_t_cr_wg",
    "d_lim_loss_50",
    "d_lim_loss_95",
    "d_lim_t_re",
    "sweat_rate_watt",
    "sweat_loss_g",
    "evap_load_wm2_min",
  ];

  test("returns all NaN when tdb is below ISO 7933 lower limit (< 15)", () => {
    const result = phs(10, 40, 0.3, 33.85, 2.5, 0.5, "standing");
    NAN_RESULT_KEYS.forEach((key) => expect(result[key]).toBeNaN());
  });

  test("returns all NaN when tdb is above ISO 7933 upper limit (> 50)", () => {
    const result = phs(55, 55, 0.3, 33.85, 2.5, 0.5, "standing");
    NAN_RESULT_KEYS.forEach((key) => expect(result[key]).toBeNaN());
  });

  test("returns all NaN when v is above ISO 7933 upper limit (> 3)", () => {
    const result = phs(40, 40, 5, 33.85, 2.5, 0.5, "standing");
    NAN_RESULT_KEYS.forEach((key) => expect(result[key]).toBeNaN());
  });

  test("returns all NaN when tr is below ISO 7933 lower limit (< 0)", () => {
    const result = phs(40, -5, 0.3, 33.85, 2.5, 0.5, "standing");
    NAN_RESULT_KEYS.forEach((key) => expect(result[key]).toBeNaN());
  });

  test("returns all NaN when tr is above ISO 7933 upper limit (> 60)", () => {
    const result = phs(40, 65, 0.3, 33.85, 2.5, 0.5, "standing");
    NAN_RESULT_KEYS.forEach((key) => expect(result[key]).toBeNaN());
  });

  test("returns all NaN when rh produces p_a above ISO 7933 upper limit", () => {
    // tdb=40: rh_max ≈ 61%, rh=90 pushes p_a above 4.5 kPa
    const result = phs(40, 40, 0.3, 90, 2.5, 0.5, "standing");
    NAN_RESULT_KEYS.forEach((key) => expect(result[key]).toBeNaN());
  });

  test("returns all NaN when met is below ISO 7933 lower limit", () => {
    const result = phs(40, 40, 0.3, 33.85, 0.5, 0.5, "standing");
    NAN_RESULT_KEYS.forEach((key) => expect(result[key]).toBeNaN());
  });

  test("returns all NaN when met is above ISO 7933 upper limit", () => {
    const result = phs(40, 40, 0.3, 33.85, 8, 0.5, "standing");
    NAN_RESULT_KEYS.forEach((key) => expect(result[key]).toBeNaN());
  });

  test("returns all NaN when clo is below ISO 7933 lower limit (< 0.1)", () => {
    const result = phs(40, 40, 0.3, 33.85, 2.5, 0.05, "standing");
    NAN_RESULT_KEYS.forEach((key) => expect(result[key]).toBeNaN());
  });

  test("returns all NaN when clo is above ISO 7933 upper limit (> 1)", () => {
    const result = phs(40, 40, 0.3, 33.85, 2.5, 1.5, "standing");
    NAN_RESULT_KEYS.forEach((key) => expect(result[key]).toBeNaN());
  });

  test("valid inputs return finite results", () => {
    const result = phs(40, 40, 0.3, 33.85, 2.5, 0.5, "standing");
    NAN_RESULT_KEYS.forEach((key) =>
      expect(Number.isFinite(result[key])).toBe(true),
    );
  });

  test("returns all NaN when out-of-range with limit_inputs=true", () => {
    const result = phs(
      10,
      40,
      0.3,
      33.85,
      2.5,
      0.5,
      "standing",
      0,
      "7933-2023",
      {
        limit_inputs: true,
      },
    );
    NAN_RESULT_KEYS.forEach((key) => expect(result[key]).toBeNaN());
  });

  test("returns finite results when out-of-range with limit_inputs=false", () => {
    const result = phs(
      10,
      40,
      0.3,
      33.85,
      2.5,
      0.5,
      "standing",
      0,
      "7933-2023",
      {
        limit_inputs: false,
      },
    );
    NAN_RESULT_KEYS.forEach((key) =>
      expect(Number.isFinite(result[key])).toBe(true),
    );
  });
});
