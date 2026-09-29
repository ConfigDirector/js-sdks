import { describe, expect, test } from "vitest";
import { resolveJsonPointer } from "../src/json-pointer";

describe("resolveJsonPointer", () => {
  describe("RFC 6901 section 5 examples", () => {
    const rfcDocument = JSON.parse(
      '{"foo":["bar","baz"],"":0,"a/b":1,"c%d":2,"e^f":3,"g|h":4,"i\\\\j":5,"k\\"l":6," ":7,"m~n":8}',
    );

    test('"" resolves to the whole document', () => {
      expect(resolveJsonPointer("", rfcDocument)).toBe(rfcDocument);
    });

    test('"/foo" resolves to ["bar", "baz"]', () => {
      expect(resolveJsonPointer("/foo", rfcDocument)).toEqual(["bar", "baz"]);
    });

    test('"/foo/0" resolves to "bar"', () => {
      expect(resolveJsonPointer("/foo/0", rfcDocument)).toBe("bar");
    });

    test('"/" resolves to 0', () => {
      expect(resolveJsonPointer("/", rfcDocument)).toBe(0);
    });

    test('"/a~1b" resolves to 1', () => {
      expect(resolveJsonPointer("/a~1b", rfcDocument)).toBe(1);
    });

    test('"/c%d" resolves to 2', () => {
      expect(resolveJsonPointer("/c%d", rfcDocument)).toBe(2);
    });

    test('"/e^f" resolves to 3', () => {
      expect(resolveJsonPointer("/e^f", rfcDocument)).toBe(3);
    });

    test('"/g|h" resolves to 4', () => {
      expect(resolveJsonPointer("/g|h", rfcDocument)).toBe(4);
    });

    test('"/i\\\\j" resolves to 5', () => {
      expect(resolveJsonPointer("/i\\j", rfcDocument)).toBe(5);
    });

    test('"/k\\"l" resolves to 6', () => {
      expect(resolveJsonPointer('/k"l', rfcDocument)).toBe(6);
    });

    test('"/ " resolves to 7', () => {
      expect(resolveJsonPointer("/ ", rfcDocument)).toBe(7);
    });

    test('"/m~0n" resolves to 8', () => {
      expect(resolveJsonPointer("/m~0n", rfcDocument)).toBe(8);
    });
  });

  describe("syntax", () => {
    test("a pointer without a leading slash resolves to nothing, even when a member matches its text", () => {
      const document = { foo: "foo", oo: "oo", xfoo: "xfoo" };

      expect(resolveJsonPointer("foo", document)).toBeUndefined();
      expect(resolveJsonPointer("xfoo", document)).toBeUndefined();
    });

    test("the URI fragment form resolves to nothing", () => {
      expect(resolveJsonPointer("#/foo", { foo: 1, "#": { foo: 2 } })).toBeUndefined();
    });

    test("a pointer starting with whitespace resolves to nothing", () => {
      expect(resolveJsonPointer(" /foo", { foo: 1 })).toBeUndefined();
    });

    test("percent-encoded characters are not decoded", () => {
      const document = { "c%d": "decoded", "c%25d": "literal" };

      expect(resolveJsonPointer("/c%25d", document)).toBe("literal");
    });

    test('"//" addresses the empty-named member of the empty-named member', () => {
      expect(resolveJsonPointer("//", { "": { "": "inner" } })).toBe("inner");
    });

    test("a trailing slash addresses the empty-named member", () => {
      expect(resolveJsonPointer("/a/", { a: { "": "empty", b: "b" } })).toBe("empty");
    });
  });

  describe("escapes", () => {
    test('"~0" decodes to "~"', () => {
      expect(resolveJsonPointer("/~0", { "~": "tilde" })).toBe("tilde");
    });

    test('"~1" decodes to "/"', () => {
      expect(resolveJsonPointer("/~1", { "/": "slash" })).toBe("slash");
    });

    test('"~01" decodes to "~1", not to "/"', () => {
      expect(resolveJsonPointer("/~01", { "~1": "tilde-one", "/": "slash" })).toBe("tilde-one");
    });

    test('"~10" decodes to "/0"', () => {
      expect(resolveJsonPointer("/~10", { "/0": "slash-zero", "~0": "tilde-zero" })).toBe("slash-zero");
    });

    test('"~00" decodes to "~0"', () => {
      expect(resolveJsonPointer("/~00", { "~0": "tilde-zero", "~": "tilde" })).toBe("tilde-zero");
    });

    test('"~0~1" decodes to "~/" and "~1~0" decodes to "/~"', () => {
      const document = { "~/": "tilde-slash", "/~": "slash-tilde" };

      expect(resolveJsonPointer("/~0~1", document)).toBe("tilde-slash");
      expect(resolveJsonPointer("/~1~0", document)).toBe("slash-tilde");
    });

    test("escapes decode inside longer tokens and in every token of the pointer", () => {
      expect(resolveJsonPointer("/a~1b~0c/d~0~1e", { "a/b~c": { "d~/e": "found" } })).toBe("found");
    });

    test("every occurrence of an escape in a token decodes", () => {
      const document = { "a/b/c": "slashes", "a~b~c": "tildes" };

      expect(resolveJsonPointer("/a~1b~1c", document)).toBe("slashes");
      expect(resolveJsonPointer("/a~0b~0c", document)).toBe("tildes");
    });

    test('a lone "~" makes the pointer invalid, even when a member is named "~"', () => {
      expect(resolveJsonPointer("/~", { "~": "tilde" })).toBeUndefined();
    });

    test('"~2" makes the pointer invalid, even when a member is named "~2"', () => {
      expect(resolveJsonPointer("/~2", { "~2": "tilde-two" })).toBeUndefined();
    });

    test("an invalid escape does not fall back to the empty-named member", () => {
      expect(resolveJsonPointer("/~2", { "": "empty", "~2": "tilde-two" })).toBeUndefined();
    });

    test('"~" followed by a letter makes the pointer invalid, even when a member matches the text', () => {
      expect(resolveJsonPointer("/~a", { "~a": "tilde-a" })).toBeUndefined();
    });

    test('a trailing "~" makes the pointer invalid, even when a member matches the text', () => {
      expect(resolveJsonPointer("/a~", { "a~": "a-tilde" })).toBeUndefined();
    });

    test('"~~" makes the pointer invalid, even when a member matches the text', () => {
      expect(resolveJsonPointer("/~~", { "~~": "two-tildes" })).toBeUndefined();
    });

    test('a "~" at the end of a token followed by "/" makes the pointer invalid', () => {
      expect(resolveJsonPointer("/a~/b", { "a~": { b: "found" } })).toBeUndefined();
    });

    test("an invalid escape in a later token makes the pointer invalid", () => {
      expect(resolveJsonPointer("/a/~2", { a: { "~2": "found" } })).toBeUndefined();
    });

    test("an invalid escape in an earlier token makes the pointer invalid even when a later token misses", () => {
      expect(resolveJsonPointer("/~2/missing", { "~2": { present: 1 } })).toBeUndefined();
    });
  });

  describe("arrays", () => {
    const letters = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k"];

    test('index "0" resolves to the first element', () => {
      expect(resolveJsonPointer("/0", letters)).toBe("a");
    });

    test("a multi-digit index resolves to its element", () => {
      expect(resolveJsonPointer("/10", letters)).toBe("k");
    });

    test("an index equal to the array length resolves to nothing", () => {
      expect(resolveJsonPointer("/11", letters)).toBeUndefined();
    });

    test("an index into an empty array resolves to nothing", () => {
      expect(resolveJsonPointer("/0", [])).toBeUndefined();
    });

    test('"-" resolves to nothing', () => {
      expect(resolveJsonPointer("/-", letters)).toBeUndefined();
    });

    test("an index with a leading zero resolves to nothing", () => {
      expect(resolveJsonPointer("/01", letters)).toBeUndefined();
      expect(resolveJsonPointer("/00", letters)).toBeUndefined();
    });

    test("a signed index resolves to nothing", () => {
      expect(resolveJsonPointer("/+1", letters)).toBeUndefined();
      expect(resolveJsonPointer("/-1", letters)).toBeUndefined();
      expect(resolveJsonPointer("/-0", letters)).toBeUndefined();
    });

    test("a decimal or exponent index resolves to nothing", () => {
      expect(resolveJsonPointer("/1.0", letters)).toBeUndefined();
      expect(resolveJsonPointer("/1.", letters)).toBeUndefined();
      expect(resolveJsonPointer("/1e0", letters)).toBeUndefined();
    });

    test("a hexadecimal, octal, or binary index resolves to nothing", () => {
      expect(resolveJsonPointer("/0x1", letters)).toBeUndefined();
      expect(resolveJsonPointer("/0o1", letters)).toBeUndefined();
      expect(resolveJsonPointer("/0b1", letters)).toBeUndefined();
    });

    test("an index with whitespace resolves to nothing", () => {
      expect(resolveJsonPointer("/ 1", letters)).toBeUndefined();
      expect(resolveJsonPointer("/1 ", letters)).toBeUndefined();
      expect(resolveJsonPointer("/\t1", letters)).toBeUndefined();
    });

    test("an index with a numeric separator resolves to nothing", () => {
      expect(resolveJsonPointer("/1_0", letters)).toBeUndefined();
    });

    test("an index written with non-ASCII digits resolves to nothing", () => {
      expect(resolveJsonPointer("/١", letters)).toBeUndefined();
      expect(resolveJsonPointer("/１", letters)).toBeUndefined();
    });

    test("an empty token on an array resolves to nothing", () => {
      expect(resolveJsonPointer("/", letters)).toBeUndefined();
    });

    test("array properties that are not elements resolve to nothing", () => {
      expect(resolveJsonPointer("/length", letters)).toBeUndefined();
      expect(resolveJsonPointer("/map", letters)).toBeUndefined();
      expect(resolveJsonPointer("/constructor", letters)).toBeUndefined();
    });

    test("an index beyond the largest safe integer resolves to nothing", () => {
      expect(resolveJsonPointer("/9007199254740993", letters)).toBeUndefined();
      expect(resolveJsonPointer("/99999999999999999999999", letters)).toBeUndefined();
    });

    test("an index on an array with extra named properties still only addresses elements", () => {
      const withNamedProperty = Object.assign(["a", "b"], { extra: "named" });

      expect(resolveJsonPointer("/extra", withNamedProperty)).toBeUndefined();
      expect(resolveJsonPointer("/1", withNamedProperty)).toBe("b");
    });

    test("named properties on an array that look like non-canonical indexes resolve to nothing", () => {
      const withIndexLikeNames = Object.assign(["a", "b"], {
        "01": "leading-zero",
        x1: "prefixed",
        "1x": "suffixed",
      });

      expect(resolveJsonPointer("/01", withIndexLikeNames)).toBeUndefined();
      expect(resolveJsonPointer("/x1", withIndexLikeNames)).toBeUndefined();
      expect(resolveJsonPointer("/1x", withIndexLikeNames)).toBeUndefined();
    });

    test("an element inherited through the prototype chain resolves to nothing", () => {
      const withPollutedPrototype = ["a"];
      Object.setPrototypeOf(
        withPollutedPrototype,
        Object.assign(Object.create(Array.prototype), { 1: "inherited" }),
      );

      expect(resolveJsonPointer("/0", withPollutedPrototype)).toBe("a");
      expect(resolveJsonPointer("/1", withPollutedPrototype)).toBeUndefined();
    });

    test("a hole in a sparse array resolves to nothing", () => {
      const sparse: unknown[] = [];
      sparse[2] = "third";

      expect(resolveJsonPointer("/0", sparse)).toBeUndefined();
      expect(resolveJsonPointer("/2", sparse)).toBe("third");
    });

    test("indexes resolve through nested arrays", () => {
      expect(
        resolveJsonPointer("/1/0", [
          [1, 2],
          [3, 4],
        ]),
      ).toBe(3);
    });

    test("an index resolves to a member of an object inside an array", () => {
      expect(resolveJsonPointer("/teams/1/name", { teams: [{ name: "search" }, { name: "billing" }] })).toBe(
        "billing",
      );
    });

    test("a null element resolves to null", () => {
      expect(resolveJsonPointer("/0", [null])).toBeNull();
    });
  });

  describe("objects", () => {
    test("member names that look like array indexes are ordinary names on objects", () => {
      const document = { "0": "zero", "01": "zero-one", "-": "dash", "-1": "minus-one", "1.0": "decimal" };

      expect(resolveJsonPointer("/0", document)).toBe("zero");
      expect(resolveJsonPointer("/01", document)).toBe("zero-one");
      expect(resolveJsonPointer("/-", document)).toBe("dash");
      expect(resolveJsonPointer("/-1", document)).toBe("minus-one");
      expect(resolveJsonPointer("/1.0", document)).toBe("decimal");
    });

    test("member names are case-sensitive", () => {
      expect(resolveJsonPointer("/Foo", { foo: "lower" })).toBeUndefined();
    });

    test("member names are compared without Unicode normalization", () => {
      const document = { é: "composed" };

      expect(resolveJsonPointer("/é", document)).toBe("composed");
      expect(resolveJsonPointer("/é", document)).toBeUndefined();
    });

    test("member names outside the Basic Multilingual Plane resolve", () => {
      expect(resolveJsonPointer("/\u{1F600}", { "\u{1F600}": "emoji" })).toBe("emoji");
    });

    test("names inherited from Object.prototype resolve to nothing", () => {
      const document = { own: 1 };

      expect(resolveJsonPointer("/constructor", document)).toBeUndefined();
      expect(resolveJsonPointer("/__proto__", document)).toBeUndefined();
      expect(resolveJsonPointer("/toString", document)).toBeUndefined();
      expect(resolveJsonPointer("/hasOwnProperty", document)).toBeUndefined();
      expect(resolveJsonPointer("/valueOf", document)).toBeUndefined();
      expect(resolveJsonPointer("/isPrototypeOf", document)).toBeUndefined();
      expect(resolveJsonPointer("/__defineGetter__", document)).toBeUndefined();
    });

    test("a member named __proto__ created by JSON.parse resolves", () => {
      expect(resolveJsonPointer("/__proto__", JSON.parse('{"__proto__": "own"}'))).toBe("own");
    });

    test("members of an object without a prototype resolve", () => {
      const document = Object.assign(Object.create(null), { x: "no-prototype" });

      expect(resolveJsonPointer("/x", document)).toBe("no-prototype");
      expect(resolveJsonPointer("/toString", document)).toBeUndefined();
    });

    test("a member that JSON would not serialize resolves to nothing", () => {
      const document = Object.defineProperty({ visible: 1 }, "hidden", { value: 2, enumerable: false });

      expect(resolveJsonPointer("/visible", document)).toBe(1);
      expect(resolveJsonPointer("/hidden", document)).toBeUndefined();
    });

    test("a getter inherited from a class resolves to nothing", () => {
      class Account {
        public readonly plan = "gold";
        public get tier() {
          return "premium";
        }
      }

      expect(resolveJsonPointer("/plan", new Account())).toBe("gold");
      expect(resolveJsonPointer("/tier", new Account())).toBeUndefined();
    });

    test("entries of a Map resolve to nothing", () => {
      expect(resolveJsonPointer("/plan", new Map([["plan", "gold"]]))).toBeUndefined();
    });

    test("a member whose value is undefined resolves to nothing", () => {
      expect(resolveJsonPointer("/x", { x: undefined })).toBeUndefined();
    });
  });

  describe("values that are not containers", () => {
    test("a token after a string resolves to nothing, not to a character", () => {
      expect(resolveJsonPointer("/s/0", { s: "abc" })).toBeUndefined();
      expect(resolveJsonPointer("/s/length", { s: "abc" })).toBeUndefined();
    });

    test("a token after a number resolves to nothing", () => {
      expect(resolveJsonPointer("/n/x", { n: 5 })).toBeUndefined();
      expect(resolveJsonPointer("/n/toFixed", { n: 5 })).toBeUndefined();
    });

    test("a token after a boolean resolves to nothing", () => {
      expect(resolveJsonPointer("/b/x", { b: true })).toBeUndefined();
    });

    test("a token after null resolves to nothing", () => {
      expect(resolveJsonPointer("/n/x", { n: null })).toBeUndefined();
    });

    test("a token after a missing member resolves to nothing", () => {
      expect(resolveJsonPointer("/missing/x", {})).toBeUndefined();
    });

    test("an empty token after a string resolves to nothing", () => {
      expect(resolveJsonPointer("/s/", { s: "abc" })).toBeUndefined();
    });
  });

  describe("resolved values", () => {
    test("false resolves to false", () => {
      expect(resolveJsonPointer("/x", { x: false })).toBe(false);
    });

    test("0 resolves to 0", () => {
      expect(resolveJsonPointer("/x", { x: 0 })).toBe(0);
    });

    test("the empty string resolves to the empty string", () => {
      expect(resolveJsonPointer("/x", { x: "" })).toBe("");
    });

    test("null resolves to null", () => {
      expect(resolveJsonPointer("/x", { x: null })).toBeNull();
    });

    test("an object resolves to the same object", () => {
      const inner = { k: "v" };

      expect(resolveJsonPointer("/x", { x: inner })).toBe(inner);
    });

    test("an array resolves to the same array", () => {
      const inner = ["a"];

      expect(resolveJsonPointer("/x", { x: inner })).toBe(inner);
    });
  });

  describe("documents", () => {
    test("any pointer into an undefined document resolves to nothing", () => {
      expect(resolveJsonPointer("", undefined)).toBeUndefined();
      expect(resolveJsonPointer("/x", undefined)).toBeUndefined();
    });

    test("a member pointer into a null document resolves to nothing", () => {
      expect(resolveJsonPointer("/x", null)).toBeUndefined();
    });

    test('"" resolves to a scalar document itself', () => {
      expect(resolveJsonPointer("", "text")).toBe("text");
      expect(resolveJsonPointer("", 0)).toBe(0);
    });

    test("a member pointer into a scalar document resolves to nothing", () => {
      expect(resolveJsonPointer("/0", "text")).toBeUndefined();
    });

    test("a document nested a thousand levels deep resolves", () => {
      let document: unknown = "bottom";
      for (let level = 0; level < 1000; level++) {
        document = { k: document };
      }

      expect(resolveJsonPointer("/k".repeat(1000), document)).toBe("bottom");
      expect(resolveJsonPointer("/k".repeat(1001), document)).toBeUndefined();
    });
  });
});
