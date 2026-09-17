import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calculateGrossVolumeM3,
  calculateOfficialVolumeM3,
  roundHalfUp2,
} from "./volume.js";
import { createWoodItem, sumOfficialVolume } from "./schema.js";

test("grossVolumeM3: cálculo inteiro simples", () => {
  assert.equal(calculateGrossVolumeM3(2, 2, 2, 1), 8);
});

test("grossVolumeM3: cálculo decimal sem ruído de ponto flutuante", () => {
  // Multiplicação direta em Number (1.5*0.2*0.05) produziria
  // 0.015000000000000003; derivado via aritmética inteira (BigInt) o
  // resultado é o valor semanticamente exato 0.015.
  assert.equal(calculateGrossVolumeM3(1.5, 0.2, 0.05, 1), 0.015);
});

test("grossVolumeM3: quantidade > 1 aplicada antes do arredondamento", () => {
  assert.equal(calculateGrossVolumeM3(1, 1, 0.5, 2), 1);
});

test("officialVolumeM3: caso de referência 4,62 x 0,32 x 0,08 x 1 = 0,12", () => {
  assert.equal(calculateOfficialVolumeM3(4.62, 0.32, 0.08, 1), 0.12);
});

test("officialVolumeM3: caso de referência 4,62 x 0,31 x 0,08 x 1 = 0,11", () => {
  assert.equal(calculateOfficialVolumeM3(4.62, 0.31, 0.08, 1), 0.11);
});

test("grossVolumeM3: casos de referência preservam o valor bruto exato (sem arredondar)", () => {
  assert.equal(calculateGrossVolumeM3(4.62, 0.32, 0.08, 1), 0.118272);
  assert.equal(calculateGrossVolumeM3(4.62, 0.31, 0.08, 1), 0.114576);
});

test("calculateGrossVolumeM3/calculateOfficialVolumeM3: dimensões grandes mas dentro da faixa segura continuam exatas", () => {
  // cents(1000) = 100000; 100000^3 * 1 = 1e15, dentro de
  // Number.MAX_SAFE_INTEGER (9007199254740991) — o cálculo deve permanecer
  // exato via BigInt (sem qualquer aproximação), mesmo sendo uma dimensão
  // bem maior do que qualquer prancha real.
  const big = 1000; // 1000,00 m
  const gross = calculateGrossVolumeM3(big, big, big, 1);
  const official = calculateOfficialVolumeM3(big, big, big, 1);
  assert.equal(gross, 1e9);
  assert.equal(official, 1e9);
});

test("calculateGrossVolumeM3/calculateOfficialVolumeM3: falham explicitamente ao ultrapassar Number.MAX_SAFE_INTEGER, em vez de aproximar silenciosamente", () => {
  // cents(10000) = 1000000; 1000000^3 * 1 = 1e18, muito além de
  // Number.MAX_SAFE_INTEGER — não existe nenhum teto de negócio para
  // dimensões no contrato, mas converter esse resultado para Number sem
  // aviso devolveria um valor numericamente errado sem qualquer sinal de
  // que a precisão foi perdida. A função deve lançar em vez disso.
  const big = 10000; // 10000,00 m
  assert.throws(() => calculateGrossVolumeM3(big, big, big, 1), RangeError);
  assert.throws(() => calculateOfficialVolumeM3(big, big, big, 1), RangeError);
});

test("sumOfficialVolume: falha explicitamente se o total em centésimos ultrapassar Number.MAX_SAFE_INTEGER", () => {
  // Um único officialVolumeM3 absurdamente grande já basta para que
  // Math.round(officialVolumeM3 * 100) deixe de ser um inteiro seguro.
  const items = [{ officialVolumeM3: 1e17 }];
  assert.throws(() => sumOfficialVolume(items), RangeError);
});

test("officialVolumeM3: quantidade > 1 é aplicada antes do arredondamento final", () => {
  // Volume de uma única peça (0,23 x 1 x 0,5 = 0,115) arredondaria para 0,12,
  // mas com quantidade 2 o produto final (0,23) já cai exatamente em 2 casas
  // e não deve ser confundido com 2 x 0,12 = 0,24.
  assert.equal(calculateOfficialVolumeM3(0.23, 1, 0.5, 1), 0.12);
  assert.equal(calculateOfficialVolumeM3(0.23, 1, 0.5, 2), 0.23);
});

test("roundHalfUp2: fronteira 0,114999 mantém a 2ª casa (0,11)", () => {
  assert.equal(roundHalfUp2(0.114999), 0.11);
});

test("roundHalfUp2: fronteira 0,115000 incrementa a 2ª casa (0,12)", () => {
  assert.equal(roundHalfUp2(0.115), 0.12);
});

test("roundHalfUp2: valor já com 2 casas permanece inalterado", () => {
  assert.equal(roundHalfUp2(0.2), 0.2);
  assert.equal(roundHalfUp2(0.11), 0.11);
});

test("roundHalfUp2: ruído de ponto flutuante não altera o resultado esperado", () => {
  // 4.62*0.32*0.08 = 0.11827200000000002 em ponto flutuante; a 3ª casa real é 8.
  assert.equal(roundHalfUp2(4.62 * 0.32 * 0.08), 0.12);
  // 4.62*0.31*0.08 = 0.114576; a 3ª casa real é 4.
  assert.equal(roundHalfUp2(4.62 * 0.31 * 0.08), 0.11);
});

test("roundHalfUp2: casos clássicos de imprecisão binária em .5 exato (HALF-UP correto)", () => {
  // (1.005).toFixed(20) === "1.00499999999999989342" (o double mais próximo
  // de 1.005 é, na verdade, ligeiramente MENOR que 1.005): uma implementação
  // baseada em toFixed arredondaria para baixo (1.00), mas o contrato exige
  // tratar a intenção decimal digitada (1.005) e arredondar para cima.
  assert.equal(roundHalfUp2(1.005), 1.01);
  assert.equal(roundHalfUp2(2.675), 2.68);
});

test("roundHalfUp2: valores cujo toString() usa notação científica são tratados corretamente", () => {
  // (0.0000001).toString() === "1e-7" — sem tratamento explícito, a busca
  // pelo "." na string quebraria e o valor seria devolvido sem arredondar.
  assert.equal(roundHalfUp2(0.0000001), 0);
  assert.equal(roundHalfUp2(0.000001), 0);
  assert.equal(roundHalfUp2(-0.0000001), 0);
  // (123456789012345680000).toString() não usa notação científica (< 1e21);
  // já (1e21).toString() usa — fora do domínio de precisão de double, onde
  // "arredondar para 2 casas" deixa de ter significado; o valor é devolvido
  // inalterado em vez de lançar erro ou corromper silenciosamente o total.
  assert.equal(roundHalfUp2(1e21), 1e21);
});

test("sumOfficialVolume: soma dos volumesOficiais, não recalcula a partir do bruto", () => {
  const a = createWoodItem({
    woodType: "Prancha Ipê",
    lengthM: 0.23,
    widthM: 1,
    thicknessM: 0.5,
    quantity: 1,
    now: 1,
  });
  const b = createWoodItem({
    woodType: "Prancha Ipê",
    lengthM: 0.23,
    widthM: 1,
    thicknessM: 0.5,
    quantity: 1,
    now: 1,
  });
  assert.equal(a.officialVolumeM3, 0.12);
  assert.equal(b.officialVolumeM3, 0.12);
  assert.equal(sumOfficialVolume([a, b]), 0.24);
});

test("sumOfficialVolume: 0,11 + 0,11 = 0,22 m³", () => {
  const a = { officialVolumeM3: 0.11 };
  const b = { officialVolumeM3: 0.11 };
  assert.equal(sumOfficialVolume([a, b]), 0.22);
});

test("sumOfficialVolume: soma de muitos registros não sofre drift de ponto flutuante", () => {
  // 0.1 + 0.2 em Number puro já produz 0.30000000000000004; somando dezenas
  // de valores desse tipo o ruído binário se acumularia caso a soma fosse
  // feita como Number simples seguida de arredondamento final.
  const items = [
    { officialVolumeM3: 0.1 },
    { officialVolumeM3: 0.2 },
    { officialVolumeM3: 0.3 },
    ...Array(27).fill({ officialVolumeM3: 0.01 }),
  ];
  // total exato esperado: 0.1 + 0.2 + 0.3 + 27*0.01 = 0.87
  assert.equal(sumOfficialVolume(items), 0.87);

  const manyThirds = Array(97).fill({ officialVolumeM3: 0.03 });
  // total exato esperado: 97 * 0.03 = 2.91
  assert.equal(sumOfficialVolume(manyThirds), 2.91);
});
