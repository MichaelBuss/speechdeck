import { expect, test } from "vitest";
import { Inspect, Present, Rehearse } from "./index.ts";

test("Present is not implemented", () => {
  expect(typeof Present).toBe("function");
});

test("Rehearse is not implemented", () => {
  expect(typeof Rehearse).toBe("function");
});

test("Inspect is not implemented", () => {
  expect(typeof Inspect).toBe("function");
});
