import React from 'react';
import { useAppDataFields } from '../state/AppData';
import { Card, Button, T } from '../ui/primitives';
export function DataLoadBanner() {
    const { loadError, refresh } = useAppDataFields(['loadError', 'refresh']);
    if (!loadError)
        return null;
    return <Card>
    <T tone="danger" accessibilityLiveRegion="assertive">Dati non sincronizzati</T>
    <T tone="muted">{loadError}</T>
    <Button label="Riprova" variant="secondary" onPress={() => { void refresh(); }}/>
  </Card>;
}
