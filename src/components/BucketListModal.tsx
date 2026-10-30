import { trackResult } from '../services/saveState';
import React, { useState, useEffect } from 'react';
import { useDraftField } from '../features/drafts/useDraftField';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { supabase } from '../config/supabase';
import { BucketItem, BucketCategory, CATEGORIES } from '../types/bucket';

interface Props {
  visible: boolean;
  userId: string;
  onClose: () => void;
}

export const BucketListModal: React.FC<Props> = ({ visible, userId, onClose }) => {
  const [items, setItems] = useState<BucketItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [newTitle, setNewTitle] = useDraftField('bucket', 'title', '');
  const [selectedCategory, setSelectedCategory] = useDraftField<BucketCategory>('bucket', 'category', 'place');
  const [activeFilter, setActiveFilter] = useState<BucketCategory | 'all'>('all');



  const fetchItems = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('bucket_list')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) setItems(data);
    setLoading(false);
  };
  useEffect(() => {
    if (visible) {
      const initial=setTimeout(()=>{void fetchItems();},0);
      return()=>clearTimeout(initial);
    }
  }, [visible]);

  const addItem = async () => {
    if (!newTitle.trim()) return;

    const newItem = {
      title: newTitle.trim(),
      category: selectedCategory,
      is_completed: false,
      created_by: userId,
    };

    const { data, error } = await trackResult(() => supabase
      .from('bucket_list')
      .insert([newItem])
      .select());

    if (!error && data) {
      setItems([data[0], ...items]);
      setNewTitle('');
    }
  };

  const toggleItem = async (item: BucketItem) => {
    const updatedStatus = !item.is_completed;
    setItems(items.map((i) => (i.id === item.id ? { ...i, is_completed: updatedStatus } : i)));

    await trackResult(() => supabase
      .from('bucket_list')
      .update({ is_completed: updatedStatus })
      .eq('id', item.id));
  };

  const filteredItems = items.filter((i) =>
    activeFilter === 'all' ? true : i.category === activeFilter
  );

  const getCategoryEmoji = (category: BucketCategory) =>
    CATEGORIES.find((c) => c.id === category)?.emoji || '📌';

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>✨ I nostri desideri</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeTxt}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Form per aggiungere desideri */}
          <View style={styles.addForm}>
            <TextInput
              style={styles.input}
              placeholder="Es. Cena a lume di candela, viaggio a Parigi…"
              placeholderTextColor="#666"
              value={newTitle}
              onChangeText={setNewTitle}
            />
            <View style={styles.categoryRow}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.catBadge,
                    selectedCategory === cat.id && styles.catBadgeSelected,
                  ]}
                  onPress={() => setSelectedCategory(cat.id)}
                >
                  <Text style={styles.catText}>
                    {cat.emoji} {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.addBtn} onPress={addItem}>
              <Text style={styles.addBtnText}>+ Aggiungi alla lista</Text>
            </TouchableOpacity>
          </View>

          {/* Filtri */}
          <View style={styles.filterBar}>
            <TouchableOpacity
              style={[styles.filterChip, activeFilter === 'all' && styles.filterActive]}
              onPress={() => setActiveFilter('all')}
            >
              <Text style={styles.filterText}>Tutti</Text>
            </TouchableOpacity>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[styles.filterChip, activeFilter === cat.id && styles.filterActive]}
                onPress={() => setActiveFilter(cat.id)}
              >
                <Text style={styles.filterText}>{cat.emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Lista Elementi */}
          {loading ? (
            <ActivityIndicator size="large" color="#FF2366" style={{ marginVertical: 30 }} />
          ) : (
            <FlatList
              data={filteredItems}
              keyExtractor={(item) => item.id}
              style={styles.list}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.itemCard, item.is_completed && styles.completedCard]}
                  onPress={() => toggleItem(item)}
                >
                  <Text style={styles.checkbox}>{item.is_completed ? '✅' : '⚪'}</Text>
                  <Text
                    style={[styles.itemTitle, item.is_completed && styles.completedText]}
                  >
                    {item.title}
                  </Text>
                  <Text style={styles.itemEmoji}>{getCategoryEmoji(item.category)}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>Nessun desiderio salvato in questa categoria.</Text>
              }
            />
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#18181C',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  title: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  closeBtn: { padding: 5 },
  closeTxt: { color: '#888', fontSize: 18, fontWeight: 'bold' },
  addForm: {
    backgroundColor: '#222228',
    borderRadius: 16,
    padding: 12,
    marginBottom: 15,
  },
  input: {
    backgroundColor: '#141417',
    color: '#FFF',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    fontSize: 14,
  },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  catBadge: {
    backgroundColor: '#2D2D35',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  catBadgeSelected: { backgroundColor: '#FF2366' },
  catText: { color: '#FFF', fontSize: 12 },
  addBtn: {
    backgroundColor: '#FF2366',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  addBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 13 },
  filterBar: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  filterChip: {
    backgroundColor: '#222228',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 15,
  },
  filterActive: { backgroundColor: '#FF2366' },
  filterText: { color: '#FFF', fontSize: 12 },
  list: { marginBottom: 10 },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222228',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  completedCard: { opacity: 0.5 },
  checkbox: { fontSize: 18, marginRight: 10 },
  itemTitle: { flex: 1, color: '#FFF', fontSize: 14, fontWeight: '500' },
  completedText: { textDecorationLine: 'line-through', color: '#AAA' },
  itemEmoji: { fontSize: 16 },
  emptyText: { color: '#666', textAlign: 'center', marginVertical: 20, fontStyle: 'italic' },
});
