// Cálculo de volume para madeira serrada retangular (fórmula "rectangular-sawn-v1").
//
// O volumeOficial precisa seguir a regra de arredondamento "meio para cima" na
// 2ª casa decimal (3ª casa 0-4 mantém, 5-9 incrementa). Number.prototype.toFixed
// não é confiável para isso porque opera sobre a representação binária do
// double, que nem sempre corresponde ao valor decimal digitado/esperado
// (ex.: 0.115 pode ser internamente 0.114999999999999991118...).
//
// Estratégia adotada: como comprimento/largura/espessura são validados para
// ter no máximo 2 casas decimais, convertê-los para centésimos (inteiros
// exatos) permite calcular o volume em micrômetros cúbicos (unidade 1e-6 m³)
// usando apenas aritmética inteira, sem qualquer imprecisão de ponto
// flutuante, e então arredondar esse inteiro para o múltiplo de 10000 mais
// próximo (equivalente a 0,01 m³), com metade arredondando para cima.

// Expande a string devolvida por Number.prototype.toString() para notação
// decimal simples ("123.45"), mesmo quando o motor a expressa em notação
// científica ("1.23e-7", "1e+21"). toString() é usado (em vez de toFixed())
// porque devolve a representação decimal MÍNIMA que arredonda de volta para
// o mesmo double — ou seja, para um literal como 1.005 (cujo double mais
// próximo é, na verdade, 1.00499999999999989...), toString() ainda devolve
// "1.005", preservando a intenção decimal original. toFixed(n) não serve
// para isso: ele expõe o valor binário bruto (toFixed(20) de 1.005 é
// "1.00499999999999989342"), o que faria um HALF-UP na 3ª casa arredondar
// para baixo quando o contrato exige arredondar para cima.
function expandToPlainDecimalString(absValue) {
  const str = absValue.toString();
  const expMatch = /^(\d+)(?:\.(\d+))?e([+-]\d+)$/i.exec(str);
  if (!expMatch) return str; // já em notação decimal simples

  const [, intPart, fracPart = "", expStr] = expMatch;
  const digits = intPart + fracPart;
  const exponent = Number(expStr);
  const pointPos = intPart.length + exponent;

  if (pointPos <= 0) {
    return `0.${"0".repeat(-pointPos)}${digits}`;
  }
  if (pointPos >= digits.length) {
    return digits + "0".repeat(pointPos - digits.length);
  }
  return `${digits.slice(0, pointPos)}.${digits.slice(pointPos)}`;
}

// Arredondamento "meio para cima" de um valor arbitrário para 2 casas
// decimais, robusto a ruído de ponto flutuante e a notação científica,
// operando sobre a representação decimal mínima do número (ver
// expandToPlainDecimalString) em vez do seu valor binário bruto.
export function roundHalfUp2(value) {
  if (!Number.isFinite(value)) return value;

  const negative = value < 0;
  const str = expandToPlainDecimalString(Math.abs(value));
  const [intPart, fracPart = ""] = str.split(".");

  if (fracPart.length <= 2) {
    return value;
  }

  const keptDigits = fracPart.slice(0, 2);
  const nextDigit = Number(fracPart[2]);
  let scaled = Number(intPart + keptDigits);
  if (nextDigit >= 5) scaled += 1;
  const result = scaled / 100;
  // Evita devolver -0 (ex.: roundHalfUp2(-0.0000001) deve ser 0, não -0).
  return negative && result !== 0 ? -result : result;
}

const MAX_SAFE_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);

// Converte um BigInt para Number apenas quando ele está dentro da faixa de
// inteiros com representação exata em double (±Number.MAX_SAFE_INTEGER).
// Fora dessa faixa, `Number(bigIntGrande)` converteria silenciosamente para
// uma aproximação — em vez disso, a conversão falha de forma explícita.
// Isto NÃO é um limite físico/de negócio para dimensões/quantidade de
// prancha (o contrato não define um); é a restrição técnica inerente ao
// tipo Number do JavaScript, que só representa inteiros exatos até
// Number.MAX_SAFE_INTEGER (2^53 - 1).
export function bigIntToSafeNumber(value) {
  if (value > MAX_SAFE_BIGINT || value < -MAX_SAFE_BIGINT) {
    throw new RangeError(
      "Valor excede Number.MAX_SAFE_INTEGER: fora da faixa de representação exata em Number.",
    );
  }
  return Number(value);
}

// Converte uma medida (já validada com no máximo 2 casas decimais) para
// centésimos inteiros exatos, como BigInt. Falha explicitamente se o
// arredondamento para centésimos já não couber mais em um Number inteiro
// seguro (Number.isSafeInteger), em vez de deixar essa imprecisão se
// propagar silenciosamente para a multiplicação em BigInt mais adiante.
function toCentsBigInt(valueM) {
  const cents = Math.round(valueM * 100);
  if (!Number.isSafeInteger(cents)) {
    throw new RangeError(
      "Dimensão fora da faixa de representação segura em centésimos (Number.MAX_SAFE_INTEGER).",
    );
  }
  return BigInt(cents);
}

// Mesma lógica de guarda técnica aplicada à quantidade: exige
// Number.isSafeInteger (não apenas Number.isInteger), já que um "inteiro"
// além de 2^53 pode não corresponder ao valor exato digitado.
function quantityToBigInt(quantity) {
  if (!Number.isSafeInteger(quantity)) {
    throw new RangeError(
      "Quantidade fora da faixa de representação segura (Number.MAX_SAFE_INTEGER).",
    );
  }
  return BigInt(quantity);
}

// Volume em micrômetros cúbicos (unidade 1e-6 m³), calculado inteiramente
// com BigInt para nunca depender de o produto caber em
// Number.MAX_SAFE_INTEGER (~9.007199254740991e15). O contrato não impõe
// nenhum teto de comprimento/largura/espessura/quantidade, então o produto
// de 4 fatores inteiros (3 dimensões em centésimos + a quantidade) pode
// ultrapassar essa faixa com valores grandes o suficiente; multiplicar como
// Number nesse caso perderia precisão silenciosamente. BigInt em JavaScript
// tem precisão arbitrária, então a multiplicação abaixo é sempre exata,
// qualquer que seja a magnitude das entradas.
function microVolumeBigInt(lengthM, widthM, thicknessM, quantity) {
  return (
    toCentsBigInt(lengthM) *
    toCentsBigInt(widthM) *
    toCentsBigInt(thicknessM) *
    quantityToBigInt(quantity)
  );
}

// grossVolumeM3 é derivado da mesma aritmética inteira exata das dimensões
// (em vez de uma multiplicação direta em Number, que produziria ruído do
// tipo 0.11827200000000002), sem qualquer arredondamento — apenas a
// conversão final para m³ (divisão por 1e6) precisa passar por Number,
// porque esse é o tipo de retorno da função; a essa altura o valor inteiro
// já está correto, então o resultado é a representação double mais fiel ao
// valor decimal exato calculado.
export function calculateGrossVolumeM3(lengthM, widthM, thicknessM, quantity) {
  const micro = microVolumeBigInt(lengthM, widthM, thicknessM, quantity);
  return bigIntToSafeNumber(micro) / 1e6;
}

export function calculateOfficialVolumeM3(lengthM, widthM, thicknessM, quantity) {
  const micro = microVolumeBigInt(lengthM, widthM, thicknessM, quantity);
  const divisor = 10000n; // 0,01 m³ em unidades de 1e-6 m³
  const quotient = micro / divisor;
  const remainder = micro % divisor;
  // Arredondamento "meio para cima" feito em BigInt (sem divisão em Number),
  // para que a decisão de arredondar não dependa de nenhuma aproximação
  // binária mesmo quando micro/divisor não é um inteiro exato.
  const roundedQuotient = remainder * 2n >= divisor ? quotient + 1n : quotient;
  return bigIntToSafeNumber(roundedQuotient * divisor) / 1e6;
}
