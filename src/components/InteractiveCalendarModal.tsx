import { DateField } from '../ui/DateField';
import { trackResult } from '../services/saveState';
import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { supabase, USER_IDS } from '../config/supabase';
import { Visit, Expense } from '../types/travel';

interface Props {
  visible: boolean;
  userId: string;
  onClose: () => void;
}

export const InteractiveCalendarModal: React.FC<Props> = ({ visible, userId, onClose }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDateStr, setSelectedDateStr] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [visits, setVisits] = useState<Visit[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false);

  // Form stato
  const [visitTitle, setVisitTitle] = useState('');
  const [visitEndDate, setVisitEndDate] = useState('');
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');



  const fetchMonthData = async () => {
    setLoading(true);

    const { data: vData } = await supabase.from('visits').select('*');
    const { data: eData } = await supabase.from('trip_expenses').select('*');

    if (vData) setVisits(vData);
    if (eData) setExpenses(eData);

    setLoading(false);
  };
  useEffect(() => {
    if (visible) {
      const initial=setTimeout(()=>{void fetchMonthData();},0);
      return()=>clearTimeout(initial);
    }
  }, [visible, currentDate]);

  // Logica Calendario (Giorni del mese)
  const getDaysInMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days = [];
    // Spazi vuoti inizio mese
    const startingOffset = firstDay === 0 ? 6 : firstDay - 1;
    for (let i = 0; i < startingOffset; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      const str = d.toISOString().split('T')[0];
      days.push({ dayNumber: i, dateStr: str });
    }
    return days;
  };

  const changeMonth = (delta: number) => {
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + delta, 1);
    setCurrentDate(newDate);
  };

  // Trova dati del giorno selezionato
  const currentVisit = visits.find(
    (v) => selectedDateStr >= v.start_date && selectedDateStr <= v.end_date
  );
  const currentExpenses = expenses.filter((e) => e.date === selectedDateStr);

  // Totali Spese Generali & Del giorno
  const totalDayExpenses = currentExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const totalAllExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const paidByMe = expenses
    .filter((e) => e.paid_by === userId)
    .reduce((s, e) => s + Number(e.amount), 0);
  const paidByPartner = totalAllExpenses - paidByMe;

  // Calcolo Countdown se c'è un incontro futuro
  const nextVisit = visits
    .filter((v) => v.start_date >= new Date().toISOString().split('T')[0])
    .sort((a, b) => a.start_date.localeCompare(b.start_date))[0];

  const getDaysCountdown = (targetStr: string) => {
    const today = new Date().getTime();
    const target = new Date(targetStr).getTime();
    const diff = Math.ceil((target - today) / (1000 * 3600 * 24));
    return diff > 0 ? diff : 0;
  };

  // Azioni DB
  const handleSaveVisit = async () => {
    if (!visitTitle.trim() || !visitEndDate) return;
    const newV = {
      title: visitTitle,
      start_date: selectedDateStr,
      end_date: visitEndDate,
      created_by: userId,
    };
    await trackResult(() => supabase.from('visits').insert([newV]));
    setVisitTitle('');
    setVisitEndDate('');
    fetchMonthData();
  };

  const handleAddExpense = async () => {
    if (!expenseTitle.trim() || !expenseAmount) return;
    const newE = {
      date: selectedDateStr,
      title: expenseTitle,
      amount: parseFloat(expenseAmount),
      paid_by: userId,
    };
    await trackResult(() => supabase.from('trip_expenses').insert([newE]));
    setExpenseTitle('');
    setExpenseAmount('');
    fetchMonthData();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>📅 Pianificazione Incontri</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeTxt}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Banner Countdown Incontro */}
          {nextVisit && (
            <View style={styles.countdownBanner}>
              <Text style={styles.cdTitle}>⏱️ Prossimo Incontro: {nextVisit.title}</Text>
              <Text style={styles.cdDays}>
                Mancano <Text style={styles.highlight}>{getDaysCountdown(nextVisit.start_date)}</Text> giorni!
              </Text>
            </View>
          )}

          {/* Intestazione Mese & Navigazione */}
          <View style={styles.monthHeader}>
            <TouchableOpacity onPress={() => changeMonth(-1)}>
              <Text style={styles.navArrow}>◀</Text>
            </TouchableOpacity>
            <Text style={styles.monthTitle}>
              {currentDate.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}
            </Text>
            <TouchableOpacity onPress={() => changeMonth(1)}>
              <Text style={styles.navArrow}>▶</Text>
            </TouchableOpacity>
          </View>

          {/* Griglia Calendario */}
          <View style={styles.weekDaysRow}>
            {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map((d) => (
              <Text key={d} style={styles.weekDayText}>
                {d}
              </Text>
            ))}
          </View>

          <View style={styles.calendarGrid}>
            {getDaysInMonth().map((item, idx) => {
              if (!item) return <View key={`empty-${idx}`} style={styles.dayCellEmpty} />;

              const isSelected = item.dateStr === selectedDateStr;
              const hasVisit = visits.some(
                (v) => item.dateStr >= v.start_date && item.dateStr <= v.end_date
              );
              const hasExpense = expenses.some((e) => e.date === item.dateStr);

              return (
                <TouchableOpacity
                  key={item.dateStr}
                  style={[
                    styles.dayCell,
                    isSelected && styles.selectedCell,
                    hasVisit && styles.visitCell,
                  ]}
                  onPress={() => setSelectedDateStr(item.dateStr)}
                >
                  <Text style={[styles.dayNumber, isSelected && styles.selectedDayNum]}>
                    {item.dayNumber}
                  </Text>
                  <View style={styles.dotsRow}>
                    {hasVisit && <View style={styles.visitDot} />}
                    {hasExpense && <View style={styles.expenseDot} />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Scheda Dettaglio Giorno Selezionato */}
          <ScrollView style={styles.dayDetailsCard}>
            <Text style={styles.selectedDateHeader}>
              📌 Dettaglio del {new Date(selectedDateStr).toLocaleDateString('it-IT')}
            </Text>

            {/* Incontro / Visita per la Data */}
            {currentVisit ? (
              <View style={styles.infoBox}>
                <Text style={styles.infoTitle}>✈️ Incontro Fissato: {currentVisit.title}</Text>
                <Text style={styles.infoSub}>
                  Dal {currentVisit.start_date} al {currentVisit.end_date}
                </Text>
              </View>
            ) : (
              <View style={styles.formBox}>
                <Text style={styles.formLabel}>Fissa Incontro da questa data</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Nome incontro (es. Weekend a Roma)"
                  placeholderTextColor="#666"
                  value={visitTitle}
                  onChangeText={setVisitTitle}
                />
                <DateField label="Data di fine" value={visitEndDate} onChange={setVisitEndDate} minDate={selectedDateStr} />
                <TouchableOpacity style={styles.btnAction} onPress={handleSaveVisit}>
                  <Text style={styles.btnText}>Salva Incontro</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Spese per la Data */}
            <View style={styles.sectionBox}>
              <Text style={styles.formLabel}>💰 Spese del giorno (€ {totalDayExpenses.toFixed(2)})</Text>
              {currentExpenses.map((exp) => (
                <View key={exp.id} style={styles.expenseRow}>
                  <Text style={styles.expTitle}>{exp.title}</Text>
                  <Text style={styles.expAmount}>€ {Number(exp.amount).toFixed(2)}</Text>
                </View>
              ))}

              <TextInput
                style={styles.input}
                placeholder="Descrizione spesa (es. Cena, Taxi)"
                placeholderTextColor="#666"
                value={expenseTitle}
                onChangeText={setExpenseTitle}
              />
              <TextInput
                style={styles.input}
                placeholder="Importo (€)"
                placeholderTextColor="#666"
                keyboardType="numeric"
                value={expenseAmount}
                onChangeText={setExpenseAmount}
              />
              <TouchableOpacity style={styles.btnAction} onPress={handleAddExpense}>
                <Text style={styles.btnText}>+ Aggiungi Spesa</Text>
              </TouchableOpacity>
            </View>

            {/* Riepilogo Totale Spese Coppia */}
            <View style={styles.totalLedgerCard}>
              <Text style={styles.ledgerTitle}>📊 Bilancio Totale Spese Coppia</Text>
              <Text style={styles.ledgerTotal}>Totale: € {totalAllExpenses.toFixed(2)}</Text>
              <View style={styles.ledgerRow}>
                <Text style={styles.ledgerSub}>Tu: € {paidByMe.toFixed(2)}</Text>
                <Text style={styles.ledgerSub}>Partner: € {paidByPartner.toFixed(2)}</Text>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalContainer: {
    backgroundColor: '#141417',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
    maxHeight: '92%',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  closeBtn: { padding: 5 },
  closeTxt: { color: '#888', fontSize: 18, fontWeight: 'bold' },
  countdownBanner: {
    backgroundColor: '#2A1824',
    borderColor: '#FF2366',
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginTop: 10,
    alignItems: 'center',
  },
  cdTitle: { color: '#FFF', fontWeight: 'bold', fontSize: 13 },
  cdDays: { color: '#AAA', fontSize: 12, marginTop: 2 },
  highlight: { color: '#FF2366', fontWeight: 'bold', fontSize: 15 },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 12,
  },
  monthTitle: { color: '#FFF', fontSize: 16, fontWeight: 'bold', textTransform: 'capitalize' },
  navArrow: { color: '#FF2366', fontSize: 18, paddingHorizontal: 15 },
  weekDaysRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 6 },
  weekDayText: { color: '#666', fontSize: 11, fontWeight: 'bold', width: 35, textAlign: 'center' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start' },
  dayCellEmpty: { width: '14.28%', height: 42 },
  dayCell: {
    width: '14.28%',
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    marginVertical: 1,
  },
  selectedCell: { borderWidth: 1, borderColor: '#FF2366', backgroundColor: '#22222A' },
  visitCell: { backgroundColor: '#FF2366' },
  dayNumber: { color: '#DDD', fontSize: 13, fontWeight: '500' },
  selectedDayNum: { color: '#FF2366', fontWeight: 'bold' },
  dotsRow: { flexDirection: 'row', gap: 3, marginTop: 2 },
  visitDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#FFF' },
  expenseDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#FFB800' },
  dayDetailsCard: {
    backgroundColor: '#1E1E24',
    borderRadius: 16,
    padding: 14,
    marginTop: 10,
    maxHeight: 280,
  },
  selectedDateHeader: { color: '#FFF', fontSize: 14, fontWeight: 'bold', marginBottom: 10 },
  infoBox: { backgroundColor: '#2B1A28', padding: 10, borderRadius: 10, marginBottom: 10 },
  infoTitle: { color: '#FFF', fontWeight: 'bold', fontSize: 13 },
  infoSub: { color: '#AAA', fontSize: 11, marginTop: 2 },
  formBox: { backgroundColor: '#141417', padding: 10, borderRadius: 10, marginBottom: 10, gap: 8 },
  sectionBox: { backgroundColor: '#141417', padding: 10, borderRadius: 10, marginBottom: 10, gap: 8 },
  formLabel: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  input: { backgroundColor: '#222228', color: '#FFF', borderRadius: 8, padding: 8, fontSize: 12 },
  btnAction: {
    backgroundColor: '#FF2366',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  btnText: { color: '#FFF', fontWeight: 'bold', fontSize: 12 },
  expenseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#222228',
    padding: 8,
    borderRadius: 6,
  },
  expTitle: { color: '#DDD', fontSize: 12 },
  expAmount: { color: '#FF2366', fontWeight: 'bold', fontSize: 12 },
  totalLedgerCard: { backgroundColor: '#2A2A32', padding: 10, borderRadius: 10, marginTop: 5 },
  ledgerTitle: { color: '#AAA', fontSize: 11, fontWeight: 'bold' },
  ledgerTotal: { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginVertical: 4 },
  ledgerRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  ledgerSub: { color: '#DDD', fontSize: 11 },
});