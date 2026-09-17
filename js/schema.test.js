import { test } from "node:test";
import assert from "node:assert/strict";
import {
  WOOD_TYPES,
  SCHEMA_VERSION,
  FORMULA_VERSION,
  isValidWoodType,
  parseDimension,
  parseQuantity,
  createWoodItem,
  applyWoodItemEdit,
} from "./schema.js";

test("apenas as 3 opções de madeira permitidas são válidas", () => {
  assert.equal(WOOD_TYPES.length, 3);
  assert.ok(isValidWoodType("Prancha Freijó"));
  assert.ok(isValidWoodType("Prancha Ipê"));
  assert.ok(isValidWoodType("Prancha Cedrinho"));
  assert.equal(isValidWoodType("Prancha Mogno"), false);
  assert.equal(isValidWoodType(""), false);
  assert.equal(isValidWoodType(undefined), false);
});

test("parseDimension: aceita vírgula e ponto como separador decimal equivalentes", () => {
  assert.equal(parseDimension("4,62"), 4.62);
  assert.equal(parseDimension("4.62"), 4.62);
  assert.equal(parseDimension("0,32"), 0.32);
  assert.equal(parseDimension("0.32"), 0.32);
});

test("parseDimension: aceita até 2 casas decimais e valores inteiros", () => {
  assert.equal(parseDimension("4"), 4);
  assert.equal(parseDimension("4,6"), 4.6);
  assert.equal(parseDimension("4,62"), 4.62);
});

test("parseDimension: rejeita mais de 2 casas decimais sem arredondar", () => {
  assert.equal(parseDimension("4,625"), null);
});

test("parseDimension: rejeita zero", () => {
  assert.equal(parseDimension("0"), null);
  assert.equal(parseDimension("0,00"), null);
});

test("parseDimension: rejeita negativos", () => {
  assert.equal(parseDimension("-1"), null);
  assert.equal(parseDimension("-0,5"), null);
});

test("parseDimension: rejeita vazio/inválido", () => {
  assert.equal(parseDimension(""), null);
  assert.equal(parseDimension("abc"), null);
  assert.equal(parseDimension(null), null);
});

test("parseQuantity: aceita inteiros >= 1", () => {
  assert.equal(parseQuantity("1"), 1);
  assert.equal(parseQuantity("25"), 25);
});

test("parseQuantity: rejeita zero, negativos e frações", () => {
  assert.equal(parseQuantity("0"), null);
  assert.equal(parseQuantity("-1"), null);
  assert.equal(parseQuantity("1,5"), null);
  assert.equal(parseQuantity("2.7"), null);
});

test("createWoodItem: gera o novo schema v1 com id único e datas automáticas", () => {
  const item = createWoodItem({
    woodType: "Prancha Ipê",
    lengthM: 4.62,
    widthM: 0.32,
    thicknessM: 0.08,
    quantity: 1,
    now: 1000,
  });
  assert.equal(item.schemaVersion, SCHEMA_VERSION);
  assert.equal(item.formulaVersion, FORMULA_VERSION);
  assert.equal(typeof item.id, "string");
  assert.ok(item.id.length > 0);
  // grossVolumeM3 é derivado por aritmética inteira (BigInt), não pela
  // multiplicação direta em Number (que produziria 0.11827200000000002).
  assert.equal(item.grossVolumeM3, 0.118272);
  assert.equal(item.officialVolumeM3, 0.12);
  assert.equal(item.createdAt, 1000);
  assert.equal(item.updatedAt, 1000);

  const other = createWoodItem({
    woodType: "Prancha Ipê",
    lengthM: 4.62,
    widthM: 0.32,
    thicknessM: 0.08,
    quantity: 1,
    now: 1000,
  });
  assert.notEqual(item.id, other.id);
});

test("applyWoodItemEdit: recalcula volumes quando dimensão muda", () => {
  const item = createWoodItem({
    woodType: "Prancha Ipê",
    lengthM: 1,
    widthM: 1,
    thicknessM: 0.5,
    quantity: 1,
    now: 1000,
  });
  const edited = applyWoodItemEdit(
    item,
    { woodType: "Prancha Ipê", lengthM: 1, widthM: 1, thicknessM: 0.5, quantity: 3 },
    2000,
  );
  assert.equal(edited.grossVolumeM3, 1.5);
  assert.equal(edited.officialVolumeM3, 1.5);
  assert.equal(edited.updatedAt, 2000);
  assert.equal(edited.createdAt, 1000, "createdAt preservado na edição");
});

test("applyWoodItemEdit: alterar apenas woodType preserva os volumes mas atualiza updatedAt", () => {
  const item = createWoodItem({
    woodType: "Prancha Ipê",
    lengthM: 1,
    widthM: 1,
    thicknessM: 0.5,
    quantity: 1,
    now: 1000,
  });
  const edited = applyWoodItemEdit(
    item,
    { woodType: "Prancha Cedrinho", lengthM: 1, widthM: 1, thicknessM: 0.5, quantity: 1 },
    2000,
  );
  assert.equal(edited.woodType, "Prancha Cedrinho");
  assert.equal(edited.grossVolumeM3, item.grossVolumeM3);
  assert.equal(edited.officialVolumeM3, item.officialVolumeM3);
  assert.equal(edited.updatedAt, 2000);
  assert.equal(edited.createdAt, 1000);
});

test("applyWoodItemEdit: nenhuma alteração efetiva preserva updatedAt", () => {
  const item = createWoodItem({
    woodType: "Prancha Ipê",
    lengthM: 1,
    widthM: 1,
    thicknessM: 0.5,
    quantity: 1,
    now: 1000,
  });
  const edited = applyWoodItemEdit(
    item,
    { woodType: "Prancha Ipê", lengthM: 1, widthM: 1, thicknessM: 0.5, quantity: 1 },
    2000,
  );
  assert.equal(edited.updatedAt, 1000);
});
