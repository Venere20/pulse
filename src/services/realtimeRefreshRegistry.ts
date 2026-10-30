type Change = (tables: readonly string[]) => void;
type Connection = (connected: boolean) => void;
interface Channel {
  on: (kind: 'postgres_changes', filter: { event: '*'; schema: 'public'; table: string }, callback: () => void) => Channel;
  subscribe: (callback: (status: string) => void) => unknown;
}
interface Client { channel: (name: string) => Channel; removeChannel: (channel: Channel) => unknown }
interface Listener { change: Change; connection: Connection }
interface Group { listeners: Set<Listener>; channel: Channel; connected: boolean; changed: Set<string>; timer?: ReturnType<typeof setTimeout>; disposed: boolean }

/** One subscription and one invalidation per account/query group. Reconnects
 * still revalidate the whole group to recover events missed while offline. */
export function createRealtimeRefreshRegistry(client: Client, invalidate: (owner: string, table: string) => void) {
  const groups = new Map<string, Group>();
  let sequence = 0;
  return {
    subscribe(owner: string, tables: readonly string[], change: Change, connection: Connection) {
      const names = [...new Set(tables)].sort();
      if (!owner || !names.length) return () => {};
      const key = JSON.stringify([owner, names]);
      const listener = { change, connection };
      const existing = groups.get(key);
      if (existing) {
        existing.listeners.add(listener); connection(existing.connected);
        return () => remove(existing, key, listener);
      }
      const group: Group = { listeners: new Set([listener]), channel: client.channel(`rt-shared-${++sequence}`), connected: false, changed: new Set(), disposed: false };
      groups.set(key, group);
      connection(false);
      const trigger = (changed: readonly string[]) => {
        if (group.disposed) return;
        changed.forEach(table => group.changed.add(table));
        if (group.timer) clearTimeout(group.timer);
        group.timer = setTimeout(() => {
          group.timer = undefined;
          if (group.disposed) return;
          const batch = [...group.changed]; group.changed.clear();
          batch.forEach(table => invalidate(owner, table));
          for (const subscriber of group.listeners) subscriber.change(batch);
        }, 300);
      };
      names.forEach(table => group.channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => trigger([table])));
      group.channel.subscribe(status => {
        if (group.disposed) return;
        const connected = status === 'SUBSCRIBED';
        if (group.connected !== connected) {
          group.connected = connected;
          for (const subscriber of group.listeners) subscriber.connection(connected);
        }
        if (connected) trigger(names);
      });
      return () => remove(group, key, listener);
    },
  };
  function remove(group: Group, key: string, listener: Listener) {
    group.listeners.delete(listener);
    if (group.listeners.size || group.disposed) return;
    group.disposed = true;
    if (group.timer) clearTimeout(group.timer);
    groups.delete(key);
    void client.removeChannel(group.channel);
  }
}
