import { createHash } from 'node:crypto';

// Serialização estável (chaves ordenadas) para que o mesmo conteúdo sempre produza o mesmo hash.
export function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  const keys = Object.keys(value).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify(value[k])).join(',') + '}';
}

export function sha256Hex(input) {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

// Cadeia de hashes: cada registro amarra o anterior, então qualquer alteração
// retroativa (edição ou remoção) quebra a cadeia a partir daquele ponto — é
// isso que dá a "inviolabilidade" que a UI promete, e que o localStorage nunca pôde.
export function recordHash(prevHash, payload) {
  return sha256Hex((prevHash || 'GENESIS') + '|' + stableStringify(payload));
}

export function signatureHash(recordHash_, signedBy, signedAt) {
  return sha256Hex(recordHash_ + '|' + signedBy + '|' + signedAt);
}
