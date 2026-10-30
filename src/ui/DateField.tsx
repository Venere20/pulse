import React, { useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { romeDay } from '../utils/together';
import { clampPickerDate, DATE_PICKER_MAX, DATE_PICKER_MIN, formatPickerDate, movePickerMonth, pickerMonthCells, validPickerDate } from '../utils/datePicker';
import { BottomSheet } from './layout';
import { Button, T } from './primitives';
import { Icon } from './Icon';

const MONTHS = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
export function DateField({ label, value, onChange, minDate = DATE_PICKER_MIN, maxDate = DATE_PICKER_MAX, disabled = false }: {
  label: string; value: string; onChange: (day: string) => void; minDate?: string; maxDate?: string; disabled?: boolean;
}) {
  const { c, r, s } = useTheme();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [month, setMonth] = useState('2000-01');
  const [panel, setPanel] = useState<'days' | 'months' | 'years'>('days');
  const [yearPage, setYearPage] = useState(2000);
  const min = validPickerDate(minDate) ? minDate : DATE_PICKER_MIN;
  const max = validPickerDate(maxDate) && maxDate >= min ? maxDate : DATE_PICKER_MAX;
  const year = Number(month.slice(0, 4));
  const openPicker = () => {
    const day = clampPickerDate(validPickerDate(value) ? value : romeDay(Date.now()), min, max);
    setDraft(day); setMonth(day.slice(0, 7)); setYearPage(Number(day.slice(0, 4)) - 5); setPanel('days'); setOpen(true);
  };
  const choose = (text: string, onPress: () => void, selected = false, blocked = false, key?: string) => <TouchableOpacity key={key} accessibilityRole="button" accessibilityLabel={text === '‹' ? panel === 'years' ? 'Anni precedenti' : 'Mese precedente' : text === '›' ? panel === 'years' ? 'Anni successivi' : 'Mese successivo' : text} accessibilityState={{ selected, disabled: blocked }} disabled={blocked} onPress={onPress}
    style={{ flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', padding: 3, borderRadius: r.sm, backgroundColor: selected ? c.primarySoft : 'transparent', opacity: blocked ? 0.3 : 1 }}>
    <T v="caption" tone={selected ? 'primary' : 'default'} bold={selected} style={{ textAlign: 'center' }}>{text}</T>
  </TouchableOpacity>;
  return <View style={{ gap: 6 }}>
    <T v="caption" bold>{label}</T>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={label} accessibilityHint="Apri il calendario per scegliere la data" accessibilityValue={{ text: formatPickerDate(value) }} accessibilityState={{ disabled }} disabled={disabled} onPress={openPicker}
      style={{ minHeight: 48, borderRadius: r.md, backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.border, padding: s.md, flexDirection: 'row', alignItems: 'center', gap: s.sm, opacity: disabled ? 0.5 : 1 }}>
      <Icon name="calendar" size={20} color={c.primary} /><T style={{ flex: 1 }}>{formatPickerDate(value)}</T><Icon name="chevronDown" size={16} color={c.textMuted} />
    </TouchableOpacity>
    <BottomSheet visible={open} title={`Scegli ${label.toLowerCase()}`} onClose={() => setOpen(false)} footer={<><Button label="Conferma data" disabled={!draft || draft < min || draft > max} onPress={() => { onChange(draft); setOpen(false); }} /><Button label="Annulla" variant="ghost" onPress={() => setOpen(false)} /></>}>
      <View style={{ width: '100%', maxWidth: 420, alignSelf: 'center', gap: 8 }}>
        <T tone="primary" style={{ textAlign: 'center' }}>{formatPickerDate(draft)}</T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          {choose('‹', () => panel === 'years' ? setYearPage(yearPage - 12) : setMonth(movePickerMonth(month, -1)), false, panel === 'years' ? yearPage <= Number(min.slice(0, 4)) : month <= min.slice(0, 7), 'prev')}
          {choose(MONTHS[Number(month.slice(5)) - 1], () => setPanel(panel === 'months' ? 'days' : 'months'), false, false, 'month')}
          {choose(String(year), () => { setYearPage(year - 5); setPanel(panel === 'years' ? 'days' : 'years'); }, false, false, 'year')}
          {choose('›', () => panel === 'years' ? setYearPage(yearPage + 12) : setMonth(movePickerMonth(month, 1)), false, panel === 'years' ? yearPage + 11 >= Number(max.slice(0, 4)) : month >= max.slice(0, 7), 'next')}
        </View>
        {panel === 'days' ? <>
          <View style={{ flexDirection: 'row' }}>{['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map(day => <View key={day} style={{ flex: 1, alignItems: 'center' }}><T v="caption" tone="muted">{day}</T></View>)}</View>
          {pickerMonthCells(month).map((week, wi) => <View key={wi} style={{ flexDirection: 'row' }}>{week.map((day, di) => day ? <TouchableOpacity key={day} accessibilityRole="button" accessibilityLabel={formatPickerDate(day)} accessibilityState={{ selected: day === draft, disabled: day < min || day > max }} disabled={day < min || day > max} onPress={() => setDraft(day)}
            style={{ flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: r.sm, backgroundColor: day === draft ? c.primarySoft : 'transparent', opacity: day < min || day > max ? 0.3 : 1 }}><T tone={day === draft ? 'primary' : 'default'} bold={day === draft}>{Number(day.slice(8))}</T></TouchableOpacity> : <View key={di} style={{ flex: 1, minHeight: 44 }} />)}</View>)}
        </> : Array.from({ length: 4 }, (_, row) => <View key={row} style={{ flexDirection: 'row', gap: 4 }}>{Array.from({ length: 3 }, (_, col) => {
          const n = row * 3 + col;
          if (panel === 'years') { const y = yearPage + n; return choose(String(y), () => { setMonth(`${y}-${month.slice(5)}`); setPanel('months'); }, y === year, y < Number(min.slice(0, 4)) || y > Number(max.slice(0, 4)), String(y)); }
          const m = `${year}-${String(n + 1).padStart(2, '0')}`;
          return choose(MONTHS[n], () => { setMonth(m); setPanel('days'); }, m === month, m < min.slice(0, 7) || m > max.slice(0, 7), m);
        })}</View>)}
        <Button label="Vai a oggi" variant="ghost" onPress={() => { const day = clampPickerDate(romeDay(Date.now()), min, max); setDraft(day); setMonth(day.slice(0, 7)); setPanel('days'); }} />
      </View>
    </BottomSheet>
  </View>;
}
