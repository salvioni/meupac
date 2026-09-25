// CNPJ e UFs do Brasil — módulo puro (sem DOM), importado tanto pelo frontend quanto
// pelo backend (routes/auth.js e routes/unidade.js), pra tela e servidor validarem igual.

export const UFS = [
  ['AC', 'Acre'], ['AL', 'Alagoas'], ['AP', 'Amapá'], ['AM', 'Amazonas'], ['BA', 'Bahia'],
  ['CE', 'Ceará'], ['DF', 'Distrito Federal'], ['ES', 'Espírito Santo'], ['GO', 'Goiás'],
  ['MA', 'Maranhão'], ['MT', 'Mato Grosso'], ['MS', 'Mato Grosso do Sul'], ['MG', 'Minas Gerais'],
  ['PA', 'Pará'], ['PB', 'Paraíba'], ['PR', 'Paraná'], ['PE', 'Pernambuco'], ['PI', 'Piauí'],
  ['RJ', 'Rio de Janeiro'], ['RN', 'Rio Grande do Norte'], ['RS', 'Rio Grande do Sul'],
  ['RO', 'Rondônia'], ['RR', 'Roraima'], ['SC', 'Santa Catarina'], ['SP', 'São Paulo'],
  ['SE', 'Sergipe'], ['TO', 'Tocantins'],
];
export const isUf = uf => UFS.some(([s]) => s === uf);

export const onlyDigits = v => String(v || '').replace(/\D/g, '');

// máscara progressiva (serve enquanto a pessoa digita): 12.345.678/0001-95
export function formatCnpj(v) {
  const d = onlyDigits(v).slice(0, 14);
  return d.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2');
}

// dígitos verificadores (módulo 11). Sequências repetidas (00000000000000…) são inválidas.
export function validCnpj(v) {
  const d = onlyDigits(v);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const dv = len => {
    let sum = 0, w = len - 7;
    for (let i = 0; i < len; i++) { sum += +d[i] * w--; if (w < 2) w = 9; }
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return dv(12) === +d[12] && dv(13) === +d[13];
}

// o município é guardado como "Cidade/UF" (é assim que sai nos PDFs)
export function splitMunicipio(v) {
  const m = /^(.*?)\s*[/-]\s*([A-Za-z]{2})\s*$/.exec(String(v || '').trim());
  if (m && isUf(m[2].toUpperCase())) return { cidade: m[1].trim(), uf: m[2].toUpperCase() };
  return { cidade: String(v || '').trim(), uf: '' };
}
export function joinMunicipio(cidade, uf) {
  cidade = String(cidade || '').trim();
  return cidade && uf ? `${cidade}/${uf}` : cidade || uf || '';
}

// validação comum de cadastro/edição: devolve a mensagem de erro ou null
export function checkCnpjMunicipio({ cnpj, municipio }) {
  if (cnpj && onlyDigits(cnpj) && !validCnpj(cnpj)) return 'CNPJ inválido — confira os números.';
  if (municipio && String(municipio).includes('/') && !splitMunicipio(municipio).uf) return 'UF do município inválida.';
  return null;
}
