import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenContainer, screenScrollContentStyle } from '@/components/ScreenContainer';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  BOOK_SEARCH_DEBOUNCE_MS,
  BOOK_SEARCH_MIN_QUERY_LENGTH,
  loadCoverForSearchResult,
  runBookSearchQuery,
  type BookSearchResult,
  type BookSearchStatus,
} from '@/src/services/bookSearch';
import { addBook, updateBook } from '@/src/services/storage';
import type { Book, BookFormat, BookStatus } from '@/src/types/book';
import {
  cardShadow,
  palette,
  type ColorScheme,
  type ThemeColors,
} from '@/utils/theme';

type BookFormProps = {
  book?: Book;
  markFinished?: boolean;
  onSaved?: () => void;
  onCancel?: () => void;
};

function formatDate(date: Date) {
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

type FieldLabelProps = {
  label: string;
  colors: ThemeColors;
};

function FieldLabel({ label, colors }: FieldLabelProps) {
  return (
    <ThemedText
      style={[styles.label, { color: colors.textSecondary, fontFamily: Fonts.rounded }]}>
      {label}
    </ThemedText>
  );
}

type StarRatingProps = {
  rating: number;
  onChange: (rating: number) => void;
  colors: ThemeColors;
};

function StarRating({ rating, onChange, colors }: StarRatingProps) {
  return (
    <View style={styles.starRow} accessibilityRole="adjustable">
      {[1, 2, 3, 4, 5].map((value) => {
        const filled = value <= rating;
        return (
          <Pressable
            key={value}
            onPress={() => onChange(value)}
            accessibilityRole="button"
            accessibilityLabel={`Rate ${value} out of 5 stars`}
            hitSlop={8}
            style={({ pressed }) => [styles.starButton, pressed && styles.starButtonPressed]}>
            <Ionicons
              name={filled ? 'star' : 'star-outline'}
              size={36}
              color={filled ? colors.star : colors.starEmpty}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

type StatusPickerProps = {
  value: BookStatus;
  onChange: (status: BookStatus) => void;
  colors: ThemeColors;
  disabled?: boolean;
};

function StatusPicker({ value, onChange, colors, disabled }: StatusPickerProps) {
  const options: { key: BookStatus; label: string }[] = [
    { key: 'tbr', label: 'TBR' },
    { key: 'reading', label: 'Reading' },
    { key: 'finished', label: 'Finished' },
  ];

  return (
    <View style={styles.statusRow}>
      {options.map((option) => {
        const selected = value === option.key;
        return (
          <Pressable
            key={option.key}
            disabled={disabled}
            onPress={() => onChange(option.key)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`Set status to ${option.label}`}
            style={({ pressed }) => [
              styles.statusOption,
              {
                backgroundColor: selected ? colors.primary : colors.input,
                borderColor: selected ? colors.primary : colors.border,
              },
              pressed && !disabled && styles.pressed,
              disabled && styles.saveButtonDisabled,
            ]}>
            <ThemedText
              style={[
                styles.statusOptionText,
                { color: selected ? colors.onPrimary : colors.text, fontFamily: Fonts.rounded },
              ]}>
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

type FormatPickerProps = {
  value: BookFormat;
  onChange: (format: BookFormat) => void;
  colors: ThemeColors;
};

function FormatPicker({ value, onChange, colors }: FormatPickerProps) {
  const options: { key: BookFormat; label: string }[] = [
    { key: 'physical', label: 'Physical' },
    { key: 'audiobook', label: 'Audiobook' },
  ];

  return (
    <View style={styles.statusRow}>
      {options.map((option) => {
        const selected = value === option.key;
        return (
          <Pressable
            key={option.key}
            onPress={() => onChange(option.key)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`Set format to ${option.label}`}
            style={({ pressed }) => [
              styles.statusOption,
              {
                backgroundColor: selected ? colors.primary : colors.input,
                borderColor: selected ? colors.primary : colors.border,
              },
              pressed && styles.pressed,
            ]}>
            <ThemedText
              style={[
                styles.statusOptionText,
                { color: selected ? colors.onPrimary : colors.text, fontFamily: Fonts.rounded },
              ]}>
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

type SearchResultProps = {
  result: BookSearchResult;
  colors: ThemeColors;
  onSelect: (result: BookSearchResult) => void;
};

function SearchResultRow({ result, colors, onSelect }: SearchResultProps) {
  return (
    <Pressable
      onPress={() => onSelect(result)}
      accessibilityRole="button"
      accessibilityLabel={`Select ${result.title} by ${result.author}`}
      style={({ pressed }) => [
        styles.searchResult,
        { backgroundColor: colors.input, borderColor: colors.border },
        pressed && styles.pressed,
      ]}>
      {result.coverUrl ? (
        <Image source={{ uri: result.coverUrl }} style={styles.searchCover} contentFit="cover" />
      ) : (
        <View style={[styles.searchCoverFallback, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="book-outline" size={18} color={colors.textSecondary} />
        </View>
      )}
      <View style={styles.searchResultText}>
        <ThemedText numberOfLines={2} style={[styles.searchTitle, { color: colors.text, fontFamily: Fonts.serif }]}>
          {result.title}
        </ThemedText>
        <ThemedText numberOfLines={1} style={[styles.searchAuthor, { color: colors.textSecondary }]}>
          {result.author}
        </ThemedText>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
    </Pressable>
  );
}

export default function BookForm({ book, markFinished = false, onSaved, onCancel }: BookFormProps) {
  const colorScheme = (useColorScheme() ?? 'light') as ColorScheme;
  const colors = palette[colorScheme];
  const insets = useSafeAreaInsets();
  const isEditing = !!book && !markFinished;
  const isCompletionFlow = !!book && markFinished;

  const [status, setStatus] = useState<BookStatus>('finished');
  const [format, setFormat] = useState<BookFormat>('physical');
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [rating, setRating] = useState(0);
  const [dateFinished, setDateFinished] = useState(() => new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [review, setReview] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<BookSearchResult[]>([]);
  const [searchStatus, setSearchStatus] = useState<BookSearchStatus>('idle');
  const [isDownloadingCover, setIsDownloadingCover] = useState(false);
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRequestRef = useRef(0);

  const resetSearch = () => {
    searchRequestRef.current += 1;
    setSearchQuery('');
    setSearchResults([]);
    setSearchStatus('idle');
  };

  useEffect(() => {
    if (book) {
      setTitle(book.title);
      setAuthor(book.author);
      setStatus(book.status);
      setFormat(book.format);
      setCoverUri(book.coverImageUri);
      setShowDatePicker(false);
      setSuccessMessage(null);
      setValidationError(null);
      resetSearch();

      if (markFinished) {
        setRating(0);
        setDateFinished(new Date());
        setReview('');
        return;
      }

      setRating(book.rating);
      setDateFinished(book.dateFinished ? new Date(book.dateFinished) : new Date());
      setReview(book.review);
      return;
    }

    setStatus('finished');
    setFormat('physical');
    setTitle('');
    setAuthor('');
    setRating(0);
    setDateFinished(new Date());
    setShowDatePicker(false);
    setCoverUri(null);
    setReview('');
    setSuccessMessage(null);
    setValidationError(null);
    resetSearch();
  }, [book, markFinished]);

  useEffect(() => {
    if (isEditing) {
      return;
    }

    const trimmed = searchQuery.trim();
    if (trimmed.length < BOOK_SEARCH_MIN_QUERY_LENGTH) {
      setSearchResults([]);
      setSearchStatus('idle');
      return;
    }

    setSearchStatus('loading');
    const requestId = ++searchRequestRef.current;

    const timeout = setTimeout(async () => {
      const { status, results } = await runBookSearchQuery(trimmed);
      if (requestId !== searchRequestRef.current) {
        return;
      }

      setSearchResults(results);
      setSearchStatus(status);
    }, BOOK_SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [searchQuery, isEditing]);

  const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (event.type === 'dismissed') {
      return;
    }
    if (selectedDate) {
      setDateFinished(selectedDate);
    }
  };

  const resetForm = () => {
    setStatus('finished');
    setFormat('physical');
    setTitle('');
    setAuthor('');
    setRating(0);
    setDateFinished(new Date());
    setShowDatePicker(false);
    setCoverUri(null);
    setReview('');
    setValidationError(null);
    resetSearch();
  };

  const showFinishedFields = isCompletionFlow || status === 'finished';
  const showBasicFields = !isCompletionFlow;

  const handleSelectSearchResult = async (result: BookSearchResult) => {
    setTitle(result.title);
    setAuthor(result.author);
    resetSearch();

    if (!result.coverId && !result.coverUrl) {
      return;
    }

    setIsDownloadingCover(true);
    try {
      const localCoverUri = await loadCoverForSearchResult(result);
      if (localCoverUri) {
        setCoverUri(localCoverUri);
      }
    } finally {
      setIsDownloadingCover(false);
    }
  };

  const showSuccess = (message: string) => {
    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current);
    }
    setSuccessMessage(message);
    successTimeoutRef.current = setTimeout(() => {
      setSuccessMessage(null);
      successTimeoutRef.current = null;
    }, 2500);
  };

  const handleSave = async () => {
    if (isSaving) {
      return;
    }

    setValidationError(null);

    if (showFinishedFields && rating < 1) {
      setValidationError('Please add a rating before saving.');
      return;
    }

    if (showBasicFields && !title.trim()) {
      setValidationError('Please add a title before saving.');
      return;
    }

    setIsSaving(true);
    try {
      if (isCompletionFlow && book) {
        await updateBook(book.id, {
          status: 'finished',
          rating,
          dateFinished,
          review,
        });
      } else if (isEditing && book) {
        await updateBook(book.id, {
          title,
          author,
          status,
          format,
          coverImageUri: coverUri,
          ...(showFinishedFields ? { rating, dateFinished, review } : {}),
        });
      } else {
        await addBook({
          title,
          author,
          status,
          format,
          coverImageUri: coverUri,
          ...(showFinishedFields ? { rating, dateFinished, review } : {}),
        });
      }

      if (onSaved) {
        onSaved();
        return;
      }

      resetForm();
      showSuccess(
        isCompletionFlow ? 'Marked as finished!' : isEditing ? 'Book updated!' : 'Book saved to your shelf!',
      );
    } catch (error) {
      console.error('Failed to save book:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const pickCoverPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [2, 3],
      quality: 0.85,
    });

    if (!result.canceled && result.assets[0]) {
      setCoverUri(result.assets[0].uri);
    }
  };

  return (
    <ThemedView style={[styles.screen, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[
            screenScrollContentStyle,
            {
              paddingTop: insets.top + 16,
              paddingBottom: insets.bottom + 32,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <ScreenContainer>
            {onCancel && (
              <Pressable
                onPress={onCancel}
                accessibilityRole="button"
                accessibilityLabel="Close form"
                hitSlop={8}
                style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            )}

            <ThemedText
              type="title"
              style={[styles.heading, { color: colors.text, fontFamily: Fonts.serif }]}>
              {isCompletionFlow ? 'Mark as Finished' : isEditing ? 'Edit Book' : 'Add a Book'}
            </ThemedText>
            <ThemedText style={[styles.subheading, { color: colors.textSecondary }]}>
              {isCompletionFlow
                ? `Wrap up "${book?.title}" with your rating and thoughts.`
                : isEditing
                  ? 'Update the details on your shelf.'
                  : 'Choose a status, then add the details.'}
            </ThemedText>

            {validationError && (
              <View
                style={[
                  styles.validationBanner,
                  { backgroundColor: colors.card, borderColor: colors.danger },
                ]}>
                <Ionicons name="alert-circle" size={20} color={colors.danger} />
                <ThemedText style={[styles.validationText, { color: colors.danger }]}>
                  {validationError}
                </ThemedText>
              </View>
            )}

            {successMessage && (
              <View
                style={[
                  styles.successBanner,
                  { backgroundColor: colors.card, borderColor: colors.mint },
                ]}>
                <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                <ThemedText style={[styles.successText, { color: colors.text }]}>
                  {successMessage}
                </ThemedText>
              </View>
            )}

            <View style={[styles.card, { backgroundColor: colors.card }, cardShadow(colorScheme)]}>
              {!isCompletionFlow && (
                <>
                  <FieldLabel label="Status" colors={colors} />
                  <StatusPicker value={status} onChange={setStatus} colors={colors} />
                  <FieldLabel label="Format" colors={colors} />
                  <FormatPicker value={format} onChange={setFormat} colors={colors} />
                </>
              )}

              {!isEditing && !isCompletionFlow && (
                <>
                  <FieldLabel label="Search for a book" colors={colors} />
                  <View
                    style={[
                      styles.searchInputWrap,
                      { backgroundColor: colors.input, borderColor: colors.border },
                    ]}>
                    <Ionicons name="search-outline" size={20} color={colors.textSecondary} />
                    <TextInput
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                      placeholder="Title, author, or ISBN"
                      placeholderTextColor={colors.placeholder}
                      autoCorrect={false}
                      style={[styles.searchInput, { color: colors.text }]}
                    />
                    {searchStatus === 'loading' && (
                      <ActivityIndicator size="small" color={colors.primary} />
                    )}
                  </View>

                  {searchStatus === 'offline' && (
                    <ThemedText style={[styles.searchMessage, { color: colors.textSecondary }]}>
                      Couldn&apos;t reach book search. Check your connection and try again, or enter details
                      manually below.
                    </ThemedText>
                  )}

                  {searchStatus === 'no-results' && (
                    <ThemedText style={[styles.searchMessage, { color: colors.textSecondary }]}>
                      No books found. You can still fill in the details below.
                    </ThemedText>
                  )}

                  {searchResults.length > 0 && (
                    <View style={styles.searchResults}>
                      {searchResults.map((result) => (
                        <SearchResultRow
                          key={result.id}
                          result={result}
                          colors={colors}
                          onSelect={handleSelectSearchResult}
                        />
                      ))}
                    </View>
                  )}
                </>
              )}

              {showBasicFields && (
                <>
                  <FieldLabel label="Title" colors={colors} />
                  <TextInput
                    value={title}
                    onChangeText={setTitle}
                    placeholder="What did you read?"
                    placeholderTextColor={colors.placeholder}
                    style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
                  />

                  <FieldLabel label="Author" colors={colors} />
                  <TextInput
                    value={author}
                    onChangeText={setAuthor}
                    placeholder="Who wrote it?"
                    placeholderTextColor={colors.placeholder}
                    style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
                  />

                  <FieldLabel label="Cover Photo" colors={colors} />
                  <Pressable
                    onPress={pickCoverPhoto}
                    disabled={isDownloadingCover}
                    style={({ pressed }) => [
                      styles.coverPicker,
                      { backgroundColor: colors.input, borderColor: colors.border },
                      pressed && styles.pressed,
                      isDownloadingCover && styles.saveButtonDisabled,
                    ]}>
                    {isDownloadingCover ? (
                      <View style={styles.coverPlaceholder}>
                        <ActivityIndicator size="small" color={colors.primary} />
                        <ThemedText style={[styles.coverPlaceholderText, { color: colors.textSecondary }]}>
                          Downloading cover…
                        </ThemedText>
                      </View>
                    ) : coverUri ? (
                      <Image source={{ uri: coverUri }} style={styles.coverPreview} contentFit="cover" />
                    ) : (
                      <View style={styles.coverPlaceholder}>
                        <Ionicons name="image-outline" size={32} color={colors.textSecondary} />
                        <ThemedText style={[styles.coverPlaceholderText, { color: colors.textSecondary }]}>
                          Tap to choose from your library
                        </ThemedText>
                      </View>
                    )}
                  </Pressable>
                </>
              )}

              {showFinishedFields && (
                <>
                  <FieldLabel label="Rating" colors={colors} />
                  <StarRating rating={rating} onChange={setRating} colors={colors} />

                  <FieldLabel label="Date Finished" colors={colors} />
                  <Pressable
                    onPress={() => setShowDatePicker(true)}
                    style={({ pressed }) => [
                      styles.dateButton,
                      { backgroundColor: colors.input, borderColor: colors.border },
                      pressed && styles.pressed,
                    ]}>
                    <Ionicons name="calendar-outline" size={20} color={colors.primary} />
                    <ThemedText style={[styles.dateText, { color: colors.text }]}>
                      {formatDate(dateFinished)}
                    </ThemedText>
                  </Pressable>
                  {showDatePicker && (
                    <View style={[styles.datePickerWrap, { borderColor: colors.border }]}>
                      <DateTimePicker
                        value={dateFinished}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'inline' : 'default'}
                        onChange={handleDateChange}
                        maximumDate={new Date()}
                      />
                      {Platform.OS === 'ios' && (
                        <Pressable
                          onPress={() => setShowDatePicker(false)}
                          style={({ pressed }) => [
                            styles.dateDoneButton,
                            { backgroundColor: colors.primary },
                            pressed && { backgroundColor: colors.primaryPressed },
                          ]}>
                          <ThemedText style={[styles.dateDoneText, { color: colors.onPrimary }]}>
                            Done
                          </ThemedText>
                        </Pressable>
                      )}
                    </View>
                  )}

                  <FieldLabel label="My Review & Thoughts" colors={colors} />
                  <TextInput
                    value={review}
                    onChangeText={setReview}
                    placeholder="What stayed with you?"
                    placeholderTextColor={colors.placeholder}
                    multiline
                    textAlignVertical="top"
                    style={[
                      styles.input,
                      styles.textArea,
                      { backgroundColor: colors.input, borderColor: colors.border, color: colors.text },
                    ]}
                  />
                </>
              )}

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Save book"
                disabled={isSaving}
                onPress={handleSave}
                style={({ pressed }) => [
                  styles.saveButton,
                  { backgroundColor: colors.primary },
                  pressed && { backgroundColor: colors.primaryPressed },
                  isSaving && styles.saveButtonDisabled,
                ]}>
                <ThemedText style={[styles.saveButtonText, { color: colors.onPrimary, fontFamily: Fonts.rounded }]}>
                  {isSaving ? 'Saving…' : isCompletionFlow ? 'Mark as Finished' : 'Save'}
                </ThemedText>
              </Pressable>
            </View>
          </ScreenContainer>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  closeButton: {
    alignSelf: 'flex-end',
    marginBottom: 4,
  },
  heading: {
    fontSize: 34,
    lineHeight: 40,
    marginBottom: 6,
  },
  subheading: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 24,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
  },
  successText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
  },
  validationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
  },
  validationText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  statusOption: {
    flex: 1,
    minWidth: 90,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  statusOptionText: {
    fontSize: 15,
    fontWeight: '600',
  },
  card: {
    borderRadius: 20,
    padding: 20,
    gap: 8,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    lineHeight: 22,
  },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    paddingVertical: 2,
  },
  searchMessage: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  searchResults: {
    gap: 8,
    marginTop: 4,
    marginBottom: 4,
  },
  searchResult: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  searchCover: {
    width: 44,
    aspectRatio: 2 / 3,
    borderRadius: 6,
  },
  searchCoverFallback: {
    width: 44,
    aspectRatio: 2 / 3,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchResultText: {
    flex: 1,
    gap: 2,
  },
  searchTitle: {
    fontSize: 15,
    lineHeight: 20,
  },
  searchAuthor: {
    fontSize: 13,
    lineHeight: 18,
  },
  textArea: {
    minHeight: 120,
    paddingTop: 12,
  },
  starRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 4,
  },
  starButton: {
    padding: 2,
  },
  starButtonPressed: {
    opacity: 0.75,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  dateText: {
    fontSize: 16,
    flex: 1,
  },
  datePickerWrap: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 4,
    marginBottom: 4,
  },
  dateDoneButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  dateDoneText: {
    fontSize: 16,
    fontWeight: '600',
  },
  coverPicker: {
    borderWidth: 1,
    borderRadius: 12,
    borderStyle: 'dashed',
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  coverPreview: {
    width: 120,
    aspectRatio: 2 / 3,
  },
  coverPlaceholder: {
    width: 120,
    aspectRatio: 2 / 3,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    gap: 8,
  },
  coverPlaceholderText: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  saveButton: {
    marginTop: 16,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    fontSize: 17,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.85,
  },
});
