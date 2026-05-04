import fetch from "node-fetch"; // Import node-fetch to support data fetching

/**
 * Drop rows whose `inputs` contain any array-valued field. Pure helper so it
 * can be unit-tested without a network round trip.
 *
 * @param {Array<{ inputs: Object }>} rows
 * @returns {Array}
 */
export function filterScalarRows(rows) {
  return rows.filter((row) =>
    Object.values(row.inputs).every((value) => !Array.isArray(value)),
  );
}

// Load test data and extract tolerance
export async function loadTestData(url, returnArray = false) {
  let testData;
  let tolerances;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    testData = await response.json();
    tolerances = testData.tolerance;
  } catch (error) {
    console.error("Unable to fetch or parse test data:", error);
    throw error;
  }

  // If returnArray is false, filter out test cases that have array inputs.
  if (!returnArray && Array.isArray(testData.data)) {
    testData.data = filterScalarRows(testData.data);
    // Surface a silent-skip: callers iterate `testData.data`, so an empty
    // dataset registers zero tests yet reports green.
    if (testData.data.length === 0) {
      throw new Error(
        `loadTestData: 0 scalar rows after filtering (url=${url}). ` +
          `Pass returnArray=true if the dataset is array-valued.`,
      );
    }
  }
  return { testData, tolerances };
}

// Check if the test should be skipped (if it contains array data)
export function shouldSkipTest(inputs) {
  const values = Object.values(inputs);
  return values.some((value) => Array.isArray(value));
}

/**
 * Validates the model's output against the expected outputs using specified tolerances.
 *
 * @param {*} modelResult - The output from the model function, which can be either a primitive value or an object.
 * @param {Object} expectedOutputs - An object containing the expected outputs, with keys matching those in modelResult.
 * @param {Object} tolerances - An object specifying tolerance values for numeric comparisons for each key.
 * @param {Object} inputs - The input parameters used to generate modelResult, logged in case of test failure.
 */

export function validateResult(
  modelResult,
  expectedOutputs,
  tolerances,
  inputs,
) {
  // Silent-skip guards. Without these, an empty/missing `expectedOutputs`
  // makes Object.keys(...).forEach run zero assertions and the test reports
  // green. A null/undefined `modelResult` against non-empty expectations is
  // also treated as a hard failure rather than letting the property access
  // throw mid-loop with a confusing TypeError.
  if (
    expectedOutputs === null ||
    expectedOutputs === undefined ||
    typeof expectedOutputs !== "object"
  ) {
    throw new Error(
      "validateResult: expectedOutputs must be a non-null object.",
    );
  }
  const expectedKeys = Object.keys(expectedOutputs);
  if (expectedKeys.length === 0) {
    throw new Error(
      "validateResult: expectedOutputs is empty; refusing to run zero assertions.",
    );
  }
  if (modelResult === null || modelResult === undefined) {
    throw new Error(
      "validateResult: modelResult is null/undefined but expectedOutputs has keys.",
    );
  }

  try {
    expectedKeys.forEach((key) => {
      const expectedValue =
        expectedOutputs[key] === null ? NaN : expectedOutputs[key];
      const actualValue = modelResult[key];

      // Use the specified tolerance if available, otherwise default to a strict 0.0001
      const tol =
        tolerances && tolerances[key] !== undefined ? tolerances[key] : 0.0001;

      // Handle arrays
      if (Array.isArray(expectedValue)) {
        expect(Array.isArray(actualValue)).toBe(true);
        // Length check guards against the silent-skip where a longer actual
        // array slips trailing elements past the per-index loop.
        expect(actualValue).toHaveLength(expectedValue.length);
        expectedValue.forEach((exp, index) => {
          const act = actualValue[index];
          if (typeof exp === "number") {
            if (isNaN(exp)) {
              expect(act).toBeNaN();
            } else {
              expect(Math.abs(act - exp)).toBeLessThanOrEqual(
                tol + Number.EPSILON * 100,
              );
            }
          } else {
            expect(act).toEqual(exp);
          }
        });
      } else if (typeof expectedValue === "number") {
        // Handle numeric values
        if (isNaN(expectedValue)) {
          expect(actualValue).toBeNaN();
        } else {
          expect(Math.abs(actualValue - expectedValue)).toBeLessThanOrEqual(
            tol + Number.EPSILON * 100,
          );
        }
      } else {
        // For booleans or other types
        expect(actualValue).toEqual(expectedValue);
      }
    });
  } catch (error) {
    console.log("Test failed with the following context:");
    console.log("Inputs:", inputs);
    console.log("Expected outputs:", expectedOutputs);
    console.log("Model outputs:", modelResult);
    throw error;
  }
}
