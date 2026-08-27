import { expect, test } from "vitest";
import { init } from "./index.ts";

test("init is not implemented", () => {
  expect(() => init({ yes: true })).toThrow("not implemented");
});
