import { test } from "node:test";
import assert from "node:assert/strict";
import {
  WOOD_TYPES,
  SCHEMA_VERSION,
  FORMULA_VERSION,
  isValidWoodType,
  parseDimension,
  parseQuantity,
  formatDimensionInput,
  createWoodItem,
  applyWoodItemEdit,
  isSupportedWoodItem,
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

test("formatDimensionInput: posiciona os 2 últimos algarismos como casas decimais", () => {
  assert.equal(formatDimensionInput(""), "");
  assert.equal(formatDimensionInput("1"), "0,01");
  assert.equal(formatDimensionInput("8"), "0,08");
  assert.equal(formatDimensionInput("32"), "0,32");
  assert.equal(formatDimensionInput("100"), "1,00");
  assert.equal(formatDimensionInput("400"), "4,00");
  assert.equal(formatDimensionInput("462"), "4,62");
  assert.equal(formatDimensionInput("1250"), "12,50");
});

test("formatDimensionInput: sanitiza vírgula, ponto e sinal negativo, considerando só os algarismos", () => {
  assert.equal(formatDimensionInput("4,62"), "4,62");
  assert.equal(formatDimensionInput("4.62"), "4,62");
  assert.equal(formatDimensionInput("-462"), "4,62");
  assert.equal(formatDimensionInput("-1"), "0,01");
});

test("formatDimensionInput: null/undefined e algarismos todos zero resultam em vazio", () => {
  assert.equal(formatDimensionInput(null), "");
  assert.equal(formatDimensionInput(undefined), "");
  assert.equal(formatDimensionInput("0"), "");
  assert.equal(formatDimensionInput("00"), "");
});

test("formatDimensionInput: simula digitação e Backspace sequenciais (4,62 -> vazio)", () => {
  // Digitação: 4 -> 46 -> 462
  assert.equal(formatDimensionInput("4"), "0,04");
  assert.equal(formatDimensionInput("46"), "0,46");
  assert.equal(formatDimensionInput("462"), "4,62");

  // Backspace a partir de "4,62": o handler de input recebe o valor do campo
  // já com o último caractere visível removido, então recalcula a partir
  // dos algarismos restantes.
  assert.equal(formatDimensionInput("4,6"), "0,46"); // removeu o "2"
  assert.equal(formatDimensionInput("0,4"), "0,04"); // removeu o "6"
  assert.equal(formatDimensionInput("0,0"), ""); // removeu o "4": só sobra zero -> vazio
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

test("isSupportedWoodItem: aceita um registro válido do schema v1", () => {
  const item = createWoodItem({
    woodType: "Prancha Ipê",
    lengthM: 1,
    widthM: 1,
    thicknessM: 0.5,
    quantity: 1,
    now: 1000,
  });
  assert.ok(isSupportedWoodItem(item));
});

test("isSupportedWoodItem: rejeita registro legado sem woodType (formato pré-v1)", () => {
  const legacy = {
    desc: "Peroba",
    length: 4,
    width: 0.3,
    thickness: 0.05,
    qty: 10,
    volume: 0.6,
  };
  assert.equal(isSupportedWoodItem(legacy), false);
});

test("isSupportedWoodItem: rejeita registro com schemaVersion/formulaVersion incompatível", () => {
  const item = createWoodItem({
    woodType: "Prancha Ipê",
    lengthM: 1,
    widthM: 1,
    thicknessM: 0.5,
    quantity: 1,
    now: 1000,
  });
  assert.equal(isSupportedWoodItem({ ...item, schemaVersion: 0 }), false);
  assert.equal(
    isSupportedWoodItem({ ...item, formulaVersion: "old-formula" }),
    false,
  );
  assert.equal(isSupportedWoodItem({ ...item, woodType: "Pinus" }), false);
});

test("isSupportedWoodItem: rejeita null/undefined/valores não-objeto", () => {
  assert.equal(isSupportedWoodItem(null), false);
  assert.equal(isSupportedWoodItem(undefined), false);
  assert.equal(isSupportedWoodItem("string"), false);
});
