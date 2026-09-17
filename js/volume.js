// Cálculo de volume para madeira retangular/serrada (comportamento legado).
// Não representa a fórmula definitiva de cubagem do CubagemPro.
export function calculateRectangularVolume(length, width, thickness, qty) {
  return Number((length * width * thickness * qty).toFixed(4));
}
