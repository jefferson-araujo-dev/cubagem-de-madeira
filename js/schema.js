// Contrato funcional v1 de cubagem de madeira serrada.
import {
  calculateGrossVolumeM3,
  calculateOfficialVolumeM3,
  bigIntToSafeNumber,
} from "./volume.js";

export const SCHEMA_VERSION = 1;
export const FORMULA_VERSION = "rectangular-sawn-v1";

export const WOOD_TYPES = ["Prancha Freijó", "Prancha Ipê", "Prancha Cedrinho"];

export function isValidWoodType(value) {
  return WOOD_TYPES.includes(value);
}

// Único ponto de verdade sobre o que conta como um registro suportado pelo
// contrato v1. Usado para filtrar registros legados (pré-v1) vindos do
// Firestore ou do localStorage antes que cheguem à UI — esses registros não
// são migrados nem apagados automaticamente, apenas ignorados pelo fluxo
// operacional.
export function isSupportedWoodItem(item) {
  if (!item || typeof item !== "object") return false;
  return (
    item.schemaVersion === SCHEMA_VERSION &&
    item.formulaVersion === FORMULA_VERSION &&
    typeof item.id === "string" &&
    item.id.length > 0 &&
    isValidWoodType(item.woodType) &&
    typeof item.lengthM === "number" &&
    Number.isFinite(item.lengthM) &&
    item.lengthM > 0 &&
    typeof item.widthM === "number" &&
    Number.isFinite(item.widthM) &&
    item.widthM > 0 &&
    typeof item.thicknessM === "number" &&
    Number.isFinite(item.thicknessM) &&
    item.thicknessM > 0 &&
    typeof item.quantity === "number" &&
    Number.isInteger(item.quantity) &&
    item.quantity >= 1 &&
    typeof item.grossVolumeM3 === "number" &&
    Number.isFinite(item.grossVolumeM3) &&
    typeof item.officialVolumeM3 === "number" &&
    Number.isFinite(item.officialVolumeM3) &&
    typeof item.createdAt === "number" &&
    typeof item.updatedAt === "number"
  );
}

// Aceita vírgula ou ponto como separador decimal, exige no máximo 2 casas
// decimais e valor finito > 0. Retorna null se inválido (não arredonda).
export function parseDimension(rawValue) {
  if (rawValue === null || rawValue === undefined) return null;
  const trimmed = String(rawValue).trim();
  if (trimmed === "") return null;
  const normalized = trimmed.replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

// Exige um inteiro >= 1 (sem casas decimais, sem sinal negativo).
export function parseQuantity(rawValue) {
  if (rawValue === null || rawValue === undefined) return null;
  const trimmed = String(rawValue).trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  if (!Number.isInteger(value) || value < 1) return null;
  return value;
}

export function formatDecimalBR(valueM) {
  return valueM.toFixed(2).replace(".", ",");
}

// Formata grossVolumeM3 preservando toda a precisão relevante (até 6 casas,
// já que vem de 3 dimensões com no máximo 2 casas cada) em vez de
// arredondar para 2 casas como formatDecimalBR — usado especificamente em
// telas de detalhes/conferência e impressão, onde o bruto precisa ficar
// visivelmente distinto do officialVolumeM3 (ex.: 0,118272 m³ vs 0,12 m³).
export function formatGrossVolumeBR(valueM3) {
  const [intPart, fracPart] = valueM3.toFixed(6).split(".");
  const trimmed = fracPart.replace(/0+$/, "").padEnd(2, "0");
  return `${intPart},${trimmed}`;
}

export function formatDateBR(timestamp) {
  if (!timestamp) return "";
  return new Date(timestamp).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function generateId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback apenas para ambientes sem crypto.randomUUID (ex.: Node antigo em testes).
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function createWoodItem({
  woodType,
  lengthM,
  widthM,
  thicknessM,
  quantity,
  now,
}) {
  const timestamp = now ?? Date.now();
  const grossVolumeM3 = calculateGrossVolumeM3(
    lengthM,
    widthM,
    thicknessM,
    quantity,
  );
  const officialVolumeM3 = calculateOfficialVolumeM3(
    lengthM,
    widthM,
    thicknessM,
    quantity,
  );
  return {
    id: generateId(),
    woodType,
    lengthM,
    widthM,
    thicknessM,
    quantity,
    grossVolumeM3,
    officialVolumeM3,
    schemaVersion: SCHEMA_VERSION,
    formulaVersion: FORMULA_VERSION,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

// Aplica uma edição a um registro existente. Recalcula os volumes apenas
// quando alguma dimensão ou a quantidade mudou; updatedAt só avança quando
// algum campo editável realmente mudou (alterar só woodType conta como
// alteração efetiva para updatedAt, mas nunca recalcula os volumes).
export function applyWoodItemEdit(item, changes, now) {
  const { woodType, lengthM, widthM, thicknessM, quantity } = changes;
  const dimensionsChanged =
    lengthM !== item.lengthM ||
    widthM !== item.widthM ||
    thicknessM !== item.thicknessM ||
    quantity !== item.quantity;
  const anyChanged = dimensionsChanged || woodType !== item.woodType;

  const grossVolumeM3 = dimensionsChanged
    ? calculateGrossVolumeM3(lengthM, widthM, thicknessM, quantity)
    : item.grossVolumeM3;
  const officialVolumeM3 = dimensionsChanged
    ? calculateOfficialVolumeM3(lengthM, widthM, thicknessM, quantity)
    : item.officialVolumeM3;

  return {
    ...item,
    woodType,
    lengthM,
    widthM,
    thicknessM,
    quantity,
    grossVolumeM3,
    officialVolumeM3,
    updatedAt: anyChanged ? (now ?? Date.now()) : item.updatedAt,
  };
}

// Soma os officialVolumeM3 (nunca recalcula a partir do bruto). Cada
// officialVolumeM3 já é, por construção, um múltiplo exato de 0,01 m³; somar
// os valores diretamente como Number acumularia o ruído binário de cada
// parcela (ex.: 0.1 + 0.2 = 0.30000000000000004) ao longo de muitos
// registros. A soma é feita em centésimos inteiros como BigInt — não como
// Number — porque uma lista grande o bastante de registros poderia fazer o
// total em centésimos ultrapassar Number.MAX_SAFE_INTEGER; BigInt garante
// que a soma em si nunca perde precisão, e bigIntToSafeNumber garante que a
// conversão final para Number (exigida pelo tipo de retorno) falhe de forma
// explícita em vez de aproximar silenciosamente, caso o total definitivo
// ainda assim ultrapasse a faixa segura.
export function sumOfficialVolume(items) {
  const totalCentsBigInt = items.reduce((acc, item) => {
    const cents = Math.round(item.officialVolumeM3 * 100);
    if (!Number.isSafeInteger(cents)) {
      throw new RangeError(
        "officialVolumeM3 fora da faixa de representação segura em centésimos (Number.MAX_SAFE_INTEGER).",
      );
    }
    return acc + BigInt(cents);
  }, 0n);
  return bigIntToSafeNumber(totalCentsBigInt) / 100;
}
