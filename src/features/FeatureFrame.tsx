import React, { useRef, useState } from 'react';
import { router } from 'expo-router';
import { Screen, Header } from '../ui/layout';
import { Button, Card, T } from '../ui/primitives';
import { useToast } from '../ui/Toast';
import { ListScreen, ListScreenProps } from '../ui/ListScreen';
export function FeatureFrame<T>({ title, error, loading, onRefresh, onBack, scrollEnabled, children, list, headerRight }: {
    title: string;
    headerRight?: React.ReactNode;
    error?: string | null;
    loading?: boolean;
    onRefresh?: () => void;
    onBack?: () => void;
    scrollEnabled?: boolean;
    children: React.ReactNode;
    list?: Omit<ListScreenProps<T>, 'header' | 'before'>;
}) {
    const header = <Header title={title} right={headerRight} onBack={onBack ?? (() => router.canGoBack() ? router.back() : router.replace('/'))}/>;
    if (list && !error && !loading) return <ListScreen {...list} header={header} before={children} />;
    return <Screen scrollEnabled={scrollEnabled} header={header}>
    {error ? <Card><T tone="danger">{error}</T><T tone="muted">Verifica la connessione e riprova.</T><Button label="Riprova" onPress={() => onRefresh?.()}/></Card> : loading ? <T tone="muted">Caricamento…</T> : children}
  </Screen>;
}
export function useFeatureAction() {
    const [busy, setBusy] = useState(false);
    const toast = useToast();
    const running = useRef(false);
    const run = async (action: () => Promise<unknown>, after?: () => Promise<unknown>) => {
        if (running.current)
            return;
        running.current = true;
        setBusy(true);
        try {
            await action();
            await after?.();
        }
        catch (e) {
            toast.error(e instanceof Error ? e.message : 'Operazione non riuscita');
        }
        finally {
            running.current = false;
            setBusy(false);
        }
    };
    return { busy, run };
}
