import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  LayoutChangeEvent,
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
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  getHomeContentWidth,
  isLargeTabletLayout,
  isTabletLayout,
} from '@/constants/cozy-theme';
import { Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getAllBooks, type Book, type BookFormat } from '@/utils/storage';
import {
  cardShadow,
  cardStyle,
  fabShadow,
  palette,
  radii,
  type ColorScheme,
  type ThemeColors,
} from '@/utils/theme';

function StarRow({
  rating,
  size,
  colors,
}: {
  rating: number;
  size: number;
  colors: ThemeColors;
}) {
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((value) => (
        <Ionicons
          key={value}
          name={value <= rating ? 'star' : 'star-outline'}
          size={size}
          color={value <= rating ? colors.star : colors.starEmpty}
        />
      ))}
    </View>
  );
}

function CoverImage({
  book,
  width,
  colors,
  borderRadius = 12,
}: {
  book: Book;
  width: number;
  colors: ThemeColors;
  borderRadius?: number;
}) {
  const height = width * 1.5;

  if (book.coverImageUri) {
    return (
      <Image
        source={{ uri: book.coverImageUri }}
        style={{ width, height, borderRadius }}
        contentFit="cover"
      />
    );
  }

  return (
    <View
      style={[
        styles.coverFallback,
        {
          width,
          height,
          borderRadius,
          backgroundColor: colors.input,
          borderColor: colors.border,
        },
      ]}>
      <Ionicons name="book-outline" size={width * 0.28} color={colors.textSecondary} />
    </View>
  );
}

type FinishedFilter = 'all' | 'recent' | 'rating' | 'format';

function FilterChip({
  label,
  selected,
  onPress,
  colors,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  colors: ThemeColors;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.filterChip,
        {
          backgroundColor: selected ? colors.primary : colors.input,
          borderColor: selected ? colors.primary : colors.border,
        },
        pressed && styles.pressed,
      ]}>
      <ThemedText
        style={[
          styles.filterChipText,
          { color: selected ? colors.onPrimary : colors.text, fontFamily: Fonts.rounded },
        ]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function FinishedSectionHeader({
  colors,
  activeFilter,
  formatFilter,
  onSelectFilter,
  onSelectFormat,
}: {
  colors: ThemeColors;
  activeFilter: FinishedFilter;
  formatFilter: BookFormat;
  onSelectFilter: (filter: FinishedFilter) => void;
  onSelectFormat: (format: BookFormat) => void;
}) {
  return (
    <View style={styles.finishedSectionHeader}>
      <ThemedText style={[styles.sectionTitle, { color: colors.text, fontFamily: Fonts.serif }]}>
        Finished
      </ThemedText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterChipRow}>
        <FilterChip
          label="All"
          selected={activeFilter === 'all'}
          onPress={() => onSelectFilter('all')}
          colors={colors}
        />
        <FilterChip
          label="Rating"
          selected={activeFilter === 'rating'}
          onPress={() => onSelectFilter('rating')}
          colors={colors}
        />
        <FilterChip
          label="Recent"
          selected={activeFilter === 'recent'}
          onPress={() => onSelectFilter('recent')}
          colors={colors}
        />
        <FilterChip
          label="Format"
          selected={activeFilter === 'format'}
          onPress={() => onSelectFilter('format')}
          colors={colors}
        />
      </ScrollView>
      {activeFilter === 'format' && (
        <View style={styles.formatChipRow}>
          <FilterChip
            label="Physical"
            selected={formatFilter === 'physical'}
            onPress={() => onSelectFormat('physical')}
            colors={colors}
          />
          <FilterChip
            label="Audiobook"
            selected={formatFilter === 'audiobook'}
            onPress={() => onSelectFormat('audiobook')}
            colors={colors}
          />
        </View>
      )}
    </View>
  );
}

function sortFinishedBooks(books: Book[], filter: FinishedFilter) {
  const sorted = [...books];

  if (filter === 'rating') {
    sorted.sort(
      (a, b) =>
        b.rating - a.rating ||
        b.dateFinished.localeCompare(a.dateFinished) ||
        b.id - a.id,
    );
    return sorted;
  }

  sorted.sort(
    (a, b) => b.dateFinished.localeCompare(a.dateFinished) || b.id - a.id,
  );
  return sorted;
}

function filterFinishedBooks(books: Book[], filter: FinishedFilter, formatFilter: BookFormat) {
  if (filter === 'format') {
    return books.filter((book) => book.format === formatFilter);
  }

  return books;
}

function SectionHeader({ title, colors }: { title: string; colors: ThemeColors }) {
  return (
    <ThemedText style={[styles.sectionTitle, { color: colors.text, fontFamily: Fonts.serif }]}>
      {title}
    </ThemedText>
  );
}

function HorizontalBookTile({
  book,
  coverWidth,
  colors,
  onPress,
}: {
  book: Book;
  coverWidth: number;
  colors: ThemeColors;
  onPress: (book: Book) => void;
}) {
  return (
    <Pressable
      onPress={() => onPress(book)}
      accessibilityRole="button"
      accessibilityLabel={`Open ${book.title} by ${book.author}`}
      style={({ pressed }) => [styles.carouselItem, { width: coverWidth }, pressed && styles.pressed]}>
      <CoverImage book={book} width={coverWidth} colors={colors} borderRadius={radii.input} />
      <ThemedText
        numberOfLines={2}
        style={[styles.carouselTitle, { color: colors.text, fontFamily: Fonts.serif }]}>
        {book.title}
      </ThemedText>
      <ThemedText numberOfLines={1} style={[styles.carouselAuthor, { color: colors.textSecondary }]}>
        {book.author}
      </ThemedText>
    </Pressable>
  );
}

function HorizontalBookRow({
  books,
  coverWidth,
  colors,
  onPressBook,
}: {
  books: Book[];
  coverWidth: number;
  colors: ThemeColors;
  onPressBook: (book: Book) => void;
}) {
  return (
    <FlatList
      horizontal
      data={books}
      keyExtractor={(item) => String(item.id)}
      showsHorizontalScrollIndicator={false}
      nestedScrollEnabled
      directionalLockEnabled
      style={styles.carouselScroll}
      contentContainerStyle={styles.carouselContent}
      renderItem={({ item }) => (
        <HorizontalBookTile
          book={item}
          coverWidth={coverWidth}
          colors={colors}
          onPress={onPressBook}
        />
      )}
    />
  );
}

function FinishedListCard({
  book,
  coverWidth,
  colors,
  colorScheme,
  compact = false,
  onPress,
}: {
  book: Book;
  coverWidth: number;
  colors: ThemeColors;
  colorScheme: ColorScheme;
  compact?: boolean;
  onPress: (book: Book) => void;
}) {
  const reviewSnippet = book.review.trim() || 'No review written yet.';
  const coverHeight = coverWidth * 1.5;

  return (
    <Pressable
      onPress={() => onPress(book)}
      accessibilityRole="button"
      accessibilityLabel={`Open ${book.title} by ${book.author}`}
      style={({ pressed }) => [styles.finishedWrap, pressed && styles.pressed]}>
      <View
        style={[
          styles.floatingCover,
          cardShadow(colorScheme),
          { marginRight: -coverWidth * 0.28 },
        ]}>
        <CoverImage book={book} width={coverWidth} colors={colors} borderRadius={radii.input} />
      </View>

      <View
        style={[
          styles.finishedCard,
          cardStyle(colorScheme),
          compact && styles.finishedCardCompact,
          {
            flex: 1,
            minWidth: 0,
            minHeight: coverHeight - (compact ? 16 : 14),
            paddingLeft: coverWidth * 0.48,
          },
        ]}>
        <View style={styles.finishedBody}>
          <View style={styles.finishedTitleRow}>
            {book.format === 'audiobook' && (
              <Ionicons
                name="headset-outline"
                size={compact ? 14 : 15}
                color={colors.textSecondary}
                style={styles.finishedFormatIcon}
              />
            )}
            <ThemedText
              numberOfLines={2}
              style={[
                styles.finishedTitleText,
                compact ? styles.finishedTitleCompact : styles.finishedTitle,
                { color: colors.text, fontFamily: Fonts.serif },
              ]}>
              {book.title}
            </ThemedText>
          </View>
          <ThemedText
            numberOfLines={1}
            style={[
              compact ? styles.finishedAuthorCompact : styles.finishedAuthor,
              { color: colors.textSecondary },
            ]}>
            {book.author}
          </ThemedText>
          <StarRow rating={book.rating} size={compact ? 13 : 14} colors={colors} />
          <ThemedText
            numberOfLines={2}
            style={[
              compact ? styles.finishedReviewCompact : styles.finishedReview,
              { color: colors.textSecondary },
            ]}>
            {reviewSnippet}
          </ThemedText>
        </View>
      </View>
    </Pressable>
  );
}

function FinishedBooksGrid({
  books,
  isTablet,
  colors,
  colorScheme,
  onPressBook,
}: {
  books: Book[];
  isTablet: boolean;
  colors: ThemeColors;
  colorScheme: ColorScheme;
  onPressBook: (book: Book) => void;
}) {
  const [gridWidth, setGridWidth] = useState(0);
  const gridGap = 16;
  const columns = isTablet || books.length >= 2 ? 2 : 1;

  const handleGridLayout = useCallback((event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;
    if (nextWidth > 0) {
      setGridWidth(nextWidth);
    }
  }, []);

  const itemWidth =
    gridWidth > 0 ? (gridWidth - gridGap * (columns - 1)) / columns : undefined;
  const coverWidth =
    itemWidth !== undefined ? Math.round(itemWidth * 0.38) : columns === 2 ? 88 : 72;

  return (
    <View
      onLayout={handleGridLayout}
      style={[styles.finishedList, gridWidth > 0 && { gap: gridGap }]}>
      {books.map((book) => (
        <View
          key={book.id}
          style={
            itemWidth !== undefined
              ? { width: itemWidth, flexShrink: 0, flexGrow: 0 }
              : columns === 2
                ? styles.finishedGridItemHalf
                : styles.finishedGridItemFull
          }>
          <FinishedListCard
            book={book}
            coverWidth={coverWidth}
            colors={colors}
            colorScheme={colorScheme}
            compact
            onPress={onPressBook}
          />
        </View>
      ))}
    </View>
  );
}

function StatChip({
  label,
  colors,
  colorScheme,
  accent = false,
}: {
  label: string;
  colors: ThemeColors;
  colorScheme: ColorScheme;
  accent?: boolean;
}) {
  return (
    <View
      style={[
        styles.statChip,
        { backgroundColor: colors.card },
        cardShadow(colorScheme),
      ]}>
      <ThemedText
        style={[
          styles.statChipText,
          {
            color: accent ? colors.olive : colors.text,
            fontFamily: Fonts.rounded,
          },
        ]}>
        {label}
      </ThemedText>
    </View>
  );
}

function HomeHeader({
  colors,
  colorScheme,
  stats,
  readingCount,
  tbrCount,
  centered = false,
}: {
  colors: ThemeColors;
  colorScheme: ColorScheme;
  stats: { totalFinished: number; averageRating: number };
  readingCount: number;
  tbrCount: number;
  centered?: boolean;
}) {
  const contextLine =
    readingCount > 0
      ? `${readingCount} in progress${tbrCount > 0 ? ` · ${tbrCount} up next` : ''}`
      : tbrCount > 0
        ? `${tbrCount} waiting on your shelf`
        : stats.totalFinished > 0
          ? 'Your finished reads'
          : 'Start building your shelf';

  return (
    <View style={[styles.headerBlock, centered && styles.headerBlockCentered]}>
      <ThemedText
        style={[
          centered ? styles.greetingTablet : styles.greeting,
          { color: colors.text, fontFamily: Fonts.serif, textAlign: centered ? 'center' : 'left' },
        ]}>
        Welcome back
      </ThemedText>
      <ThemedText
        style={[
          styles.headerContext,
          {
            color: colors.textSecondary,
            fontFamily: Fonts.rounded,
            textAlign: centered ? 'center' : 'left',
          },
        ]}>
        {contextLine}
      </ThemedText>

      <View style={[styles.statsRow, centered && styles.statsRowCentered]}>
        <StatChip
          label={`${stats.totalFinished} ${stats.totalFinished === 1 ? 'book' : 'books'} read`}
          colors={colors}
          colorScheme={colorScheme}
        />
        <StatChip
          label={stats.totalFinished === 0 ? '— avg rating' : `${stats.averageRating.toFixed(1)} avg rating`}
          colors={colors}
          colorScheme={colorScheme}
          accent
        />
      </View>
    </View>
  );
}

function EmptyShelf({ colors, colorScheme }: { colors: ThemeColors; colorScheme: ColorScheme }) {
  return (
    <View style={[styles.emptyState, cardStyle(colorScheme)]}>
      <ThemedText style={styles.emptyEmoji}>📖</ThemedText>
      <ThemedText style={[styles.emptyTitle, { color: colors.text, fontFamily: Fonts.serif }]}>
        Your shelf is waiting for its first book.
      </ThemedText>
      <ThemedText style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
        Tap the + button to add a book to your shelf.
      </ThemedText>
    </View>
  );
}

export default function HomeScreen() {
  const colorScheme = (useColorScheme() ?? 'light') as ColorScheme;
  const colors = palette[colorScheme];
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const isPad = Platform.OS === 'ios' && Platform.isPad;
  const layoutOptions = useMemo(() => ({ isPad }), [isPad]);
  const isTablet = isTabletLayout(width, layoutOptions);
  const isLargeTablet = isLargeTabletLayout(width, layoutOptions);
  const horizontalPadding = isLargeTablet ? 48 : isTablet ? 32 : 20;
  const contentWidth = getHomeContentWidth(width, layoutOptions);
  const carouselCoverWidth = isLargeTablet ? 160 : isTablet ? 140 : 104;

  const [books, setBooks] = useState<Book[]>([]);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [markingFinishedBook, setMarkingFinishedBook] = useState<Book | null>(null);
  const [finishedFilter, setFinishedFilter] = useState<FinishedFilter>('recent');
  const [finishedFormatFilter, setFinishedFormatFilter] = useState<BookFormat>('physical');

  const loadBooks = useCallback(async () => {
    const savedBooks = await getAllBooks();
    setBooks(savedBooks);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadBooks();
    }, [loadBooks]),
  );

  const { readingBooks, tbrBooks, finishedBooks } = useMemo(() => {
    return {
      readingBooks: books.filter((book) => book.status === 'reading'),
      tbrBooks: books.filter((book) => book.status === 'tbr'),
      finishedBooks: books.filter((book) => book.status === 'finished'),
    };
  }, [books]);

  const stats = useMemo(() => {
    const totalFinished = finishedBooks.length;
    const averageRating =
      totalFinished === 0
        ? 0
        : finishedBooks.reduce((sum, book) => sum + book.rating, 0) / totalFinished;

    return { totalFinished, averageRating };
  }, [finishedBooks]);

  const displayedFinishedBooks = useMemo(() => {
    const filtered = filterFinishedBooks(finishedBooks, finishedFilter, finishedFormatFilter);
    return sortFinishedBooks(filtered, finishedFilter);
  }, [finishedBooks, finishedFilter, finishedFormatFilter]);

  const handleBookSaved = async () => {
    setShowAddForm(false);
    setEditingBook(null);
    setMarkingFinishedBook(null);
    setSelectedBook(null);
    await loadBooks();
  };

  const handleBookDeleted = async () => {
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

  const showFormModal = showAddForm || !!editingBook || !!markingFinishedBook;
  const formBook = markingFinishedBook ?? editingBook ?? undefined;
  const hasAnyBooks = books.length > 0;

  return (
    <ThemedView style={[styles.screen, { backgroundColor: colors.background }]}>
      {!hasAnyBooks ? (
        <ScrollView
          contentContainerStyle={[
            styles.emptyScrollContent,
            {
              paddingTop: insets.top + 16,
              paddingBottom: insets.bottom + 96,
              paddingHorizontal: horizontalPadding,
            },
          ]}
          showsVerticalScrollIndicator={false}>
          <View style={[styles.content, { maxWidth: contentWidth }]}>
            <HomeHeader
              colors={colors}
              colorScheme={colorScheme}
              stats={stats}
              readingCount={readingBooks.length}
              tbrCount={tbrBooks.length}
              centered={isTablet}
            />
            <EmptyShelf colors={colors} colorScheme={colorScheme} />
          </View>
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.listContent,
            {
              paddingTop: insets.top + 16,
              paddingBottom: insets.bottom + 96,
              paddingHorizontal: horizontalPadding,
              alignItems: 'center',
            },
          ]}
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}>
          <View style={[styles.content, { maxWidth: contentWidth }]}>
            <HomeHeader
              colors={colors}
              colorScheme={colorScheme}
              stats={stats}
              readingCount={readingBooks.length}
              tbrCount={tbrBooks.length}
              centered={isTablet}
            />

            {readingBooks.length > 0 && (
              <View style={styles.section}>
                <SectionHeader title="Currently Reading" colors={colors} />
                <HorizontalBookRow
                  books={readingBooks}
                  coverWidth={carouselCoverWidth}
                  colors={colors}
                  onPressBook={setSelectedBook}
                />
              </View>
            )}

            {tbrBooks.length > 0 && (
              <View style={styles.section}>
                <SectionHeader title="Up Next" colors={colors} />
                <HorizontalBookRow
                  books={tbrBooks}
                  coverWidth={carouselCoverWidth}
                  colors={colors}
                  onPressBook={setSelectedBook}
                />
              </View>
            )}

            {finishedBooks.length > 0 && (
              <View style={styles.section}>
                <FinishedSectionHeader
                  colors={colors}
                  activeFilter={finishedFilter}
                  formatFilter={finishedFormatFilter}
                  onSelectFilter={setFinishedFilter}
                  onSelectFormat={(format) => {
                    setFinishedFormatFilter(format);
                    setFinishedFilter('format');
                  }}
                />
                {displayedFinishedBooks.length > 0 ? (
                  <FinishedBooksGrid
                    books={displayedFinishedBooks}
                    isTablet={isTablet}
                    colors={colors}
                    colorScheme={colorScheme}
                    onPressBook={setSelectedBook}
                  />
                ) : (
                  <ThemedText style={[styles.filterEmptyText, { color: colors.textSecondary }]}>
                    No finished books match this filter.
                  </ThemedText>
                )}
              </View>
            )}
          </View>
        </ScrollView>
      )}

      <Pressable
        onPress={() => setShowAddForm(true)}
        accessibilityRole="button"
        accessibilityLabel="Add a book"
        style={({ pressed }) => [
          styles.fab,
          {
            backgroundColor: colors.primary,
            bottom: insets.bottom + 20,
            right: horizontalPadding,
          },
          fabShadow(colorScheme),
          pressed && { backgroundColor: colors.primaryPressed },
        ]}>
        <Ionicons name="add" size={30} color={colors.onPrimary} />
      </Pressable>

      <BookDetailModal
        book={selectedBook}
        visible={!!selectedBook}
        onClose={() => setSelectedBook(null)}
        onEdit={handleEditBook}
        onMarkFinished={handleMarkFinished}
        onDeleted={handleBookDeleted}
      />

      <Modal
        visible={showFormModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setShowAddForm(false);
          setEditingBook(null);
          setMarkingFinishedBook(null);
        }}>
        <BookForm
          book={formBook}
          markFinished={!!markingFinishedBook}
          onSaved={handleBookSaved}
          onCancel={() => {
            setShowAddForm(false);
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
  content: {
    width: '100%',
    alignSelf: 'center',
  },
  listContent: {
    flexGrow: 1,
  },
  emptyScrollContent: {
    flexGrow: 1,
    alignItems: 'center',
  },
  headerBlock: {
    marginBottom: 4,
  },
  headerBlockCentered: {
    alignItems: 'center',
  },
  greeting: {
    fontSize: 28,
    lineHeight: 34,
    marginBottom: 6,
  },
  greetingTablet: {
    fontSize: 36,
    lineHeight: 42,
    marginBottom: 8,
  },
  headerContext: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statsRowCentered: {
    justifyContent: 'center',
  },
  statChip: {
    borderRadius: radii.button,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  statChipText: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  section: {
    marginTop: 28,
    gap: 14,
  },
  sectionTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
  },
  finishedSectionHeader: {
    gap: 12,
  },
  filterChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingRight: 4,
  },
  formatChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    borderWidth: 1,
    borderRadius: radii.input,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  filterEmptyText: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 14,
  },
  carouselScroll: {
    width: '100%',
    flexGrow: 0,
  },
  carouselContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    paddingRight: 8,
  },
  carouselItem: {
    gap: 8,
    flexShrink: 0,
  },
  carouselTitle: {
    fontSize: 15,
    lineHeight: 20,
  },
  carouselAuthor: {
    fontSize: 13,
    lineHeight: 18,
  },
  coverFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  finishedWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    overflow: 'visible',
  },
  floatingCover: {
    zIndex: 2,
    borderRadius: radii.input,
  },
  finishedCard: {
    justifyContent: 'center',
    paddingRight: 14,
    paddingVertical: 14,
  },
  finishedCardCompact: {
    paddingRight: 10,
    paddingVertical: 10,
  },
  finishedBody: {
    gap: 5,
  },
  finishedTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  finishedFormatIcon: {
    marginTop: 3,
  },
  finishedTitleText: {
    flex: 1,
  },
  finishedTitle: {
    fontSize: 16,
    lineHeight: 22,
  },
  finishedTitleCompact: {
    fontSize: 15,
    lineHeight: 20,
  },
  finishedAuthor: {
    fontSize: 14,
    lineHeight: 20,
  },
  finishedAuthorCompact: {
    fontSize: 13,
    lineHeight: 18,
  },
  finishedReview: {
    fontSize: 13,
    lineHeight: 19,
  },
  finishedReviewCompact: {
    fontSize: 12,
    lineHeight: 17,
  },
  finishedList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignContent: 'flex-start',
    width: '100%',
    marginTop: 14,
  },
  finishedGridItemHalf: {
    width: '48%',
    flexShrink: 0,
    flexGrow: 0,
  },
  finishedGridItemFull: {
    width: '100%',
    flexShrink: 0,
    flexGrow: 0,
  },
  starRow: {
    flexDirection: 'row',
    gap: 2,
  },
  emptyState: {
    marginTop: 28,
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 48,
    gap: 10,
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 22,
    lineHeight: 30,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.88,
  },
});
