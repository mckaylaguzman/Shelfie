import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BookDetailModal from '@/components/BookDetailModal';
import BookForm from '@/components/BookForm';
import { ScreenContainer, screenScrollContentStyle, useScreenLayout } from '@/components/ScreenContainer';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { isLargeTabletLayout, isTabletLayout } from '@/constants/cozy-theme';
import { Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getAllBooks } from '@/src/services/storage';
import type { Book } from '@/src/types/book';
import { palette, radii, type ColorScheme, type ThemeColors } from '@/utils/theme';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const COVER_ASPECT = 1.5;

type MonthBucket = {
  monthIndex: number;
  label: string;
  books: Book[];
};

type ChartMetrics = {
  monthLabelWidth: number;
  monthLabelSize: number;
  rowGap: number;
  chartGap: number;
  barRadius: number;
  barPadding: number;
  coverWidth: number;
  coverHeight: number;
  coverGap: number;
  coverRadius: number;
  barHeight: number;
  emptyBarWidth: number;
  emptyBarHeight: number;
  finishedLabelSize: number;
  countSize: number;
  countLineHeight: number;
  subtitleSize: number;
  headerMarginBottom: number;
};

function mutedBarFill(colorScheme: ColorScheme) {
  return colorScheme === 'light' ? 'rgba(193, 123, 90, 0.32)' : 'rgba(212, 146, 111, 0.38)';
}

function emptyBarFill(colorScheme: ColorScheme) {
  return colorScheme === 'light' ? 'rgba(193, 123, 90, 0.12)' : 'rgba(212, 146, 111, 0.16)';
}

function getBaseMetrics(isTablet: boolean, isLargeTablet: boolean): ChartMetrics {
  if (isLargeTablet) {
    return {
      monthLabelWidth: 56,
      monthLabelSize: 20,
      rowGap: 18,
      chartGap: 16,
      barRadius: 18,
      barPadding: 12,
      coverWidth: 84,
      coverHeight: 126,
      coverGap: 5,
      coverRadius: 8,
      barHeight: 150,
      emptyBarWidth: 48,
      emptyBarHeight: 56,
      finishedLabelSize: 22,
      countSize: 148,
      countLineHeight: 156,
      subtitleSize: 22,
      headerMarginBottom: 52,
    };
  }

  if (isTablet) {
    return {
      monthLabelWidth: 52,
      monthLabelSize: 18,
      rowGap: 16,
      chartGap: 14,
      barRadius: 16,
      barPadding: 10,
      coverWidth: 72,
      coverHeight: 108,
      coverGap: 4,
      coverRadius: 7,
      barHeight: 128,
      emptyBarWidth: 42,
      emptyBarHeight: 48,
      finishedLabelSize: 20,
      countSize: 128,
      countLineHeight: 136,
      subtitleSize: 20,
      headerMarginBottom: 48,
    };
  }

  return {
    monthLabelWidth: 36,
    monthLabelSize: 14,
    rowGap: 10,
    chartGap: 10,
    barRadius: 12,
    barPadding: 6,
    coverWidth: 44,
    coverHeight: 66,
    coverGap: 2,
    coverRadius: 5,
    barHeight: 78,
    emptyBarWidth: 24,
    emptyBarHeight: 32,
    finishedLabelSize: 16,
    countSize: 72,
    countLineHeight: 80,
    subtitleSize: 16,
    headerMarginBottom: 28,
  };
}

function scaleMetricsToFit(base: ChartMetrics, columnWidth: number, maxBooksInMonth: number): ChartMetrics {
  if (maxBooksInMonth <= 0) {
    return base;
  }

  const available =
    columnWidth - base.monthLabelWidth - base.rowGap - base.barPadding * 2;
  const naturalCluster =
    maxBooksInMonth * base.coverWidth + (maxBooksInMonth - 1) * base.coverGap;

  if (naturalCluster <= available || available <= 0) {
    return base;
  }

  const scale = available / naturalCluster;
  const coverWidth = Math.max(28, Math.floor(base.coverWidth * scale));
  const coverHeight = Math.round(coverWidth * COVER_ASPECT);
  const coverGap = Math.max(1, Math.round(base.coverGap * scale));
  const barPadding = Math.max(4, Math.round(base.barPadding * scale));

  return {
    ...base,
    coverWidth,
    coverHeight,
    coverGap,
    barPadding,
    barHeight: coverHeight + barPadding * 2,
    coverRadius: Math.max(4, Math.round(base.coverRadius * scale)),
  };
}

function groupFinishedByMonth(books: Book[], year: number): MonthBucket[] {
  const buckets: MonthBucket[] = MONTH_LABELS.map((label, monthIndex) => ({
    monthIndex,
    label,
    books: [],
  }));

  for (const book of books) {
    if (book.status !== 'finished' || !book.dateFinished) {
      continue;
    }

    const date = new Date(book.dateFinished);
    if (Number.isNaN(date.getTime()) || date.getFullYear() !== year) {
      continue;
    }

    buckets[date.getMonth()].books.push(book);
  }

  for (const bucket of buckets) {
    bucket.books.sort((a, b) => a.dateFinished.localeCompare(b.dateFinished));
  }

  return buckets;
}

function coversClusterWidth(count: number, metrics: ChartMetrics) {
  if (count <= 0) {
    return 0;
  }
  return count * metrics.coverWidth + (count - 1) * metrics.coverGap;
}

function CoverThumb({
  book,
  metrics,
  colors,
  onPress,
}: {
  book: Book;
  metrics: ChartMetrics;
  colors: ThemeColors;
  onPress: (book: Book) => void;
}) {
  return (
    <Pressable
      onPress={() => onPress(book)}
      accessibilityRole="button"
      accessibilityLabel={`Open ${book.title}`}
      style={({ pressed }) => [pressed && styles.pressed]}>
      {book.coverImageUri ? (
        <Image
          source={{ uri: book.coverImageUri }}
          style={{
            width: metrics.coverWidth,
            height: metrics.coverHeight,
            borderRadius: metrics.coverRadius,
          }}
          contentFit="cover"
        />
      ) : (
        <View
          style={[
            styles.coverFallback,
            {
              width: metrics.coverWidth,
              height: metrics.coverHeight,
              borderRadius: metrics.coverRadius,
              backgroundColor: colors.input,
              borderColor: colors.border,
            },
          ]}>
          <Ionicons
            name="book-outline"
            size={Math.max(12, Math.round(metrics.coverWidth * 0.32))}
            color={colors.textSecondary}
          />
        </View>
      )}
    </Pressable>
  );
}

function MonthRow({
  bucket,
  metrics,
  colors,
  colorScheme,
  onPressBook,
}: {
  bucket: MonthBucket;
  metrics: ChartMetrics;
  colors: ThemeColors;
  colorScheme: ColorScheme;
  onPressBook: (book: Book) => void;
}) {
  const count = bucket.books.length;
  const barFill = mutedBarFill(colorScheme);

  if (count === 0) {
    return (
      <View style={[styles.monthRow, { gap: metrics.rowGap }]}>
        <ThemedText
          style={[
            styles.monthLabel,
            {
              width: metrics.monthLabelWidth,
              fontSize: metrics.monthLabelSize,
              lineHeight: metrics.monthLabelSize + 4,
              color: colors.placeholder,
              fontFamily: Fonts.rounded,
            },
          ]}
          numberOfLines={1}>
          {bucket.label}
        </ThemedText>
        <View
          style={[
            styles.bar,
            {
              width: metrics.emptyBarWidth,
              height: metrics.emptyBarHeight,
              borderRadius: metrics.barRadius,
              backgroundColor: emptyBarFill(colorScheme),
            },
          ]}
        />
      </View>
    );
  }

  const barWidth = coversClusterWidth(count, metrics) + metrics.barPadding * 2;

  return (
    <View style={[styles.monthRow, { gap: metrics.rowGap }]}>
      <ThemedText
        style={[
          styles.monthLabel,
          {
            width: metrics.monthLabelWidth,
            fontSize: metrics.monthLabelSize,
            lineHeight: metrics.monthLabelSize + 4,
            color: colors.textSecondary,
            fontFamily: Fonts.rounded,
          },
        ]}
        numberOfLines={1}>
        {bucket.label}
      </ThemedText>

      <View
        style={[
          styles.bar,
          {
            width: barWidth,
            height: metrics.barHeight,
            borderRadius: metrics.barRadius,
            backgroundColor: barFill,
            padding: metrics.barPadding,
          },
        ]}>
        <View style={[styles.coverRow, { gap: metrics.coverGap }]}>
          {bucket.books.map((book) => (
            <CoverThumb
              key={book.id}
              book={book}
              metrics={metrics}
              colors={colors}
              onPress={onPressBook}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

export default function YearReviewScreen() {
  const colorScheme = (useColorScheme() ?? 'light') as ColorScheme;
  const colors = palette[colorScheme];
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isPad = Platform.OS === 'ios' && Platform.isPad;
  const layoutOptions = useMemo(() => ({ isPad }), [isPad]);
  const isTablet = isTabletLayout(width, layoutOptions);
  const isLargeTablet = isLargeTabletLayout(width, layoutOptions);
  const { columnWidth } = useScreenLayout();

  const year = new Date().getFullYear();

  const [books, setBooks] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [markingFinishedBook, setMarkingFinishedBook] = useState<Book | null>(null);

  const loadBooks = useCallback(async () => {
    setIsLoading(true);
    try {
      const next = await getAllBooks();
      setBooks(next);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadBooks();
    }, [loadBooks]),
  );

  const months = useMemo(() => groupFinishedByMonth(books, year), [books, year]);
  const yearFinishedCount = useMemo(
    () => months.reduce((sum, month) => sum + month.books.length, 0),
    [months],
  );
  const maxBooksInMonth = useMemo(
    () => Math.max(0, ...months.map((month) => month.books.length)),
    [months],
  );

  const metrics = useMemo(() => {
    const base = getBaseMetrics(isTablet, isLargeTablet);
    return scaleMetricsToFit(base, columnWidth, maxBooksInMonth);
  }, [isTablet, isLargeTablet, columnWidth, maxBooksInMonth]);

  const handleBookSaved = async () => {
    setEditingBook(null);
    setMarkingFinishedBook(null);
    setSelectedBook(null);
    await loadBooks();
  };

  const handleBookDeleted = async () => {
    setSelectedBook(null);
    await loadBooks();
  };

  const handleDetailUpdated = async () => {
    setSelectedBook(null);
    await loadBooks();
  };

  const handleEditBook = (book: Book) => {
    setSelectedBook(null);
    setMarkingFinishedBook(null);
    setEditingBook(book);
  };

  const handleMarkFinished = (book: Book) => {
    setSelectedBook(null);
    setEditingBook(null);
    setMarkingFinishedBook(book);
  };

  const showFormModal = !!editingBook || !!markingFinishedBook;
  const formBook = markingFinishedBook ?? editingBook ?? undefined;

  return (
    <ThemedView style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          screenScrollContentStyle,
          {
            paddingTop: insets.top + (isTablet ? 20 : 16),
            paddingBottom: insets.bottom + 32,
          },
        ]}
        showsVerticalScrollIndicator={false}>
        <ScreenContainer>
          <View style={styles.navRow}>
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              style={({ pressed }) => [styles.navButton, pressed && styles.pressed]}>
              <Ionicons name="chevron-back" size={isTablet ? 34 : 30} color={colors.textSecondary} />
            </Pressable>
          </View>

          <View style={[styles.headerBlock, { marginBottom: metrics.headerMarginBottom }]}>
            <ThemedText
              style={{
                fontSize: metrics.finishedLabelSize,
                lineHeight: metrics.finishedLabelSize + 6,
                fontWeight: '500',
                color: colors.textSecondary,
                fontFamily: Fonts.rounded,
              }}>
              Finished
            </ThemedText>
            <ThemedText
              style={{
                fontSize: metrics.countSize,
                lineHeight: metrics.countLineHeight,
                fontWeight: '700',
                letterSpacing: isTablet ? -3 : -2,
                color: colors.primary,
                fontFamily: Fonts.serif,
              }}>
              {isLoading ? '—' : yearFinishedCount}
            </ThemedText>
            <ThemedText
              style={{
                fontSize: metrics.subtitleSize,
                lineHeight: metrics.subtitleSize + 7,
                marginTop: 2,
                color: colors.textSecondary,
              }}>
              books so far this year
            </ThemedText>
          </View>

          {isLoading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : yearFinishedCount === 0 ? (
            <View style={[styles.emptyState, isTablet && styles.emptyStateTablet]}>
              <ThemedText
                style={[
                  styles.emptyTitle,
                  isTablet && styles.emptyTitleTablet,
                  { color: colors.text, fontFamily: Fonts.serif },
                ]}>
                Your reading year starts with one book
              </ThemedText>
              <ThemedText
                style={[
                  styles.emptySubtitle,
                  isTablet && styles.emptySubtitleTablet,
                  { color: colors.textSecondary },
                ]}>
                Finish a book on your shelf to begin filling this year.
              </ThemedText>
              <Pressable
                onPress={() => router.back()}
                accessibilityRole="button"
                accessibilityLabel="Back to shelf"
                style={({ pressed }) => [
                  styles.emptyButton,
                  { backgroundColor: colors.primary },
                  pressed && { backgroundColor: colors.primaryPressed },
                ]}>
                <ThemedText style={[styles.emptyButtonText, { color: colors.onPrimary, fontFamily: Fonts.rounded }]}>
                  Back to shelf
                </ThemedText>
              </Pressable>
            </View>
          ) : (
            <View style={[styles.chart, { gap: metrics.chartGap }]}>
              {months.map((bucket) => (
                <MonthRow
                  key={bucket.monthIndex}
                  bucket={bucket}
                  metrics={metrics}
                  colors={colors}
                  colorScheme={colorScheme}
                  onPressBook={setSelectedBook}
                />
              ))}
            </View>
          )}
        </ScreenContainer>
      </ScrollView>

      <BookDetailModal
        book={selectedBook}
        visible={!!selectedBook}
        onClose={() => setSelectedBook(null)}
        onEdit={handleEditBook}
        onMarkFinished={handleMarkFinished}
        onDeleted={handleBookDeleted}
        onBookUpdated={handleDetailUpdated}
      />

      <Modal
        visible={showFormModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setEditingBook(null);
          setMarkingFinishedBook(null);
        }}>
        <BookForm
          book={formBook}
          markFinished={!!markingFinishedBook}
          onSaved={handleBookSaved}
          onCancel={() => {
            setEditingBook(null);
            setMarkingFinishedBook(null);
          }}
        />
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  navButton: {
    padding: 4,
    marginLeft: -4,
  },
  headerBlock: {
    alignItems: 'flex-start',
    gap: 4,
  },
  chart: {
    width: '100%',
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  monthLabel: {
    fontWeight: '600',
  },
  bar: {
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  coverRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  coverFallback: {
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingState: {
    paddingVertical: 64,
    alignItems: 'center',
  },
  emptyState: {
    paddingTop: 24,
    gap: 12,
    maxWidth: 360,
  },
  emptyStateTablet: {
    maxWidth: 440,
    paddingTop: 32,
  },
  emptyTitle: {
    fontSize: 24,
    lineHeight: 32,
  },
  emptyTitleTablet: {
    fontSize: 28,
    lineHeight: 36,
  },
  emptySubtitle: {
    fontSize: 16,
    lineHeight: 24,
  },
  emptySubtitleTablet: {
    fontSize: 17,
    lineHeight: 26,
  },
  emptyButton: {
    alignSelf: 'flex-start',
    marginTop: 8,
    borderRadius: radii.button,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.85,
  },
});
