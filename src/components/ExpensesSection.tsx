import { trackResult } from '../services/saveState';
import React, { useMemo, useState } from 'react';
import { View, Platform, TouchableOpacity } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { supabase } from '../config/supabase';
import { Visit, Expense, Settlement, EXPENSE_CATEGORIES, ExpenseCategory } from '../types/travel';
import { computeBalance, categoryTotals, expenseCategory } from '../utils/settlement';
import { buildVisitReportHtml } from '../utils/report';
import { printWebReport } from '../utils/printWebReport';
import { confirmAction } from '../utils/confirm';
import { dateOnly, formatDateIt } from '../utils/dates';
import { useAppDataFields } from '../state/AppData';
import { ExpensePieChart } from './ExpensePieChart';
import { Button, Card, Chip, EmptyState, Input, SectionTitle, T } from '../ui/primitives';
import { BottomSheet } from '../ui/layout';
import { Icon } from '../ui/Icon';
import { useToast } from '../ui/Toast';
import { useTheme } from '../theme/ThemeProvider';

interface Props {
  visit: Visit;
  userId: string;
  partnerId: string;
  expenses: Expense[];
  settlements: Settlement[];
  onChanged: () => void;
}

const eur = (n: number) => `€ ${Number(n).toFixed(2)}`;

export const ExpensesSection: React.FC<Props> = ({ visit, userId, partnerId, expenses, settlements, onChanged }) => {
  const { c, s } = useTheme();
  const toast = useToast();
  const { names } = useAppDataFields(['names']);
  const nameOf = (id: string) => names[id] || 'Partner';
  const partnerName = nameOf(partnerId);

  const [sheet, setSheet] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('Cibo');
  const [paidBy, setPaidBy] = useState<string>(userId);
  const [filter, setFilter] = useState<ExpenseCategory | null>(null);
  const [busy, setBusy] = useState(false);

  const balance = useMemo(() => computeBalance(expenses, settlements, userId), [expenses, settlements, userId]);
  const cats = useMemo(() => categoryTotals(expenses), [expenses]);
  const shown = filter ? expenses.filter((e) => expenseCategory(e) === filter) : expenses;
  const shownTotal = shown.reduce((sum, e) => sum + Number(e.amount), 0);

  const openNew = () => {
    setEditing(null);
    setTitle('');
    setAmount('');
    setCategory('Cibo');
    setPaidBy(userId);
    setSheet(true);
  };

  const openEdit = (e: Expense) => {
    setEditing(e);
    setTitle(e.title);
    setAmount(String(e.amount).replace('.', ','));
    setCategory(expenseCategory(e));
    setPaidBy(e.paid_by);
    setSheet(true);
  };

  const saveExpense = async () => {
    const value = parseFloat(amount.replace(',', '.'));
    if (!title.trim() || isNaN(value) || value <= 0) {
      toast.error('Inserisci una descrizione e un importo valido');
      return;
    }
    setBusy(true);
    const fields = { title: title.trim(), amount: value, category, paid_by: paidBy };
    const { error } = editing
      ? await trackResult(() => supabase.from('trip_expenses').update(fields).eq('id', editing.id))
      : await trackResult(() => supabase.from('trip_expenses').insert([{ ...fields, visit_id: visit.id, date: dateOnly(visit.start_date) }]));
    setBusy(false);
    if (error) {
      toast.error("Impossibile salvare la spesa: " + error.message);
      return;
    }
    setSheet(false);
    toast.success(editing ? 'Spesa aggiornata' : 'Spesa aggiunta');
    onChanged();
  };

  const deleteExpense = async () => {
    if (!editing) return;
    const ok = await confirmAction('Elimina spesa', `Eliminare "${editing.title}" (${eur(Number(editing.amount))})?`, 'Elimina');
    if (!ok) return;
    setBusy(true);
    const { error } = await trackResult(() => supabase.from('trip_expenses').delete().eq('id', editing.id));
    setBusy(false);
    if (error) return toast.error("Impossibile eliminare: " + error.message);
    setSheet(false);
    toast.success('Spesa eliminata');
    onChanged();
  };

  const settleUp = async () => {
    if (balance.net === 0) return;
    const ok = await confirmAction(
      'Pareggia i conti',
      balance.net > 0
        ? `Confermi che ${partnerName} ti ha saldato ${eur(balance.net)}?`
        : `Confermi di aver saldato ${eur(-balance.net)} a ${partnerName}?`
    );
    if (!ok) return;
    setBusy(true);
    const { error } = await trackResult(() => supabase.from('settlements').insert([
      {
        visit_id: visit.id,
        from_user_id: balance.net < 0 ? userId : partnerId,
        to_user_id: balance.net < 0 ? partnerId : userId,
        amount: Math.abs(balance.net),
      },
    ]));
    setBusy(false);
    if (error) return toast.error("Impossibile registrare il saldo: " + error.message);
    toast.success('Conti pareggiati');
    onChanged();
  };

  const exportPdf = async () => {
    try {
      setBusy(true);
      const html = buildVisitReportHtml(visit, expenses, settlements, userId, partnerId, names);
      if (Platform.OS === 'web') {
        printWebReport(html);
      } else {
        const { uri } = await Print.printToFileAsync({ html, width: 595, height: 842 });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Report ${visit.title}`, UTI: 'com.adobe.pdf' });
        } else {
          toast.error('Condivisione non disponibile su questo dispositivo');
        }
      }
    } catch (e: any) {
      toast.error("Impossibile creare il PDF: " + (e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const balanceText =
    balance.net === 0 ? 'Siete in pari ✅' : balance.net > 0 ? `${partnerName} ti deve ${eur(balance.net)}` : `Devi ${eur(-balance.net)} a ${partnerName}`;

  return (
    <View style={{ gap: s.lg }}>
      <Card accent>
        <T tone="muted">Chi deve quanto a chi</T>
        <T v="h2" tone={balance.net === 0 ? 'success' : 'primary'} style={{ marginVertical: 4 }}>{balanceText}</T>
        <T tone="muted">
          Totale {eur(balance.total)} · quota a testa {eur(balance.total / 2)} · pagato da te {eur(balance.paidByMe)}, da {partnerName} {eur(balance.paidByPartner)}
        </T>
        <View style={{ flexDirection: 'row', gap: s.sm, marginTop: s.md, flexWrap: 'wrap' }}>
          {balance.net !== 0 && <Button label="Pareggia i conti" icon="check" onPress={settleUp} loading={busy} />}
          <Button label="Report PDF" icon="download" variant="secondary" onPress={exportPdf} loading={busy} />
        </View>
        {settlements.length > 0 && (
          <View style={{ marginTop: s.md, gap: 2 }}>
            {settlements.map((st) => (
              <T key={st.id} tone="muted">
                ✔ {formatDateIt(st.created_at)} · {nameOf(st.from_user_id)} → {nameOf(st.to_user_id)}: {eur(Number(st.amount))}
              </T>
            ))}
          </View>
        )}
      </Card>

      {cats.length > 0 && (
        <Card>
          <SectionTitle title="Per categoria" />
          <ExpensePieChart
            data={cats.map((ct) => ({ key: ct.category, label: `${ct.emoji} ${ct.category}`, value: ct.total, color: ct.color }))}
            selected={filter}
            onSelect={(k) => setFilter(k as ExpenseCategory | null)}
          />
        </Card>
      )}

      <Card>
        <SectionTitle title="Spese" right={<Button small label="Aggiungi" icon="plus" onPress={openNew} />} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s.sm, marginBottom: s.md }}>
          <Chip label="Tutte" selected={!filter} onPress={() => setFilter(null)} />
          {EXPENSE_CATEGORIES.map((ct) => (
            <Chip key={ct.id} label={`${ct.emoji} ${ct.id}`} selected={filter === ct.id} color={ct.color} onPress={() => setFilter(filter === ct.id ? null : ct.id)} />
          ))}
        </View>

        {shown.length === 0 ? (
          <EmptyState icon="dollar" title="Nessuna spesa" hint="Aggiungi la prima spesa per vedere il saldo." />
        ) : (
          shown.map((e) => (
            <TouchableOpacity
              key={e.id}
              accessibilityRole="button"
              accessibilityLabel={`${e.title}, ${eur(Number(e.amount))}. Tocca per modificare o eliminare`}
              onPress={() => openEdit(e)}
              activeOpacity={0.7}
              style={{ flexDirection: 'row', alignItems: 'center', minHeight: 56, borderBottomWidth: 1, borderBottomColor: c.border, gap: s.sm }}
            >
              <View style={{ flex: 1 }}>
                <T>{e.title}</T>
                <T tone="muted">
                  {EXPENSE_CATEGORIES.find((ct) => ct.id === expenseCategory(e))?.emoji} {expenseCategory(e)} · pagato da {e.paid_by === userId ? 'te' : nameOf(e.paid_by)}
                </T>
              </View>
              <T bold>{eur(Number(e.amount))}</T>
              <Icon name="edit" size={16} color={c.textFaint} />
            </TouchableOpacity>
          ))
        )}
        {shown.length > 0 && (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: s.md }}>
            <T bold>{filter ? `Totale ${filter}` : 'Totale'}</T>
            <T bold tone="success">{eur(shownTotal)}</T>
          </View>
        )}
      </Card>

      <BottomSheet
        visible={sheet}
        title={editing ? 'Modifica spesa' : 'Nuova spesa'}
        onClose={() => setSheet(false)}
        footer={
          <>
            <Button label={editing ? 'Salva modifiche' : 'Salva spesa'} onPress={saveExpense} loading={busy} />
            {editing && <Button label="Elimina spesa" icon="trash" variant="danger" onPress={deleteExpense} disabled={busy} />}
          </>
        }
      >
        <Input label="Descrizione" placeholder="Es. Cena da Mario" value={title} onChangeText={setTitle} />
        <Input label="Importo (€)" placeholder="0,00" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />
        <T tone="muted">Pagato da</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s.sm }}>
          <Chip label="Io" selected={paidBy === userId} onPress={() => setPaidBy(userId)} />
          <Chip label={partnerName} selected={paidBy === partnerId} onPress={() => setPaidBy(partnerId)} />
        </View>
        <T tone="muted">Categoria</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s.sm }}>
          {EXPENSE_CATEGORIES.map((ct) => (
            <Chip key={ct.id} label={`${ct.emoji} ${ct.id}`} selected={category === ct.id} color={ct.color} onPress={() => setCategory(ct.id)} />
          ))}
        </View>
      </BottomSheet>
    </View>
  );
};
