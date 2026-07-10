// Notas fiscais brasileiras variam MUITO de layout entre estabelecimentos,
// então isso é uma heurística, não um parser robusto. A ideia não é acertar
// 100% sozinho — é reduzir o trabalho do usuário, que revisa/edita depois.

const NOISE_PATTERNS = [
  /cnpj/i,
  /cpf/i,
  /^total/i,
  /^subtotal/i,
  /^troco/i,
  /^desconto/i,
  /^cupom/i,
  /^nfc-?e/i,
  /^valor/i,
  /^forma de pagamento/i,
  /^\d+[.,]\d{2}$/, // linha que é só um preço
  /^-+$/ // linhas de traços separadores
];

function looksLikeNoise(line) {
  return NOISE_PATTERNS.some((pattern) => pattern.test(line));
}

function stripTrailingPrice(line) {
  // Remove um preço no final da linha, ex: "ARROZ 5KG    18,90" -> "ARROZ 5KG"
  return line.replace(/\s+\d+[.,]\d{2}\s*$/, '').trim();
}

function stripLeadingCode(line) {
  // Remove código de produto no início, ex: "001 ARROZ 5KG" -> "ARROZ 5KG"
  return line.replace(/^\d{1,6}\s+/, '').trim();
}

export function extractItemCandidates(rawText) {
  const lines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const candidates = [];

  for (const line of lines) {
    if (looksLikeNoise(line)) continue;
    if (line.length < 3 || line.length > 45) continue;

    // precisa ter pelo menos uma letra — descarta linhas só numéricas
    if (!/[a-zA-ZÀ-ÿ]/.test(line)) continue;

    const cleaned = stripLeadingCode(stripTrailingPrice(line));
    if (cleaned.length >= 3) candidates.push(cleaned);
  }

  // remove duplicados mantendo a ordem
  return [...new Set(candidates)];
}
