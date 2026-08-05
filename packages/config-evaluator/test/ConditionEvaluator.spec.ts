import { describe, test, expect } from "vitest";
import type { Condition, Operator } from "../src/types";
import { ConditionEvaluator } from "../src/ConditionEvaluator";

describe("ConditionEvaluator", () => {
  const evaluator = new ConditionEvaluator();

  describe("text comparison conditions", () => {
    test.each(["equals", "="] as const)("evaluates identifier equals (operator: %s)", (operator) => {
      const condition: Condition = {
        id: "a",
        attribute: "identifier",
        trait: undefined,
        operator,
        targetType: "text",
        targetValues: ["123456"],
      };

      expect(evaluator.evaluate(condition, { context: { id: "123456" } })).toBe(true);
      expect(evaluator.evaluate(condition, { context: { id: "123457" } })).toBe(false);
      expect(evaluator.evaluate(condition, {})).toBe(false);
    });

    test.each(["does NOT equal", "!=", "does not equal"] as Operator[])(
      "evaluates identifier not equals (operator: %s)",
      (operator) => {
        const condition: Condition = {
          id: "a",
          attribute: "identifier",
          trait: undefined,
          operator,
          targetType: "text",
          targetValues: ["123456"],
        };

        expect(evaluator.evaluate(condition, { context: { id: "123457" } })).toBe(true);
        expect(evaluator.evaluate(condition, { context: {} })).toBe(true);
        expect(evaluator.evaluate(condition, { context: { id: "123456" } })).toBe(false);
      },
    );

    test("evaluates identifier is one of", () => {
      const condition: Condition = {
        id: "a",
        attribute: "identifier",
        trait: undefined,
        operator: "is one of",
        targetType: "text",
        targetValues: ["AB", "CD", "FG"],
      };

      expect(evaluator.evaluate(condition, { context: { id: "AB" } })).toBe(true);
      expect(evaluator.evaluate(condition, { context: { id: "CD" } })).toBe(true);
      expect(evaluator.evaluate(condition, { context: { id: "FG" } })).toBe(true);
      expect(evaluator.evaluate(condition, { context: { id: "AC" } })).toBe(false);
      expect(evaluator.evaluate(condition, { context: { id: "cd" } })).toBe(false);
      expect(evaluator.evaluate(condition, { context: { id: "ABC" } })).toBe(false);
    });

    test.each(["is NOT one of", "is not one of"] as Operator[])(
      "evaluates identifier is NOT one of (operator: %s)",
      (operator) => {
        const condition: Condition = {
          id: "a",
          attribute: "identifier",
          trait: undefined,
          operator,
          targetType: "text",
          targetValues: ["AB", "CD", "FG"],
        };

        expect(evaluator.evaluate(condition, { context: { id: "AC" } })).toBe(true);
        expect(evaluator.evaluate(condition, { context: { id: "cd" } })).toBe(true);
        expect(evaluator.evaluate(condition, { context: { id: "" } })).toBe(true);
        expect(evaluator.evaluate(condition, { context: {} })).toBe(true);
        expect(evaluator.evaluate(condition, { context: { id: "AB" } })).toBe(false);
        expect(evaluator.evaluate(condition, { context: { id: "CD" } })).toBe(false);
        expect(evaluator.evaluate(condition, { context: { id: "FG" } })).toBe(false);
      },
    );

    test("evaluates identifier starts with any of", () => {
      const condition: Condition = {
        id: "a",
        attribute: "identifier",
        trait: undefined,
        operator: "starts with any of",
        targetType: "text",
        targetValues: ["A", "C", "F"],
      };

      expect(evaluator.evaluate(condition, { context: { id: "ABCD" } })).toBe(true);
      expect(evaluator.evaluate(condition, { context: { id: "CDE" } })).toBe(true);
      expect(evaluator.evaluate(condition, { context: { id: "FGH" } })).toBe(true);
      expect(evaluator.evaluate(condition, { context: { id: "BCDF" } })).toBe(false);
      expect(evaluator.evaluate(condition, { context: { id: "DFA" } })).toBe(false);
      expect(evaluator.evaluate(condition, { context: { id: "EACF" } })).toBe(false);
    });

    test.each(["does NOT start with any of", "does not start with any of"] as Operator[])(
      "evaluates identifier does NOT start with any of (operator: %s)",
      (operator) => {
        const condition: Condition = {
          id: "a",
          attribute: "identifier",
          trait: undefined,
          operator,
          targetType: "text",
          targetValues: ["A", "C", "F"],
        };

        expect(evaluator.evaluate(condition, { context: { id: "BCDF" } })).toBe(true);
        expect(evaluator.evaluate(condition, { context: { id: "DFA" } })).toBe(true);
        expect(evaluator.evaluate(condition, { context: { id: "EACF" } })).toBe(true);
        expect(evaluator.evaluate(condition, { context: { id: "" } })).toBe(true);
        expect(evaluator.evaluate(condition, { context: {} })).toBe(true);
        expect(evaluator.evaluate(condition, { context: { id: "ABCD" } })).toBe(false);
        expect(evaluator.evaluate(condition, { context: { id: "CDE" } })).toBe(false);
        expect(evaluator.evaluate(condition, { context: { id: "FGH" } })).toBe(false);
      },
    );

    test("evaluates identifier ends with any of", () => {
      const condition: Condition = {
        id: "a",
        attribute: "identifier",
        trait: undefined,
        operator: "ends with any of",
        targetType: "text",
        targetValues: ["A", "C", "F"],
      };

      expect(evaluator.evaluate(condition, { context: { id: "123A" } })).toBe(true);
      expect(evaluator.evaluate(condition, { context: { id: "23C" } })).toBe(true);
      expect(evaluator.evaluate(condition, { context: { id: "F" } })).toBe(true);
      expect(evaluator.evaluate(condition, { context: { id: "FBCFD" } })).toBe(false);
      expect(evaluator.evaluate(condition, { context: { id: "DFAB" } })).toBe(false);
      expect(evaluator.evaluate(condition, { context: { id: "EACF1" } })).toBe(false);
    });

    test.each(["does NOT end with any of", "does not end with any of"] as Operator[])(
      "evaluates identifier does NOT end with any of (operator: %s)",
      (operator) => {
        const condition: Condition = {
          id: "a",
          attribute: "identifier",
          trait: undefined,
          operator,
          targetType: "text",
          targetValues: ["A", "C", "F"],
        };

        expect(evaluator.evaluate(condition, { context: { id: "FBCFD" } })).toBe(true);
        expect(evaluator.evaluate(condition, { context: { id: "DFAB" } })).toBe(true);
        expect(evaluator.evaluate(condition, { context: { id: "EACF1" } })).toBe(true);
        expect(evaluator.evaluate(condition, { context: { id: "" } })).toBe(true);
        expect(evaluator.evaluate(condition, { context: {} })).toBe(true);
        expect(evaluator.evaluate(condition, { context: { id: "123A" } })).toBe(false);
        expect(evaluator.evaluate(condition, { context: { id: "23C" } })).toBe(false);
        expect(evaluator.evaluate(condition, { context: { id: "F" } })).toBe(false);
      },
    );

    test("evaluates identifier matches regex", () => {
      const condition: Condition = {
        id: "a",
        attribute: "identifier",
        trait: undefined,
        operator: "matches regex",
        targetType: "text",
        targetValues: ["[A-Z]"],
      };

      expect(evaluator.evaluate(condition, { context: { id: "ALEJANDRO" } })).toBe(true);
      expect(evaluator.evaluate(condition, { context: { id: "B" } })).toBe(true);
      expect(evaluator.evaluate(condition, { context: { id: "123456" } })).toBe(false);
      expect(evaluator.evaluate(condition, { context: { id: "." } })).toBe(false);
      expect(evaluator.evaluate(condition, { context: {} })).toBe(false);
    });

    test("evaluates identifier matches regex with invalid regex", () => {
      const condition: Condition = {
        id: "a",
        attribute: "identifier",
        trait: undefined,
        operator: "matches regex",
        targetType: "text",
        targetValues: ["["],
      };

      expect(evaluator.evaluate(condition, { context: { id: "ALEJANDRO" } })).toBe(false);
      expect(evaluator.evaluate(condition, { context: { id: "B" } })).toBe(false);
      expect(evaluator.evaluate(condition, { context: { id: "123456" } })).toBe(false);
      expect(evaluator.evaluate(condition, { context: { id: "." } })).toBe(false);
    });

    test.each(["does NOT match regex", "does not match regex"] as Operator[])(
      "evaluates identifier does NOT match regex (operator: %s)",
      (operator) => {
        const condition: Condition = {
          id: "a",
          attribute: "identifier",
          trait: undefined,
          operator,
          targetType: "text",
          targetValues: ["[A-Z]"],
        };

        expect(evaluator.evaluate(condition, { context: { id: "123456" } })).toBe(true);
        expect(evaluator.evaluate(condition, { context: { id: "." } })).toBe(true);
        expect(evaluator.evaluate(condition, { context: {} })).toBe(true);
        expect(evaluator.evaluate(condition, { context: { id: "ALEJANDRO" } })).toBe(false);
        expect(evaluator.evaluate(condition, { context: { id: "B" } })).toBe(false);
      },
    );

    test.each(["does NOT match regex", "does not match regex"] as Operator[])(
      "evaluates identifier does NOT match regex with invalid regex (operator: %s)",
      (operator) => {
        const condition: Condition = {
          id: "a",
          attribute: "identifier",
          trait: undefined,
          operator,
          targetType: "text",
          targetValues: ["["],
        };

        expect(evaluator.evaluate(condition, { context: { id: "ALEJANDRO" } })).toBe(true);
        expect(evaluator.evaluate(condition, { context: { id: "B" } })).toBe(true);
        expect(evaluator.evaluate(condition, { context: { id: "123456" } })).toBe(true);
        expect(evaluator.evaluate(condition, { context: { id: "." } })).toBe(true);
      },
    );

    test.each(["equals", "="] as const)("evaluates name equals (operator: %s)", (operator) => {
      const condition: Condition = {
        id: "a",
        attribute: "name",
        trait: undefined,
        operator,
        targetType: "text",
        targetValues: ["John"],
      };

      expect(evaluator.evaluate(condition, { context: { name: "John" } })).toBe(true);
      expect(evaluator.evaluate(condition, { context: { name: "Joe" } })).toBe(false);
      expect(evaluator.evaluate(condition, { context: { name: "john" } })).toBe(false);
    });

    test.each(["equals", "="] as const)("evaluates appName equals (operator: %s)", (operator) => {
      const condition: Condition = {
        id: "a",
        attribute: "appName",
        trait: undefined,
        operator,
        targetType: "text",
        targetValues: ["Safari"],
      };

      expect(evaluator.evaluate(condition, { metadata: { appName: "Safari" } })).toBe(true);
      expect(evaluator.evaluate(condition, { metadata: { appName: "Safaris" } })).toBe(false);
      expect(evaluator.evaluate(condition, { metadata: { appName: "safari" } })).toBe(false);
    });

    test.each(["equals", "="] as const)("evaluates top-level trait equals (operator: %s)", (operator) => {
      const condition: Condition = {
        id: "a",
        attribute: "traits",
        trait: "/city",
        operator,
        targetType: "text",
        targetValues: ["Portland"],
      };

      expect(evaluator.evaluate(condition, { context: { traits: { city: "Portland" } } })).toBe(true);
      expect(evaluator.evaluate(condition, { context: { traits: { city: "Seattle" } } })).toBe(false);
      expect(evaluator.evaluate(condition, { context: { traits: { City: "Portland" } } })).toBe(false);
      expect(evaluator.evaluate(condition, { context: { traits: { location: "Portland" } } })).toBe(false);
      expect(evaluator.evaluate(condition, { context: { traits: {} } })).toBe(false);
    });

    test.each(["equals", "="] as const)("evaluates nested trait equals (operator: %s)", (operator) => {
      const condition: Condition = {
        id: "a",
        attribute: "traits",
        trait: "/location/city",
        operator,
        targetType: "text",
        targetValues: ["Portland"],
      };

      expect(evaluator.evaluate(condition, { context: { traits: { location: { city: "Portland" } } } })).toBe(
        true,
      );
      expect(evaluator.evaluate(condition, { context: { traits: { location: { city: "Seattle" } } } })).toBe(
        false,
      );
      expect(evaluator.evaluate(condition, { context: { traits: { location: { City: "Portland" } } } })).toBe(
        false,
      );
      expect(evaluator.evaluate(condition, { context: { traits: { location: "Portland" } } })).toBe(false);
      expect(evaluator.evaluate(condition, { context: { traits: { city: "Portland" } } })).toBe(false);
      expect(evaluator.evaluate(condition, { context: { traits: {} } })).toBe(false);
    });

    test("evaluates a missing identifier as empty text", () => {
      const equalsEmpty: Condition = {
        id: "a",
        attribute: "identifier",
        trait: undefined,
        operator: "=",
        targetType: "text",
        targetValues: [""],
      };

      expect(evaluator.evaluate(equalsEmpty, {})).toBe(true);
      expect(evaluator.evaluate({ ...equalsEmpty, operator: "!=" }, {})).toBe(false);
      expect(evaluator.evaluate({ ...equalsEmpty, operator: "is one of", targetValues: ["a", ""] }, {})).toBe(
        true,
      );
      expect(
        evaluator.evaluate({ ...equalsEmpty, operator: "starts with any of", targetValues: [""] }, {}),
      ).toBe(true);
    });

    test.each(["^u", "undefined", "[a-z]", ".+"])(
      "does not match a missing identifier against the literal text 'undefined' (pattern: %s)",
      (pattern) => {
        const condition: Condition = {
          id: "a",
          attribute: "identifier",
          trait: undefined,
          operator: "matches regex",
          targetType: "text",
          targetValues: [pattern],
        };

        expect(evaluator.evaluate(condition, {})).toBe(false);
      },
    );

    test.each(["^$", ".*"])(
      "matches a missing identifier against a pattern that accepts the empty string (pattern: %s)",
      (pattern) => {
        const condition: Condition = {
          id: "a",
          attribute: "identifier",
          trait: undefined,
          operator: "matches regex",
          targetType: "text",
          targetValues: [pattern],
        };

        expect(evaluator.evaluate(condition, {})).toBe(true);
      },
    );

    test("evaluates a missing or null trait as empty text", () => {
      const condition: Condition = {
        id: "a",
        attribute: "traits",
        trait: "/x",
        operator: "=",
        targetType: "text",
        targetValues: [""],
      };

      expect(evaluator.evaluate(condition, { context: { traits: {} } })).toBe(true);
      expect(evaluator.evaluate(condition, { context: { traits: { x: null } } })).toBe(true);
    });

    test.each([[["a"]], [[1, 2]], [{ k: "v" }]])(
      "evaluates a structured trait as empty text (%j)",
      (value) => {
        const condition: Condition = {
          id: "a",
          attribute: "traits",
          trait: "/x",
          operator: "=",
          targetType: "text",
          targetValues: [""],
        };

        expect(evaluator.evaluate(condition, { context: { traits: { x: value } } })).toBe(true);
      },
    );

    test("does not match a structured trait against its JavaScript toString", () => {
      const condition: Condition = {
        id: "a",
        attribute: "traits",
        trait: "/x",
        operator: "=",
        targetType: "text",
        targetValues: ["a"],
      };

      expect(evaluator.evaluate(condition, { context: { traits: { x: ["a"] } } })).toBe(false);
      expect(
        evaluator.evaluate({ ...condition, targetValues: ["1,2"] }, { context: { traits: { x: [1, 2] } } }),
      ).toBe(false);
    });

    test.each([
      [true, "true"],
      [26, "26"],
      [26.5, "26.5"],
    ])("evaluates a scalar trait as its JSON text (%j)", (value, text) => {
      const condition: Condition = {
        id: "a",
        attribute: "traits",
        trait: "/x",
        operator: "=",
        targetType: "text",
        targetValues: [text as string],
      };

      expect(evaluator.evaluate(condition, { context: { traits: { x: value } } })).toBe(true);
    });

    test.each(["is NOT one of", "does NOT start with any of", "does NOT end with any of"] as Operator[])(
      "matches when there are no target values (operator: %s)",
      (operator) => {
        const condition: Condition = {
          id: "a",
          attribute: "identifier",
          trait: undefined,
          operator,
          targetType: "text",
          targetValues: [],
        };

        expect(evaluator.evaluate(condition, { context: { id: "abc" } })).toBe(true);
      },
    );

    test.each([
      "is one of",
      "starts with any of",
      "ends with any of",
      "=",
      "!=",
      "matches regex",
    ] as Operator[])("does not match when there are no target values (operator: %s)", (operator) => {
      const condition: Condition = {
        id: "a",
        attribute: "identifier",
        trait: undefined,
        operator,
        targetType: "text",
        targetValues: [],
      };

      expect(evaluator.evaluate(condition, { context: { id: "abc" } })).toBe(false);
    });
  });

  describe("number comparison conditions", () => {
    test.each(["=", "equals"] as const)("evaluates identifier equals (operator: %s)", (operator) => {
      const condition: Condition = {
        id: "a",
        attribute: "identifier",
        trait: undefined,
        operator,
        targetType: "number",
        targetValues: ["123456"],
      };

      expect(evaluator.evaluate(condition, { context: { id: "123456" } })).toBe(true);
      expect(evaluator.evaluate(condition, { context: { id: "123457" } })).toBe(false);
      expect(evaluator.evaluate(condition, { context: {} })).toBe(false);
    });

    test.each(["!=", "does NOT equal", "does not equal"] as Operator[])(
      "evaluates identifier not equals (operator: %s)",
      (operator) => {
        const condition: Condition = {
          id: "a",
          attribute: "identifier",
          trait: undefined,
          operator,
          targetType: "number",
          targetValues: ["123456"],
        };

        expect(evaluator.evaluate(condition, { context: { id: "123457" } })).toBe(true);
        expect(evaluator.evaluate(condition, { context: {} })).toBe(true);
        expect(evaluator.evaluate(condition, { context: { id: "123456" } })).toBe(false);
      },
    );

    test("evaluates identifier greater than", () => {
      const condition: Condition = {
        id: "a",
        attribute: "identifier",
        trait: undefined,
        operator: ">",
        targetType: "number",
        targetValues: ["10"],
      };

      expect(evaluator.evaluate(condition, { context: { id: "11" } })).toBe(true);
      expect(evaluator.evaluate(condition, { context: { id: "10.0001" } })).toBe(true);
      expect(evaluator.evaluate(condition, { context: { id: "10" } })).toBe(false);
      expect(evaluator.evaluate(condition, { context: { id: "9.999" } })).toBe(false);
      expect(evaluator.evaluate(condition, { context: {} })).toBe(false);
    });

    test("evaluates identifier greater than or equal", () => {
      const condition: Condition = {
        id: "a",
        attribute: "identifier",
        trait: undefined,
        operator: ">=",
        targetType: "number",
        targetValues: ["10"],
      };

      expect(evaluator.evaluate(condition, { context: { id: "10" } })).toBe(true);
      expect(evaluator.evaluate(condition, { context: { id: "11" } })).toBe(true);
      expect(evaluator.evaluate(condition, { context: { id: "10.0001" } })).toBe(true);
      expect(evaluator.evaluate(condition, { context: { id: "9.999" } })).toBe(false);
      expect(evaluator.evaluate(condition, { context: {} })).toBe(false);
    });

    test("evaluates identifier less than", () => {
      const condition: Condition = {
        id: "a",
        attribute: "identifier",
        trait: undefined,
        operator: "<",
        targetType: "number",
        targetValues: ["10"],
      };

      expect(evaluator.evaluate(condition, { context: { id: "9.999" } })).toBe(true);
      expect(evaluator.evaluate(condition, { context: { id: "10" } })).toBe(false);
      expect(evaluator.evaluate(condition, { context: { id: "11" } })).toBe(false);
      expect(evaluator.evaluate(condition, { context: { id: "10.0001" } })).toBe(false);
      expect(evaluator.evaluate(condition, { context: {} })).toBe(false);
    });

    test("evaluates identifier less than or equal", () => {
      const condition: Condition = {
        id: "a",
        attribute: "identifier",
        trait: undefined,
        operator: "<=",
        targetType: "number",
        targetValues: ["10"],
      };

      expect(evaluator.evaluate(condition, { context: { id: "10" } })).toBe(true);
      expect(evaluator.evaluate(condition, { context: { id: "9.999" } })).toBe(true);
      expect(evaluator.evaluate(condition, { context: { id: "11" } })).toBe(false);
      expect(evaluator.evaluate(condition, { context: { id: "10.0001" } })).toBe(false);
      expect(evaluator.evaluate(condition, { context: {} })).toBe(false);
    });

    test("evaluates trait greater than (numeric and string values)", () => {
      const condition: Condition = {
        id: "a",
        attribute: "traits",
        trait: "/profile/age",
        operator: ">",
        targetType: "number",
        targetValues: ["25"],
      };

      expect(evaluator.evaluate(condition, { context: { traits: { profile: { age: 26 } } } })).toBe(true);
      expect(evaluator.evaluate(condition, { context: { traits: { profile: { age: "26" } } } })).toBe(true);
      expect(evaluator.evaluate(condition, { context: { traits: { profile: { age: 25 } } } })).toBe(false);
      expect(evaluator.evaluate(condition, { context: { traits: { profile: { name: "John" } } } })).toBe(
        false,
      );
      expect(evaluator.evaluate(condition, { context: { traits: {} } })).toBe(false);
    });

    test.each(["26abc", " 42 ", "abc", "", "Infinity", "NaN"])(
      "treats a value that is not strictly a number as unparseable (value: %s)",
      (value) => {
        const greaterThan: Condition = {
          id: "a",
          attribute: "identifier",
          trait: undefined,
          operator: ">",
          targetType: "number",
          targetValues: ["25"],
        };

        expect(evaluator.evaluate(greaterThan, { context: { id: value } })).toBe(false);
        expect(evaluator.evaluate({ ...greaterThan, operator: "!=" }, { context: { id: value } })).toBe(true);
      },
    );

    test("does not throw for an unparseable value", () => {
      const condition: Condition = {
        id: "a",
        attribute: "identifier",
        trait: undefined,
        operator: "=",
        targetType: "number",
        targetValues: ["25"],
      };

      expect(() => evaluator.evaluate(condition, { context: { id: "abc" } })).not.toThrow();
      expect(evaluator.evaluate(condition, { context: { id: "abc" } })).toBe(false);
    });

    test("does not treat a boolean trait as a number", () => {
      const condition: Condition = {
        id: "a",
        attribute: "traits",
        trait: "/x",
        operator: "=",
        targetType: "number",
        targetValues: ["1"],
      };

      expect(evaluator.evaluate(condition, { context: { traits: { x: true } } })).toBe(false);
    });

    test("does not match an unparseable target value", () => {
      const condition: Condition = {
        id: "a",
        attribute: "identifier",
        trait: undefined,
        operator: "=",
        targetType: "number",
        targetValues: ["abc"],
      };

      expect(evaluator.evaluate(condition, { context: { id: "10" } })).toBe(false);
    });

    test("does not match when there are no target values", () => {
      const condition: Condition = {
        id: "a",
        attribute: "identifier",
        trait: undefined,
        operator: "=",
        targetType: "number",
        targetValues: [],
      };

      expect(evaluator.evaluate(condition, { context: { id: "10" } })).toBe(false);
    });
  });

  describe("semver comparison conditions", () => {
    test("evaluates trait greater than", () => {
      const condition: Condition = {
        id: "a",
        attribute: "traits",
        trait: "/system/version",
        operator: ">",
        targetType: "semver",
        targetValues: ["10.0.1"],
      };

      expect(evaluator.evaluate(condition, { context: { traits: { system: { version: "10.0.2" } } } })).toBe(
        true,
      );
      expect(evaluator.evaluate(condition, { context: { traits: { system: { version: "10.1.0" } } } })).toBe(
        true,
      );
      expect(evaluator.evaluate(condition, { context: { traits: { system: { version: "10.0.1" } } } })).toBe(
        false,
      );
      expect(
        evaluator.evaluate(condition, { context: { traits: { system: { version: "9.9.1000" } } } }),
      ).toBe(false);
      expect(evaluator.evaluate(condition, { context: { traits: {} } })).toBe(false);
    });

    test("evaluates trait greater than or equal", () => {
      const condition: Condition = {
        id: "a",
        attribute: "traits",
        trait: "/system/version",
        operator: ">=",
        targetType: "semver",
        targetValues: ["10.0.1"],
      };

      expect(evaluator.evaluate(condition, { context: { traits: { system: { version: "10.0.2" } } } })).toBe(
        true,
      );
      expect(evaluator.evaluate(condition, { context: { traits: { system: { version: "10.1.0" } } } })).toBe(
        true,
      );
      expect(evaluator.evaluate(condition, { context: { traits: { system: { version: "10.0.1" } } } })).toBe(
        true,
      );
      expect(
        evaluator.evaluate(condition, { context: { traits: { system: { version: "9.9.1000" } } } }),
      ).toBe(false);
      expect(evaluator.evaluate(condition, { context: { traits: {} } })).toBe(false);
    });

    test("evaluates trait less than", () => {
      const condition: Condition = {
        id: "a",
        attribute: "traits",
        trait: "/system/version",
        operator: "<",
        targetType: "semver",
        targetValues: ["10.0.1"],
      };

      expect(evaluator.evaluate(condition, { context: { traits: { system: { version: "10.0.0" } } } })).toBe(
        true,
      );
      expect(
        evaluator.evaluate(condition, { context: { traits: { system: { version: "9.9.1000" } } } }),
      ).toBe(true);
      expect(evaluator.evaluate(condition, { context: { traits: { system: { version: "10.0.2" } } } })).toBe(
        false,
      );
      expect(evaluator.evaluate(condition, { context: { traits: { system: { version: "10.1.0" } } } })).toBe(
        false,
      );
      expect(evaluator.evaluate(condition, { context: { traits: { system: { version: "10.0.1" } } } })).toBe(
        false,
      );
      expect(evaluator.evaluate(condition, { context: { traits: {} } })).toBe(false);
    });

    test("evaluates trait less than or equal", () => {
      const condition: Condition = {
        id: "a",
        attribute: "traits",
        trait: "/system/version",
        operator: "<=",
        targetType: "semver",
        targetValues: ["10.0.1"],
      };

      expect(evaluator.evaluate(condition, { context: { traits: { system: { version: "10.0.1" } } } })).toBe(
        true,
      );
      expect(evaluator.evaluate(condition, { context: { traits: { system: { version: "10.0.0" } } } })).toBe(
        true,
      );
      expect(
        evaluator.evaluate(condition, { context: { traits: { system: { version: "9.9.1000" } } } }),
      ).toBe(true);
      expect(evaluator.evaluate(condition, { context: { traits: { system: { version: "10.0.2" } } } })).toBe(
        false,
      );
      expect(evaluator.evaluate(condition, { context: { traits: {} } })).toBe(false);
    });

    test("evaluates trait is one of", () => {
      const condition: Condition = {
        id: "a",
        attribute: "traits",
        trait: "/system/v",
        operator: "is one of",
        targetType: "semver",
        targetValues: ["10.0.1", "1.0", "0.1.645-a"],
      };

      expect(evaluator.evaluate(condition, { context: { traits: { system: { v: "10.0.1" } } } })).toBe(true);
      expect(evaluator.evaluate(condition, { context: { traits: { system: { v: "1.0" } } } })).toBe(true);
      expect(evaluator.evaluate(condition, { context: { traits: { system: { v: "1.0.0" } } } })).toBe(true);
      expect(evaluator.evaluate(condition, { context: { traits: { system: { v: "0.1.645-a" } } } })).toBe(
        true,
      );
      expect(evaluator.evaluate(condition, { context: { traits: { system: { v: "10.0" } } } })).toBe(false);
      expect(evaluator.evaluate(condition, { context: { traits: { system: { v: "1.0.1" } } } })).toBe(false);
      expect(evaluator.evaluate(condition, { context: { traits: {} } })).toBe(false);
    });

    test("evaluates trait =", () => {
      const condition: Condition = {
        id: "a",
        attribute: "traits",
        trait: "/system/v",
        operator: "=",
        targetType: "semver",
        targetValues: ["10.0.1"],
      };

      expect(evaluator.evaluate(condition, { context: { traits: { system: { v: "10.0.1" } } } })).toBe(true);
      expect(evaluator.evaluate(condition, { context: { traits: { system: { v: "10.0" } } } })).toBe(false);
      expect(evaluator.evaluate(condition, { context: { traits: { system: { v: "1.0.1" } } } })).toBe(false);
      expect(evaluator.evaluate(condition, { context: { traits: {} } })).toBe(false);
    });

    test.each(["is NOT one of", "is not one of"] as Operator[])(
      "evaluates trait is NOT one of (operator: %s)",
      (operator) => {
        const condition: Condition = {
          id: "a",
          attribute: "traits",
          trait: "/system/v",
          operator,
          targetType: "semver",
          targetValues: ["10.0.1", "1.0", "0.1.645-a"],
        };

        expect(evaluator.evaluate(condition, { context: { traits: { system: { v: "10.0" } } } })).toBe(true);
        expect(evaluator.evaluate(condition, { context: { traits: { system: { v: "1.0.1" } } } })).toBe(true);
        expect(evaluator.evaluate(condition, { context: { traits: {} } })).toBe(true);
        expect(evaluator.evaluate(condition, { context: { traits: { system: { v: "10.0.1" } } } })).toBe(
          false,
        );
        expect(evaluator.evaluate(condition, { context: { traits: { system: { v: "1.0" } } } })).toBe(false);
        expect(evaluator.evaluate(condition, { context: { traits: { system: { v: "0.1.645-a" } } } })).toBe(
          false,
        );
      },
    );

    test("evaluates appVersion greater than or equal", () => {
      const condition: Condition = {
        id: "a",
        attribute: "appVersion",
        trait: undefined,
        operator: ">=",
        targetType: "semver",
        targetValues: ["10.0.1"],
      };

      expect(evaluator.evaluate(condition, { metadata: { appVersion: "10.0.2" } })).toBe(true);
      expect(evaluator.evaluate(condition, { metadata: { appVersion: "10.1.0" } })).toBe(true);
      expect(evaluator.evaluate(condition, { metadata: { appVersion: "10.0.1" } })).toBe(true);
      expect(evaluator.evaluate(condition, { metadata: { appVersion: "9.9.1000" } })).toBe(false);
      expect(evaluator.evaluate(condition, { metadata: {} })).toBe(false);
    });

    test.each(["is NOT one of", "is not one of"] as Operator[])(
      "matches when there are no target values (operator: %s)",
      (operator) => {
        const condition: Condition = {
          id: "a",
          attribute: "appVersion",
          trait: undefined,
          operator,
          targetType: "semver",
          targetValues: [],
        };

        expect(evaluator.evaluate(condition, { metadata: { appVersion: "1.0.0" } })).toBe(true);
      },
    );

    test.each(["v2.3.4", "2.3.4.5", "2.3.4-beta.1"] as const)(
      "coerces a version before comparing it (value: %s)",
      (appVersion) => {
        const condition: Condition = {
          id: "a",
          attribute: "appVersion",
          trait: undefined,
          operator: "=",
          targetType: "semver",
          targetValues: ["2.3.4"],
        };

        expect(evaluator.evaluate(condition, { metadata: { appVersion } })).toBe(true);
      },
    );
  });

  describe("datetime comparison conditions", () => {
    test("evaluates trait is before", () => {
      const condition: Condition = {
        id: "a",
        attribute: "traits",
        trait: "/date",
        operator: "is before",
        targetType: "datetime",
        targetValues: ["2026-01-28T01:25:00.000Z"],
      };

      expect(evaluator.evaluate(condition, { context: { traits: { date: "2026-01-28" } } })).toBe(true);
      expect(
        evaluator.evaluate(condition, { context: { traits: { date: "2026-01-28T01:24:59.999Z" } } }),
      ).toBe(true);
      expect(
        evaluator.evaluate(condition, { context: { traits: { date: "2026-01-28T01:25:00.000Z" } } }),
      ).toBe(false);
      expect(evaluator.evaluate(condition, { context: { traits: { date: "2026-01-29" } } })).toBe(false);
      expect(evaluator.evaluate(condition, { context: { traits: {} } })).toBe(false);
    });

    test("evaluates trait is after", () => {
      const condition: Condition = {
        id: "a",
        attribute: "traits",
        trait: "/date",
        operator: "is after",
        targetType: "datetime",
        targetValues: ["2026-01-28T01:25:00.000Z"],
      };

      expect(evaluator.evaluate(condition, { context: { traits: { date: "2026-01-29" } } })).toBe(true);
      expect(
        evaluator.evaluate(condition, { context: { traits: { date: "2026-01-28T01:25:00.001Z" } } }),
      ).toBe(true);
      expect(
        evaluator.evaluate(condition, { context: { traits: { date: "2026-01-28T01:25:00.000Z" } } }),
      ).toBe(false);
      expect(evaluator.evaluate(condition, { context: { traits: { date: "2026-01-28" } } })).toBe(false);
      expect(evaluator.evaluate(condition, { context: { traits: {} } })).toBe(false);
    });

    test("evaluates a date-time without an offset as UTC", () => {
      const condition: Condition = {
        id: "a",
        attribute: "traits",
        trait: "/date",
        operator: "is before",
        targetType: "datetime",
        targetValues: ["2026-01-28T01:25:00.000Z"],
      };

      expect(evaluator.evaluate(condition, { context: { traits: { date: "2026-01-28T01:24:59" } } })).toBe(
        true,
      );
      expect(evaluator.evaluate(condition, { context: { traits: { date: "2026-01-28T01:25:00" } } })).toBe(
        false,
      );
      expect(evaluator.evaluate(condition, { context: { traits: { date: "2026-01-28T01:25:01" } } })).toBe(
        false,
      );
    });

    test("evaluates a partial date", () => {
      const condition: Condition = {
        id: "a",
        attribute: "traits",
        trait: "/date",
        operator: "is before",
        targetType: "datetime",
        targetValues: ["2026-01-28T01:25:00.000Z"],
      };

      expect(evaluator.evaluate(condition, { context: { traits: { date: "2026" } } })).toBe(true);
      expect(evaluator.evaluate(condition, { context: { traits: { date: "2026-01" } } })).toBe(true);
    });

    test("honours an explicit offset", () => {
      const condition: Condition = {
        id: "a",
        attribute: "traits",
        trait: "/date",
        operator: "is before",
        targetType: "datetime",
        targetValues: ["2026-01-28T01:25:00.000Z"],
      };

      expect(
        evaluator.evaluate(condition, { context: { traits: { date: "2026-01-28T03:24:59+02:00" } } }),
      ).toBe(true);
    });

    test.each(["garbage", "2026-13-01", "2026-01-32", "28/01/2026"])(
      "does not match an unparseable date (value: %s)",
      (date) => {
        const condition: Condition = {
          id: "a",
          attribute: "traits",
          trait: "/date",
          operator: "is before",
          targetType: "datetime",
          targetValues: ["2026-01-28T01:25:00.000Z"],
        };

        expect(evaluator.evaluate(condition, { context: { traits: { date } } })).toBe(false);
      },
    );
  });

  describe("array comparison conditions", () => {
    test("evaluates trait contains any of", () => {
      const condition: Condition = {
        id: "a",
        attribute: "traits",
        trait: "/tags",
        operator: "contains any of",
        targetType: "array",
        targetValues: ["blue", "yellow", "orange"],
      };

      expect(
        evaluator.evaluate(condition, { context: { traits: { tags: ["black", "pink", "blue"] } } }),
      ).toBe(true);
      expect(evaluator.evaluate(condition, { context: { traits: { tags: ["yellow", "pink"] } } })).toBe(true);
      expect(
        evaluator.evaluate(condition, { context: { traits: { tags: ["white", "orange", "purple"] } } }),
      ).toBe(true);
      expect(
        evaluator.evaluate(condition, { context: { traits: { tags: ["pink", "purple", "blu"] } } }),
      ).toBe(false);
      expect(evaluator.evaluate(condition, { context: { traits: { tags: [1, 2, 3] } } })).toBe(false);
      expect(evaluator.evaluate(condition, { context: { traits: { tags: [] } } })).toBe(false);
      expect(evaluator.evaluate(condition, { context: { traits: { tags: "blue, 2, 3" } } })).toBe(false);
      expect(evaluator.evaluate(condition, { context: { traits: {} } })).toBe(false);
    });

    test.each(["does NOT contain any of", "does not contain any of"] as Operator[])(
      "evaluates trait does NOT contain any of (operator: %s)",
      (operator) => {
        const condition: Condition = {
          id: "a",
          attribute: "traits",
          trait: "/tags",
          operator,
          targetType: "array",
          targetValues: ["blue", "yellow", "orange"],
        };

        expect(
          evaluator.evaluate(condition, { context: { traits: { tags: ["pink", "purple", "blu"] } } }),
        ).toBe(true);
        expect(evaluator.evaluate(condition, { context: { traits: { tags: [1, 2, 3] } } })).toBe(true);
        expect(evaluator.evaluate(condition, { context: { traits: { tags: [true, false, false] } } })).toBe(
          true,
        );
        expect(evaluator.evaluate(condition, { context: { traits: { tags: [] } } })).toBe(true);
        expect(evaluator.evaluate(condition, { context: { traits: { tags: "blue, 2, 3" } } })).toBe(true);
        expect(evaluator.evaluate(condition, { context: { traits: {} } })).toBe(true);
        expect(evaluator.evaluate(condition, {})).toBe(true);
        expect(
          evaluator.evaluate(condition, { context: { traits: { tags: ["black", "pink", "blue"] } } }),
        ).toBe(false);
        expect(evaluator.evaluate(condition, { context: { traits: { tags: ["yellow", "pink"] } } })).toBe(
          false,
        );
        expect(
          evaluator.evaluate(condition, { context: { traits: { tags: ["white", "orange", "purple"] } } }),
        ).toBe(false);
      },
    );

    test("evaluates an array condition with no target values", () => {
      const contains: Condition = {
        id: "a",
        attribute: "traits",
        trait: "/tags",
        operator: "contains any of",
        targetType: "array",
        targetValues: [],
      };
      const context = { context: { traits: { tags: ["blue"] } } };

      expect(evaluator.evaluate(contains, context)).toBe(false);
      expect(evaluator.evaluate({ ...contains, operator: "does NOT contain any of" }, context)).toBe(true);
    });

    test("matches numeric and boolean elements against string target values", () => {
      const condition: Condition = {
        id: "a",
        attribute: "traits",
        trait: "/tags",
        operator: "contains any of",
        targetType: "array",
        targetValues: ["1"],
      };

      expect(evaluator.evaluate(condition, { context: { traits: { tags: [1, 2] } } })).toBe(true);
      expect(
        evaluator.evaluate(
          { ...condition, targetValues: ["true"] },
          { context: { traits: { tags: [true] } } },
        ),
      ).toBe(true);
    });

    test("drops structured elements rather than matching them as empty text", () => {
      const condition: Condition = {
        id: "a",
        attribute: "traits",
        trait: "/tags",
        operator: "contains any of",
        targetType: "array",
        targetValues: [""],
      };

      expect(
        evaluator.evaluate(condition, { context: { traits: { tags: [["a"], { k: "v" }, null] } } }),
      ).toBe(false);
    });
  });

  describe("edge cases", () => {
    test("returns false for unknown attribute", () => {
      const condition: Condition = {
        id: "a",
        attribute: "unknownAttribute",
        trait: undefined,
        operator: "equals",
        targetType: "text",
        targetValues: ["value"],
      };

      expect(evaluator.evaluate(condition, { context: {} })).toBe(false);
    });

    test.each(["equals", "="] as const)(
      "evaluates appVersion with text equals (operator: %s)",
      (operator) => {
        const condition: Condition = {
          id: "a",
          attribute: "appVersion",
          trait: undefined,
          operator,
          targetType: "text",
          targetValues: ["1.2.3"],
        };

        expect(evaluator.evaluate(condition, { metadata: { appVersion: "1.2.3" } })).toBe(true);
        expect(evaluator.evaluate(condition, { metadata: { appVersion: "1.2.4" } })).toBe(false);
        expect(evaluator.evaluate(condition, {})).toBe(false);
      },
    );

    test.each(["equals", "="] as const)(
      "returns false when traits path is missing (operator: %s)",
      (operator) => {
        const condition: Condition = {
          id: "a",
          attribute: "traits",
          trait: undefined,
          operator,
          targetType: "text",
          targetValues: ["value"],
        };

        expect(evaluator.evaluate(condition, { context: { traits: { key: "value" } } })).toBe(false);
      },
    );

    test.each(["equals", "="] as const)(
      "evaluates a traits condition with no trait path as empty text (operator: %s)",
      (operator) => {
        const condition: Condition = {
          id: "a",
          attribute: "traits",
          trait: undefined,
          operator,
          targetType: "text",
          targetValues: [""],
        };

        expect(evaluator.evaluate(condition, { context: { traits: { key: "value" } } })).toBe(true);
      },
    );

    test("returns false for an unknown attribute even when the operator is negative", () => {
      const condition: Condition = {
        id: "a",
        attribute: "unknownAttribute",
        trait: undefined,
        operator: "does NOT contain any of",
        targetType: "array",
        targetValues: ["value"],
      };

      expect(evaluator.evaluate(condition, { context: {} })).toBe(false);
    });
  });
});
