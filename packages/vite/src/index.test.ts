import { expect, test } from "vitest";
import { speechdeck } from "./index.ts";

test("speechdeck is not implemented", () => {
  expect(() => speechdeck()).toThrow("not implemented");
});
