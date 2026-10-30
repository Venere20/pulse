import { DateField } from '../ui/DateField';
import { trackResult } from '../services/saveState';
import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  FlatList,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { supabase, USER_IDS } from '../config/supabase';
import { Visit, Expense, TimeLeft } from '../types/travel';

interface Props {
  visible: boolean;
  userId: string;
  onClose: () => void;
}

export const TravelPlannerModal: React.FC<Props> = ({ visible, userId, onClose }) => {
  const [activeTab, setActiveTab] = useState<'countdown' | 'visits' | 'expenses'>('countdown');
  const [visits, setVisits] = useState<Visit[]>([]);
  const [nextVisit, setNextVisit] = useState<Visit | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);
  const [loading, setLoading] = useState(false);

  // Form nuova visita
  const [visitTitle, setVisitTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [location, setLocation] = useState('');

  // Form nuova spesa
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');



  const fetchData = async () => {
    setLoading(true);
    
    // Recupera visite
    const { data: visitsData } = await supabase
      .from('visits')
      .select('*')
      .order('start_date', { ascending: true });

    if (visitsData) {
      setVisits(visitsData);
      const upcoming = visitsData.find((v) => new Date(v.start_date).getTime() > Date.now());
      setNextVisit(upcoming || visitsData[0] || null);
    }

    // Recupera spese
    const { data: expensesData } = await supabase
      .from('trip_expenses')
      .select('*')
      .order('created_at', { ascending: false });

    if (expensesData) {
      setExpenses(expensesData);
    }

    setLoading(false);
  };
  useEffect(() => {
    if (visible) {
      const initial=setTimeout(()=>{void fetchData();},0);
      return()=>clearTimeout(initial);
    }
  }, [visible]);

  // Calcolo Countdown ogni secondo
  useEffect(() => {
    if (!nextVisit) {
      return;
    }

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const target = new Date(nextVisit.start_date).getTime();
      const difference = target - now;

      if (difference <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      } else {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60),
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [nextVisit]);

  const addVisit = async () => {
    if (!visitTitle.trim() || !startDate || !endDate) return;

    const newVisit = {
      title: visitTitle.trim(),
      start_date: new Date(startDate).toISOString(),
      end_date: new Date(endDate).toISOString(),
      location: location.trim() || undefined,
      created_by: userId,
    };

    const { data, error } = await trackResult(() => supabase.from('visits').insert([newVisit]).select());

    if (!error && data) {
      setVisitTitle('');
      setStartDate('');
      setEndDate('');
      setLocation('');
      fetchData();
      setActiveTab('countdown');
    }
  };

  const addExpense = async () => {
    if (!expenseTitle.trim() || !expenseAmount || isNaN(Number(expenseAmount))) return;

    const newExpense = {
      title: expenseTitle.trim(),
      amount: parseFloat(expenseAmount),
      paid_by: userId,
      visit_id: nextVisit?.id || undefined,
    };

    const { data, error } = await trackResult(() => supabase.from('trip_expenses').insert([newExpense]).select());

    if (!error && data) {
      setExpenseTitle('');
      setExpenseAmount('');
      fetchData();
    }
  };

  // Calcolo Totali Spese
  const totalAmount = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const paidByMe = expenses
    .filter((e) => e.paid_by === userId)
    .reduce((sum, e) => sum + Number(e.amount), 0);
  const paidByPartner = totalAmount - paidByMe;

  const getUserName = (id: string) => {
    if (id === USER_IDS.ANDROID) return 'Telefono (Android)';
    if (id === USER_IDS.WEB) return 'Web App';
    return 'Partner';
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>✈️ Viaggi & Incontri</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeTxt}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Navigation Tabs */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'countdown' && styles.activeTab]}
              onPress={() => setActiveTab('countdown')}
            >
              <Text style={styles.tabText}>⏱️ Timer</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'visits' && styles.activeTab]}
              onPress={() => setActiveTab('visits')}
            >
              <Text style={styles.tabText}>📅 Calendario</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'expenses' && styles.activeTab]}
              onPress={() => setActiveTab('expenses')}
            >
              <Text style={styles.tabText}>💰 Budget</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color="#FF2366" style={{ marginVertical: 40 }} />
          ) : (
            <ScrollView style={styles.content}>
              {/* TAB 1: COUNTDOWN */}
              {activeTab === 'countdown' && (
                <View style={styles.tabContent}>
                  {nextVisit ? (
                    <View style={styles.countdownCard}>
                      <Text style={styles.visitTitle}>{nextVisit.title}</Text>
                      {nextVisit.location && (
                        <Text style={styles.visitLocation}>📍 {nextVisit.location}</Text>
                      )}
                      <Text style={styles.visitDate}>
                        {new Date(nextVisit.start_date).toLocaleDateString('it-IT')} - {' '}
                        {new Date(nextVisit.end_date).toLocaleDateString('it-IT')}
                      </Text>

                      {timeLeft ? (
                        <View style={styles.timerGrid}>
                          <View style={styles.timeBox}>
                            <Text style={styles.timeVal}>{timeLeft.days}</Text>
                            <Text style={styles.timeLbl}>Giorni</Text>
                          </View>
                          <View style={styles.timeBox}>
                            <Text style={styles.timeVal}>{timeLeft.hours}</Text>
                            <Text style={styles.timeLbl}>Ore</Text>
                          </View>
                          <View style={styles.timeBox}>
                            <Text style={styles.timeVal}>{timeLeft.minutes}</Text>
                            <Text style={styles.timeLbl}>Minuti</Text>
                          </View>
                          <View style={styles.timeBox}>
                            <Text style={styles.timeVal}>{timeLeft.seconds}</Text>
                            <Text style={styles.timeLbl}>Secondi</Text>
                          </View>
                        </View>
                      ) : (
                        <Text style={styles.emptyText}>Incontro in corso o programmato!</Text>
                      )}
                    </View>
                  ) : (
                    <View style={styles.noVisitCard}>
                      <Text style={styles.noVisitText}>Nessun incontro programmato.</Text>
                      <TouchableOpacity
                        style={styles.addVisitBtn}
                        onPress={() => setActiveTab('visits')}
                      >
                        <Text style={styles.addVisitBtnText}>+ Pianifica una visita</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}

              {/* TAB 2: CALENDARIO VISITE */}
              {activeTab === 'visits' && (
                <View style={styles.tabContent}>
                  <View style={styles.formCard}>
                    <Text style={styles.formTitle}>Pianifica un incontro</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Titolo (es. Weekend a Roma)"
                      placeholderTextColor="#666"
                      value={visitTitle}
                      onChangeText={setVisitTitle}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Luogo (es. Roma)"
                      placeholderTextColor="#666"
                      value={location}
                      onChangeText={setLocation}
                    />
                    <DateField label="Data di inizio" value={startDate} onChange={day => { setStartDate(day); if (endDate && endDate < day) setEndDate(day); }} />
                    <DateField label="Data di fine" value={endDate} onChange={setEndDate} minDate={startDate || undefined} />
                    <TouchableOpacity style={styles.submitBtn} onPress={addVisit}>
                      <Text style={styles.submitBtnText}>Aggiungi Visita</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.sectionHeader}>Prossimi Incontri</Text>
                  {visits.map((v) => (
                    <View key={v.id} style={styles.visitItem}>
                      <Text style={styles.itemTitle}>{v.title}</Text>
                      <Text style={styles.itemSub}>
                        📅 {new Date(v.start_date).toLocaleDateString('it-IT')} - {' '}
                        {new Date(v.end_date).toLocaleDateString('it-IT')}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* TAB 3: BUDGET SPESE */}
              {activeTab === 'expenses' && (
                <View style={styles.tabContent}>
                  {/* Totali */}
                  <View style={styles.summaryCard}>
                    <Text style={styles.summaryTitle}>Totale Spese Condivise</Text>
                    <Text style={styles.totalAmount}>€ {totalAmount.toFixed(2)}</Text>
                    <View style={styles.summaryRow}>
                      <View>
                        <Text style={styles.sumLbl}>Pagato da te:</Text>
                        <Text style={styles.sumVal}>€ {paidByMe.toFixed(2)}</Text>
                      </View>
                      <View>
                        <Text style={styles.sumLbl}>Pagato dal partner:</Text>
                        <Text style={styles.sumVal}>€ {paidByPartner.toFixed(2)}</Text>
                      </View>
                    </View>
                  </View>

                  {/* Form Nuova Spesa */}
                  <View style={styles.formCard}>
                    <Text style={styles.formTitle}>Aggiungi Spesa Uscita/Viaggio</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Descrizione (es. Volo, Cena, Hotel)"
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
                    <TouchableOpacity style={styles.submitBtn} onPress={addExpense}>
                      <Text style={styles.submitBtnText}>+ Salva Spesa</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Lista Spese */}
                  <Text style={styles.sectionHeader}>Storico delle spese</Text>
                  {expenses.map((e) => (
                    <View key={e.id} style={styles.expenseItem}>
                      <View>
                        <Text style={styles.itemTitle}>{e.title}</Text>
                        <Text style={styles.itemSub}>Pagato da: {getUserName(e.paid_by)}</Text>
                      </View>
                      <Text style={styles.expenseAmount}>€ {Number(e.amount).toFixed(2)}</Text>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalContainer: {
    backgroundColor: '#18181C',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '90%',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  title: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  closeBtn: { padding: 5 },
  closeTxt: { color: '#888', fontSize: 18, fontWeight: 'bold' },
  tabBar: { flexDirection: 'row', backgroundColor: '#222228', borderRadius: 12, padding: 4, marginBottom: 15 },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  activeTab: { backgroundColor: '#FF2366' },
  tabText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  content: { marginBottom: 10 },
  tabContent: { gap: 15 },
  countdownCard: {
    backgroundColor: '#222228',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FF2366',
  },
  visitTitle: { color: '#FFF', fontSize: 22, fontWeight: 'bold' },
  visitLocation: { color: '#FF2366', fontSize: 14, marginTop: 4 },
  visitDate: { color: '#AAA', fontSize: 12, marginTop: 4, marginBottom: 15 },
  timerGrid: { flexDirection: 'row', gap: 10 },
  timeBox: {
    backgroundColor: '#141417',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
    minWidth: 60,
  },
  timeVal: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  timeLbl: { color: '#888', fontSize: 10, textTransform: 'uppercase', marginTop: 2 },
  noVisitCard: { backgroundColor: '#222228', padding: 25, borderRadius: 16, alignItems: 'center' },
  noVisitText: { color: '#888', marginBottom: 15 },
  addVisitBtn: { backgroundColor: '#FF2366', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 12 },
  addVisitBtnText: { color: '#FFF', fontWeight: 'bold' },
  formCard: { backgroundColor: '#222228', padding: 15, borderRadius: 16, gap: 10 },
  formTitle: { color: '#FFF', fontWeight: 'bold', fontSize: 14, marginBottom: 5 },
  input: { backgroundColor: '#141417', color: '#FFF', borderRadius: 10, padding: 10, fontSize: 14 },
  submitBtn: { backgroundColor: '#FF2366', borderRadius: 10, paddingVertical: 10, alignItems: 'center', marginTop: 5 },
  submitBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 13 },
  sectionHeader: { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginTop: 10 },
  visitItem: { backgroundColor: '#222228', padding: 12, borderRadius: 12, marginBottom: 8 },
  expenseItem: {
    backgroundColor: '#222228',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemTitle: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  itemSub: { color: '#888', fontSize: 12, marginTop: 2 },
  expenseAmount: { color: '#FF2366', fontSize: 16, fontWeight: 'bold' },
  summaryCard: { backgroundColor: '#2D1B28', padding: 15, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: '#FF2366' },
  summaryTitle: { color: '#AAA', fontSize: 12, textTransform: 'uppercase' },
  totalAmount: { color: '#FFF', fontSize: 28, fontWeight: 'bold', marginVertical: 5 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#333' },
  sumLbl: { color: '#888', fontSize: 11 },
  sumVal: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },
  emptyText: { color: '#888', fontStyle: 'italic' },
});
