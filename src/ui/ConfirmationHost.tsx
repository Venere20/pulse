import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { ConfirmationRequest, registerConfirmationHandler } from '../utils/confirmationBroker';
import { BottomSheet } from './layout';
import { Button, T } from './primitives';
export function ConfirmationHost() {
  const [queue, setQueue] = useState<ConfirmationRequest[]>([]);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    return registerConfirmationHandler(request => setQueue(q => [...q, request]));
  }, []);
  const current = queue[0];
  const finish = (accepted: boolean) => { current?.resolve(accepted); setQueue(q => q.filter(r => r.id !== current?.id)); };
  return <BottomSheet visible={!!current} title={current?.title ?? 'Conferma'} onClose={() => finish(false)} footer={<><Button label="Annulla" variant="secondary" onPress={() => finish(false)} /><Button label={current?.label ?? 'Conferma'} onPress={() => finish(true)} /></>}><T>{current?.message}</T></BottomSheet>;
}
