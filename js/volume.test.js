import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateRectangularVolume } from "./volume.js";

test("cálculo inteiro simples", () => {
  assert.equal(calculateRectangularVolume(2, 2, 2, 1), 8);
});

test("cálculo decimal", () => {
  assert.equal(calculateRectangularVolume(1.5, 0.2, 0.05, 1), 0.015);
});

test("quantidade > 1", () => {
  assert.equal(calculateRectangularVolume(1, 1, 0.5, 2), 1);
});

test("arredondamento a 4 casas", () => {
  assert.equal(calculateRectangularVolume(1, 1, 1, 3), 3);
  assert.equal(calculateRectangularVolume(0.333333, 1, 1, 1), 0.3333);
});

test("valor cujo produto expõe comportamento de floating point", () => {
  assert.equal(calculateRectangularVolume(0.1, 0.2, 1, 1), 0.02);
});
