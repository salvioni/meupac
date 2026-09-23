import { getForm, getPac, getUnidade } from './state.js';
import { fmtDT, fmtTime, hashFor, toast } from './helpers.js';

export async function downloadFile(filename, blob) {
  try {
    if (window.claude && typeof claude.use === 'function') {
      const dl = await claude.use('downloads');
      if (dl) { await dl.save({ filename, data: blob }); toast('Arquivo gerado.'); return; }
    }
  } catch (e) { if (e && e.code === 'declined') return; }
  try {
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500);
    toast('Arquivo gerado.');
  } catch (e2) { toast('Não foi possível gerar o arquivo aqui.', 'err'); }
}

function pdfHeader(doc, L, R, y) {
  const u = getUnidade();
  let tx = L;
  if (u.logo) { try { doc.addImage(u.logo, 'PNG', L, y - 6, 40, 40); tx = L + 52; } catch (e) { try { doc.addImage(u.logo, 'JPEG', L, y - 6, 40, 40); tx = L + 52; } catch (e2) { } } }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(15, 38, 66); doc.text(String(u.razaoSocial || ''), tx, y + 2);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(90);
  doc.text(`CNPJ ${u.cnpj || '—'}  ·  ${u.sif || '—'}  ·  ${u.municipio || '—'}`, tx, y + 16);
  doc.text(`RT: ${u.rtNome || '—'} — ${u.rtRegistro || '—'}`, tx, y + 28);
  doc.setFontSize(8); doc.setTextColor(140); doc.text('meuPAC · Autocontrole', R, y - 2, { align: 'right' });
  doc.text('Emitido ' + fmtDT(new Date().toISOString()), R, y + 10, { align: 'right' });
  return y + 46;
}

export function recordPdfBlob(sub) {
  const JS = window.jspdf && window.jspdf.jsPDF; if (!JS) return null;
  const doc = new JS({ unit: 'pt', format: 'a4' });
  const f = getForm(sub.formId), pac = getPac(f.pacId);
  const L = 48, R = 547; let y = 54;
  y = pdfHeader(doc, L, R, y);
  doc.setDrawColor(210); doc.line(L, y, R, y); y += 22;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(20); doc.text(String(f.title), L, y); y += 16;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(110);
  doc.text(`${pac.code} · ${pac.name} · PL ${String(f.plNum || 0).padStart(2, '0')} · Rev. ${String(f.rev || 1).padStart(2, '0')}`, L, y); y += 26;
  doc.setFontSize(8); doc.setTextColor(130); doc.text('LOCAL DE COLETA', L, y);
  doc.setFontSize(11); doc.setTextColor(20); doc.text(`${f.location} — ${f.sector}`, L, y + 14); y += 40;
  doc.setFontSize(8); doc.setTextColor(130); doc.text('PARÂMETROS DE QUALIDADE', L, y); y += 6; doc.setDrawColor(225); doc.line(L, y, R, y); y += 18;
  f.params.forEach(p => {
    const v = sub.values[p.id] || { val: '—', ok: false };
    doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(20); doc.text(String(p.name), L, y);
    doc.text(String(v.val), R - 96, y, { align: 'right' });
    doc.setFont('helvetica', 'bold'); if (v.ok) doc.setTextColor(27, 110, 74); else doc.setTextColor(185, 28, 28);
    doc.text(v.ok ? 'Conforme' : 'Nao conforme', R, y, { align: 'right' }); y += 20;
  });
  y += 6; doc.setDrawColor(230); doc.line(L, y, R, y); y += 20;
  if (sub.occurrence) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(185, 28, 28); doc.text('NAO CONFORMIDADE', L, y); y += 14;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(60);
    (sub.occurrence.issues || []).forEach(i => { doc.text('- ' + i, L, y); y += 14; });
    if (sub.occurrence.note) { doc.text(doc.splitTextToSize(sub.occurrence.note, R - L), L, y); y += 18; } y += 8;
  }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(130); doc.text('RASTREABILIDADE E SEGURANCA', L, y); y += 15;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(40);
  doc.text(`Registrado por ${sub.operatorName} (Operador) em ${fmtDT(sub.ts)}${sub.slot ? ` — registro das ${sub.slot}` : ''}.`, L, y); y += 14;
  if (sub.signedBy) { doc.text(`Validado por ${sub.signedBy} em ${fmtDT(sub.signedAt)}.`, L, y); y += 14; }
  doc.setFontSize(9); doc.setTextColor(110); doc.text(`Hash de autenticidade: ${hashFor(sub)}`, L, y); y += 22;
  doc.setDrawColor(210); doc.line(L, y, R, y); y += 14;
  doc.setFontSize(8); doc.setTextColor(140); doc.text('Registro finalizado — nao permite edicao. Documento gerado pelo meuPAC.', L, y);
  return doc.output('blob');
}

export function reportPdfBlob(subs, label) {
  const JS = window.jspdf && window.jspdf.jsPDF; if (!JS) return null;
  const doc = new JS({ unit: 'pt', format: 'a4' });
  const L = 40, R = 555; let y = 54; const bottom = 800;
  y = pdfHeader(doc, L, R, y);
  doc.setDrawColor(210); doc.line(L, y, R, y); y += 22;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(20); doc.text('Relatório de Autocontrole', L, y); y += 16;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(110); doc.text(String(label || 'Todos os registros'), L, y); y += 22;
  const nc = subs.filter(s => s.occurrence).length, sg = subs.filter(s => s.signedBy).length;
  doc.setFontSize(10); doc.setTextColor(40);
  doc.text(`Registros: ${subs.length}    Conformes: ${subs.length - nc}    Não conformes: ${nc}    Assinados: ${sg}`, L, y); y += 20;
  const cols = [L, L + 78, L + 150, L + 320, L + 430];
  function head() {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(120);
    doc.text('DATA/HORA', cols[0], y); doc.text('PAC', cols[1], y); doc.text('PLANILHA', cols[2], y); doc.text('OPERADOR', cols[3], y); doc.text('STATUS', cols[4], y);
    y += 4; doc.setDrawColor(220); doc.line(L, y, R, y); y += 12;
  }
  head();
  subs.slice().sort((a, b) => new Date(b.ts) - new Date(a.ts)).forEach(s => {
    if (y > bottom) { doc.addPage(); y = 54; head(); }
    const f = getForm(s.formId), pac = getPac(f.pacId); const d = new Date(s.ts);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(40);
    doc.text(d.toLocaleDateString('pt-BR').slice(0, 5) + ' ' + fmtTime(s.ts), cols[0], y);
    doc.text(pac.code, cols[1], y);
    doc.text(doc.splitTextToSize(f.title, 160)[0], cols[2], y);
    doc.text(doc.splitTextToSize(s.operatorName, 100)[0], cols[3], y);
    if (s.occurrence) { doc.setTextColor(185, 28, 28); doc.text('Nao conf.', cols[4], y); }
    else if (s.signedBy) { doc.setTextColor(27, 110, 74); doc.text('Assinado', cols[4], y); }
    else { doc.setTextColor(140, 90, 0); doc.text('Pendente', cols[4], y); }
    y += 16;
  });
  y += 6; if (y > bottom) { doc.addPage(); y = 54; } doc.setDrawColor(210); doc.line(L, y, R, y); y += 14;
  doc.setFontSize(8); doc.setTextColor(140); doc.text(`RT responsável: ${getUnidade().rtNome} — ${getUnidade().rtRegistro}. Documento gerado pelo meuPAC.`, L, y);
  return doc.output('blob');
}

export function exportReportPdf(subs, label) {
  const b = reportPdfBlob(subs, label);
  if (!b) { toast('Gerador de PDF carregando, tente de novo.', 'err'); return; }
  downloadFile('relatorio-meupac.pdf', b);
}

export function exportRecordPdf(subId, submissions) {
  const sub = submissions.find(s => s.id === subId); if (!sub) return;
  const blob = recordPdfBlob(sub);
  if (!blob) { toast('Gerador de PDF ainda carregando, tente de novo.', 'err'); return; }
  downloadFile(`registro-${hashFor(sub)}.pdf`, blob);
}

function csvCell(v) { v = String(v == null ? '' : v); return /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
export function exportHistCsv(subs) {
  const head = ['Data', 'Hora', 'PAC', 'Codigo', 'Planilha', 'Revisao', 'Operador', 'Conforme', 'Nao Conformidade', 'Assinado por', 'Assinado em', 'Hash'];
  const lines = [head.join(';')];
  subs.forEach(s => {
    const f = getForm(s.formId), pac = getPac(f.pacId); const d = new Date(s.ts);
    lines.push([d.toLocaleDateString('pt-BR'), fmtTime(s.ts), pac.code + ' ' + pac.name, `PL ${String(f.plNum || 0).padStart(2, '0')}`, f.title, `Rev. ${String(f.rev || 1).padStart(2, '0')}`, s.operatorName,
      s.occurrence ? 'Nao' : 'Sim', s.occurrence ? (s.occurrence.issues || []).join(' | ') : '', s.signedBy || '', s.signedBy ? fmtDT(s.signedAt) : '', hashFor(s)].map(csvCell).join(';'));
  });
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv' });
  downloadFile('historico-meupac.csv', blob);
}
