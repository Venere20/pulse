let owner = '';
let epoch = 0;
export function activateLocalReminders(userId: string) { owner = userId; epoch++; }
export function deactivateLocalReminders() { owner = ''; epoch++; }
export function reminderSession() { return owner ? { owner, epoch } : null; }
export function reminderSessionCurrent(ticket: ReturnType<typeof reminderSession>) {
  return !!ticket && ticket.owner === owner && ticket.epoch === epoch;
}
