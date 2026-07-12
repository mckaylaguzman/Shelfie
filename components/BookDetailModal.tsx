import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenContainer } from '@/components/ScreenContainer';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { formatBookDate, isTabletLayout } from '@/constants/cozy-theme';
import { Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { deleteBook, getStatusLabel } from '@/src/services/storage';
import type { Book } from '@/src/types/book';
import {
  cardStyle,
  palette,
  radii,
  type ColorScheme,
  type ThemeColors,
} from '@/utils/theme';

type BookDetailModalProps = {
  book: Book | null;
  visible: boolean;
  onClose: () => void;
  onEdit: (book: Book) => void;
  onMarkFinished: (book: Book) => void;
  onDeleted: () => void;
};

function StarDisplay({
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

function StatusBadge({ book, colors }: { book: Book; colors: ThemeColors }) {
  const badgeColor =
    book.status === 'reading' ? colors.olive : book.status === 'tbr' ? colors.pink : colors.mint;

  return (
    <View style={[styles.statusBadge, { backgroundColor: badgeColor }]}>
      <ThemedText style={[styles.statusBadgeText, { color: colors.text, fontFamily: Fonts.rounded }]}>
        {getStatusLabel(book.status)}
      </ThemedText>
    </View>
  );
}

function CoverImage({
  book,
  width,
  colors,
}: {
  book: Book;
  width: number;
  colors: ThemeColors;
}) {
  const height = width * 1.5;

  if (book.coverImageUri) {
    return (
      <Image
        source={{ uri: book.coverImageUri }}
        style={{ width, height, borderRadius: radii.input }}
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
          borderRadius: radii.input,
          backgroundColor: colors.input,
          borderColor: colors.border,
        },
      ]}>
      <Ionicons name="book-outline" size={width * 0.34} color={colors.textSecondary} />
    </View>
  );
}

export default function BookDetailModal({
  book,
  visible,
  onClose,
  onEdit,
  onMarkFinished,
  onDeleted,
}: BookDetailModalProps) {
  const colorScheme = (useColorScheme() ?? 'light') as ColorScheme;
  const colors = palette[colorScheme];
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isTablet = isTabletLayout(width, { isPad: Platform.OS === 'ios' && Platform.isPad });
  const coverWidth = isTablet ? 148 : 126;
  const maxReviewHeight = Math.round(height * 0.28);

  if (!book) {
    return null;
  }

  const isFinished = book.status === 'finished';
  const reviewText = book.review.trim() || 'No review written yet.';
  const isLongReview = reviewText.length > 200 || reviewText.split('\n').length > 5;

  const handleDelete = () => {
    Alert.alert(
      'Remove from shelf?',
      `This will permanently delete "${book.title}" from your shelf.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteBook(book.id);
            onDeleted();
          },
        },
      ],
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ThemedView style={[styles.screen, { backgroundColor: colors.background }]}>
        <View
          style={[
            styles.page,
            {
              paddingTop: insets.top + 12,
              paddingBottom: insets.bottom + 16,
            },
          ]}>
          <ScreenContainer style={styles.content}>
            <View style={styles.headerRow}>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close book details"
                hitSlop={8}
                style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            <View style={[styles.heroCard, cardStyle(colorScheme)]}>
              <CoverImage book={book} width={coverWidth} colors={colors} />

              <View style={styles.heroText}>
                <StatusBadge book={book} colors={colors} />
                <ThemedText
                  style={[styles.title, { color: colors.text, fontFamily: Fonts.serif }]}>
                  {book.title}
                </ThemedText>
                <ThemedText style={[styles.author, { color: colors.textSecondary }]}>
                  {book.author}
                </ThemedText>
                {isFinished && (
                  <>
                    <StarDisplay rating={book.rating} size={18} colors={colors} />
                    <ThemedText style={[styles.date, { color: colors.textSecondary }]}>
                      Finished {formatBookDate(book.dateFinished)}
                    </ThemedText>
                  </>
                )}
              </View>
            </View>

            {isFinished && (
              <View style={[styles.reviewSection, cardStyle(colorScheme)]}>
                <ThemedText
                  style={[styles.sectionTitle, { color: colors.olive, fontFamily: Fonts.rounded }]}>
                  My Review
                </ThemedText>
                {isLongReview ? (
                  <ScrollView
                    style={{ maxHeight: maxReviewHeight }}
                    contentContainerStyle={styles.reviewScrollContent}
                    showsVerticalScrollIndicator={false}
                    nestedScrollEnabled>
                    <ThemedText style={[styles.review, { color: colors.text }]}>{reviewText}</ThemedText>
                  </ScrollView>
                ) : (
                  <ThemedText style={[styles.review, { color: colors.text }]}>{reviewText}</ThemedText>
                )}
              </View>
            )}

            <View style={styles.actions}>
              {!isFinished && (
                <Pressable
                  onPress={() => onMarkFinished(book)}
                  style={({ pressed }) => [
                    styles.actionButton,
                    { backgroundColor: colors.primary },
                    pressed && { backgroundColor: colors.primaryPressed },
                  ]}>
                  <Ionicons name="checkmark-circle-outline" size={20} color={colors.onPrimary} />
                  <ThemedText style={[styles.actionText, { color: colors.onPrimary, fontFamily: Fonts.rounded }]}>
                    Mark as Finished
                  </ThemedText>
                </Pressable>
              )}

              <Pressable
                onPress={() => onEdit(book)}
                style={({ pressed }) => [
                  styles.actionButton,
                  isFinished ? { backgroundColor: colors.primary } : styles.secondaryButton,
                  isFinished && pressed && { backgroundColor: colors.primaryPressed },
                  !isFinished && { borderColor: colors.border },
                  !isFinished && pressed && styles.pressed,
                ]}>
                <Ionicons
                  name="create-outline"
                  size={20}
                  color={isFinished ? colors.onPrimary : colors.text}
                />
                <ThemedText
                  style={[
                    styles.actionText,
                    {
                      color: isFinished ? colors.onPrimary : colors.text,
                      fontFamily: Fonts.rounded,
                    },
                  ]}>
                  Edit
                </ThemedText>
              </Pressable>

              <Pressable
                onPress={handleDelete}
                style={({ pressed }) => [
                  styles.actionButton,
                  styles.deleteButton,
                  { borderColor: colors.danger },
                  pressed && styles.pressed,
                ]}>
                <Ionicons name="trash-outline" size={20} color={colors.danger} />
                <ThemedText style={[styles.actionText, { color: colors.danger, fontFamily: Fonts.rounded }]}>
                  Delete
                </ThemedText>
              </Pressable>
            </View>
          </ScreenContainer>
        </View>
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  page: {
    flex: 1,
    alignItems: 'center',
  },
  content: {
    flex: 1,
    width: '100%',
    alignSelf: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 8,
  },
  iconButton: {
    padding: 4,
  },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    padding: 16,
  },
  coverFallback: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: {
    flex: 1,
    gap: 6,
    paddingTop: 2,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
  },
  author: {
    fontSize: 15,
    lineHeight: 21,
  },
  date: {
    fontSize: 14,
    lineHeight: 20,
  },
  starRow: {
    flexDirection: 'row',
    gap: 3,
  },
  reviewSection: {
    marginTop: 14,
    padding: 16,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  reviewScrollContent: {
    flexGrow: 0,
  },
  review: {
    fontSize: 15,
    lineHeight: 23,
  },
  actions: {
    marginTop: 'auto',
    paddingTop: 14,
    gap: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radii.button,
    paddingVertical: 14,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  deleteButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  actionText: {
    fontSize: 16,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.85,
  },
});
