import { Visit, Expense, Settlement } from '../types/travel';
import { categoryTotals, computeBalance, expenseCategory } from './settlement';
import { formatDateIt } from './dates';

const esc = (s: unknown) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const eur = (n: number) => Number(n).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
export const buildVisitReportHtml = (
  visit: Visit,
  expenses: Expense[],
  settlements: Settlement[],
  userId: string,
  partnerId: string,
  names: Record<string, string> = {}
) => {
  // Nomi presi dalla tabella users (modificabili dalle Impostazioni)
  const name = (id: string) => names[id] || 'Partner';
  // Il saldo è calcolato dal punto di vista di userId, ma il testo usa i nomi neutri.
  const bal = computeBalance(expenses, settlements, userId);
  const cats = categoryTotals(expenses);

  let balanceText = 'I conti sono pari';
  if (bal.net > 0) balanceText = `${esc(name(partnerId))} deve ${eur(bal.net)} a ${esc(name(userId))}`;
  if (bal.net < 0) balanceText = `${esc(name(userId))} deve ${eur(-bal.net)} a ${esc(name(partnerId))}`;

  const rows = expenses
    .slice()
    .sort((a, b) => (a.created_at || a.date).localeCompare(b.created_at || b.date))
    .map(
      (e) => `<tr><td>${esc(formatDateIt(e.date))}</td><td>${esc(e.title)}</td><td>${esc(
        expenseCategory(e)
      )}</td><td>${esc(name(e.paid_by))}</td><td class="r">${eur(Number(e.amount))}</td></tr>`
    )
    .join('');

  const catRows = cats
    .map(
      (c) => `<tr><td>${esc(c.category)}</td><td class="r">${eur(c.total)}</td><td class="r">${c.pct.toLocaleString('it-IT', { maximumFractionDigits: 1 })}%</td></tr>`
    )
    .join('');

  const setRows = settlements
    .map(
      (s) => `<tr><td>${esc(formatDateIt(s.created_at))}</td><td>${esc(name(s.from_user_id))} → ${esc(
        name(s.to_user_id)
      )}</td><td class="r">${eur(Number(s.amount))}</td></tr>`
    )
    .join('');

  const detail = (label: string, value?: string | null) =>
    value ? `<p><b>${label}:</b> ${esc(value)}</p>` : '';

  return `<!DOCTYPE html><html lang="it"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Report spese - ${esc(visit.title)}</title>
<style>
  @page { size: A4 portrait; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: Helvetica, Arial, sans-serif; font-size:10pt; line-height:1.45; color:#25202A; margin:0; padding:0; overflow-wrap:anywhere; }
  h1 { color:#91465F; font-size:23pt; line-height:1.2; margin:4px 0 8px; }
  h2 { font-size:13pt; margin:22px 0 8px; border-bottom:1px solid #CBB8C2; padding-bottom:5px; break-after:avoid; page-break-after:avoid; }
  p { margin:5px 0; }
  .brand { color:#91465F; font-size:10pt; font-weight:bold; letter-spacing:2px; }
  table { width:100%; table-layout:fixed; border-collapse:collapse; margin:8px 0; font-size:9pt; }
  thead { display:table-header-group; }
  tr { break-inside:avoid; page-break-inside:avoid; }
  th, td { text-align:left; vertical-align:top; padding:7px 6px; border-bottom:1px solid #DDD5DA; overflow-wrap:anywhere; word-wrap:break-word; }
  th { background:#F3EDF0; color:#51434D; font-weight:bold; }
  .r { text-align:right; white-space:nowrap; font-variant-numeric:tabular-nums; }
  .date { white-space:nowrap; }
  .total { font-size:13pt; font-weight:bold; margin-top:10px; break-inside:avoid; }
  .balance { border:1px solid #CBB8C2; border-left:4px solid #91465F; padding:12px; margin-top:12px; font-weight:bold; break-inside:avoid; page-break-inside:avoid; }
  .muted { color:#655B65; font-size:9pt; }
  .summary { break-inside:avoid; page-break-inside:avoid; }
  .print-controls { margin-bottom:20px; }
  .print-controls button { padding:12px 18px; font:inherit; cursor:pointer; }
  @media screen { body { max-width:210mm; margin:0 auto; padding:24px; background:white; } }
  @media print { .print-controls { display:none !important; } body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
</style></head><body>
<p class="brand">PULSE / REPORT SPESE</p>
<h1>${esc(visit.title)}</h1>
<p class="muted">Dal ${esc(formatDateIt(visit.start_date))} al ${esc(formatDateIt(visit.end_date))}</p>
${detail('Luogo', visit.location)}
${detail('Punto d\'incontro', visit.meeting_point)}
${detail('Alloggio', visit.hotel)}
${detail('Orario di arrivo', visit.arrival_time)}
${detail('Trasporto', visit.transport)}
${visit.travel_km ? `<p><b>Km percorsi per vedervi:</b> ${Math.round(Number(visit.travel_km))} km</p>` : ''}

<h2>Storico spese</h2>
<table><colgroup><col style="width:14%"><col style="width:36%"><col style="width:16%"><col style="width:18%"><col style="width:16%"></colgroup><thead><tr><th>Data</th><th>Descrizione</th><th>Categoria</th><th>Pagato da</th><th class="r">Importo</th></tr></thead><tbody>${
    rows || '<tr><td colspan="5">Nessuna spesa registrata</td></tr>'
  }</tbody></table>
<p class="total">Totale speso: ${eur(bal.total)}</p>

${cats.length ? `<h2>Per categoria</h2><table><colgroup><col style="width:50%"><col style="width:30%"><col style="width:20%"></colgroup><thead><tr><th>Categoria</th><th class="r">Totale</th><th class="r">%</th></tr></thead><tbody>${catRows}</tbody></table>` : ''}

<section class="summary">
<h2>Saldo finale</h2>
<table><colgroup><col style="width:70%"><col style="width:30%"></colgroup><tbody>
  <tr><td>${esc(name(userId))} ha pagato</td><td class="r">${eur(bal.paidByMe)}</td></tr>
  <tr><td>${esc(name(partnerId))} ha pagato</td><td class="r">${eur(bal.paidByPartner)}</td></tr>
  <tr><td>Quota a testa</td><td class="r">${eur(bal.total / 2)}</td></tr>
</tbody></table>
<div class="balance">${balanceText}</div>
</section>
${settlements.length ? `<h2>Conguagli già registrati</h2><table><colgroup><col style="width:18%"><col style="width:62%"><col style="width:20%"></colgroup><thead><tr><th>Data</th><th>Trasferimento</th><th class="r">Importo</th></tr></thead><tbody>${setRows}</tbody></table>` : ''}
</body></html>`;
};
