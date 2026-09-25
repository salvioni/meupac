// Campos de CNPJ (máscara + validação) e Município/UF (lista de UFs + municípios do
// IBGE como sugestão), usados no cadastro e em Dados da unidade.
import { $, esc } from './helpers.js';
import { UFS, formatCnpj, validCnpj, onlyDigits, splitMunicipio, joinMunicipio } from './br.js';

const errCls = 'text-[11px] text-error font-semibold mt-1';

export function cnpjField(id, label, val, inputCls, labelCls) {
  return `<div><label class="${labelCls}">${label}</label>
    <input id="${id}" value="${esc(formatCnpj(val))}" inputmode="numeric" autocomplete="off" maxlength="18" placeholder="00.000.000/0000-00" class="${inputCls} mono">
    <div id="${id}-err" class="${errCls} hidden">CNPJ inválido — confira os números.</div></div>`;
}

// UF (select) + cidade (texto com sugestões). O valor salvo continua "Cidade/UF".
export function municipioField(prefix, val, inputCls, labelCls) {
  const { cidade, uf } = splitMunicipio(val);
  return `<div><label class="${labelCls}">Município / UF</label>
    <div class="flex gap-2">
      <select id="${prefix}-uf" aria-label="UF" class="${inputCls} !w-[92px] flex-none">
        <option value="">UF</option>
        ${UFS.map(([s, n]) => `<option value="${s}" title="${esc(n)}" ${s === uf ? 'selected' : ''}>${s}</option>`).join('')}
      </select>
      <input id="${prefix}-cidade" value="${esc(cidade)}" list="${prefix}-cidades" autocomplete="off" placeholder="${uf ? 'Cidade' : 'Escolha a UF'}" class="${inputCls} flex-1 min-w-0">
    </div>
    <datalist id="${prefix}-cidades"></datalist>
    <div id="${prefix}-err" class="${errCls} hidden">Escolha a UF da cidade.</div></div>`;
}

// municípios por UF (API pública do IBGE) — só sugestão: sem internet, digita livre
const cidadesCache = {};
async function loadCidades(uf) {
  if (!cidadesCache[uf]) {
    cidadesCache[uf] = fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`)
      .then(r => (r.ok ? r.json() : [])).then(list => list.map(m => m.nome).sort((a, b) => a.localeCompare(b, 'pt-BR')))
      .catch(() => { delete cidadesCache[uf]; return []; });
  }
  return cidadesCache[uf];
}

export function wireBrFields(cnpjId, munPrefix) {
  const c = $(cnpjId);
  if (c) {
    c.oninput = () => { c.value = formatCnpj(c.value); if (validCnpj(c.value) || !onlyDigits(c.value)) $(cnpjId + '-err').classList.add('hidden'); };
    c.onblur = () => { $(cnpjId + '-err').classList.toggle('hidden', !onlyDigits(c.value) || validCnpj(c.value)); };
  }
  const ufSel = $(munPrefix + '-uf'), cid = $(munPrefix + '-cidade');
  if (ufSel && cid) {
    const norm = t => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    const fill = async (changed) => {
      const uf = ufSel.value, dl = $(munPrefix + '-cidades'), typed = cid.value;
      cid.placeholder = uf ? 'Cidade' : 'Escolha a UF';
      if (uf) $(munPrefix + '-err').classList.add('hidden');
      const nomes = uf ? await loadCidades(uf) : [];
      if (ufSel.value !== uf) return; // trocou de novo enquanto carregava
      if (dl) dl.innerHTML = nomes.map(n => `<option value="${esc(n)}">`).join('');
      // trocou a UF e a cidade digitada não é dela: limpa. Se é, acerta a grafia (cuiaba -> Cuiabá)
      if (changed && cid.value === typed && typed.trim() && nomes.length) { // não mexe se digitou enquanto carregava
        const hit = nomes.find(n => norm(n) === norm(cid.value));
        cid.value = hit || '';
      }
      if (changed && uf && !cid.value) cid.focus();
    };
    ufSel.onchange = () => fill(true);
    fill(false);
  }
}

// lê os dois campos. Devolve { cnpj, municipio } ou { error } (e marca o campo com erro)
export function readBrFields(cnpjId, munPrefix) {
  const cnpj = formatCnpj($(cnpjId).value);
  if (onlyDigits(cnpj) && !validCnpj(cnpj)) { $(cnpjId + '-err').classList.remove('hidden'); $(cnpjId).focus(); return { error: 'CNPJ inválido — confira os números.' }; }
  const cidade = $(munPrefix + '-cidade').value.trim(), uf = $(munPrefix + '-uf').value;
  if (cidade && !uf) { $(munPrefix + '-err').classList.remove('hidden'); $(munPrefix + '-uf').focus(); return { error: 'Escolha a UF da cidade.' }; }
  return { cnpj, municipio: joinMunicipio(cidade, uf) };
}
