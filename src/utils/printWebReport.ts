/** Open synchronously from the export tap, so mobile browsers allow the new tab. */
export function printWebReport(html: string): void {
  const report = window.open('', '_blank');
  if (!report) throw new Error('Consenti l’apertura della scheda del report e riprova.');
  report.opener = null;
  report.document.open();
  report.document.write(html);
  report.document.close();

  // Keep a manual action available when a browser blocks automatic printing.
  const toolbar = report.document.createElement('div');
  toolbar.className = 'print-controls';
  const button = report.document.createElement('button');
  button.type = 'button';
  button.textContent = 'Stampa / Salva come PDF';
  const print = () => {
    if (report.closed) return;
    report.focus();
    report.print();
  };
  button.addEventListener('click', print);
  toolbar.appendChild(button);
  report.document.body.prepend(toolbar);
  void report.document.fonts.ready.then(() => {
    if (!report.closed) report.requestAnimationFrame(() => report.requestAnimationFrame(print));
  }).catch(() => { /* The manual print button remains available. */ });
}
