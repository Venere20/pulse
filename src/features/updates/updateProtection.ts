export function createUpdateProtection() {
  const holds = new Set<symbol>(); const listeners = new Set<() => void>();
  const emit = () => { for (const listener of listeners) listener(); };
  return {
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    blocked() { return holds.size > 0; },
    hold() {
      const token = Symbol('update-protection'); holds.add(token); emit();
      return () => { if (holds.delete(token)) emit(); };
    },
  };
}
export const updateProtection = createUpdateProtection();
