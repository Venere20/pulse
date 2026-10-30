import React from 'react';
import { FlatList, ListRenderItem, View, useWindowDimensions } from 'react-native';
import { Screen } from './layout';
import { useTheme } from '../theme/ThemeProvider';
import { SaveFeedback } from '../features/saving/SaveFeedback';

/** One root scroll surface: do not nest a virtual list inside Screen's ScrollView.
 * Metadata stays with the caller; only the viewport and nearby rows are mounted.
 * Variable card heights are measured rather than guessed with getItemLayout. */
export interface ListScreenProps<T> {
  header: React.ReactNode;
  items: readonly T[];
  renderItem: ListRenderItem<T>;
  keyExtractor: (item: T, index: number) => string;
  columns?: number;
  before?: React.ReactNode;
  after?: React.ReactNode;
  empty?: React.ReactNode;
  extraData?: unknown;
  label: string;
}
export function ListScreen<T>({ header, items, renderItem, keyExtractor, columns = 1,
  before, after, empty, extraData, label,
}: ListScreenProps<T>) {
  const { s } = useTheme();
  const { width } = useWindowDimensions();
  const side = Math.max(0, (width - 720) / 2);
  return <Screen scroll={false} header={header} showSaveFeedback={false}
    contentStyle={{ padding: 0, paddingHorizontal: 0, paddingBottom: 0, gap: 0 }}>
    <FlatList
      key={columns}
      accessibilityLabel={label}
      style={{ flex: 1 }}
      data={items}
      extraData={extraData}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      numColumns={columns}
      columnWrapperStyle={columns > 1 ? { gap: s.lg } : undefined}
      contentContainerStyle={{ padding: s.lg, paddingHorizontal: s.lg + side, paddingBottom: 120 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      initialNumToRender={6}
      maxToRenderPerBatch={6}
      windowSize={5}
      removeClippedSubviews={false}
      ItemSeparatorComponent={() => <View style={{ height: s.lg }} />}
      ListHeaderComponent={<View style={{ gap: s.lg, paddingBottom: s.lg }}><SaveFeedback />{before}</View>}
      ListFooterComponent={after ? <View style={{ paddingTop: s.lg }}>{after}</View> : null}
      ListEmptyComponent={empty ? <View>{empty}</View> : null}
    />
  </Screen>;
}
