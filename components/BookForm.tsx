import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const MAX_CONTENT_WIDTH = 560;
const TABLET_BREAKPOINT = 768;

const cozyPalette = {
  light: {
    page: '#F3EBE0',
    card: '#FFFCF7',
    input: '#FAF6F0',
    border: '#E5D8CA',
    label: '#5C4335',
    placeholder: '#A89282',
    text: '#3D2E24',
    accent: '#B8734A',
    accentPressed: '#9E613C',
    starFilled: '#C9943A',
    starEmpty: '#D9C9B8',
    muted: '#8B7263',
    saveText: '#FFFCF7',
  },
  dark: {
    page: '#1E1814',
    card: '#2A221C',
    input: '#332A23',
    border: '#4A3C33',
    label: '#E8D9CC',
    placeholder: '#8B7263',
    text: '#F5EDE4',
    accent: '#D4915E',
    accentPressed: '#B8734A',
    starFilled: '#E4B04A',
    starEmpty: '#5C4A3D',
    muted: '#B89E8C',
    saveText: '#2A221C',
  },
} as const;

type CozyColors = (typeof cozyPalette)['light'] | (typeof cozyPalette)['dark'];

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
  colors: CozyColors;
};

function FieldLabel({ label, colors }: FieldLabelProps) {
  return (
    <ThemedText
      style={[styles.label, { color: colors.label, fontFamily: Fonts.rounded }]}>
      {label}
    </ThemedText>
  );
}

type StarRatingProps = {
  rating: number;
  onChange: (rating: number) => void;
  colors: CozyColors;
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
              color={filled ? colors.starFilled : colors.starEmpty}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

export default function BookForm() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = cozyPalette[colorScheme];
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isTablet = width >= TABLET_BREAKPOINT;

  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [rating, setRating] = useState(0);
  const [dateFinished, setDateFinished] = useState(() => new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [review, setReview] = useState('');

  const horizontalPadding = isTablet ? 32 : 20;

  const contentStyle = useMemo(
    () => ({
      width: '100%' as const,
      maxWidth: MAX_CONTENT_WIDTH,
      alignSelf: 'center' as const,
      paddingHorizontal: horizontalPadding,
    }),
    [horizontalPadding],
  );

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
    <ThemedView style={[styles.screen, { backgroundColor: colors.page }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: insets.top + 16,
              paddingBottom: insets.bottom + 32,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={contentStyle}>
            <ThemedText
              type="title"
              style={[styles.heading, { color: colors.text, fontFamily: Fonts.serif }]}>
              Log a Book
            </ThemedText>
            <ThemedText style={[styles.subheading, { color: colors.muted }]}>
              Capture what you read and how it made you feel.
            </ThemedText>

            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
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
                <Ionicons name="calendar-outline" size={20} color={colors.accent} />
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
                        { backgroundColor: colors.accent },
                        pressed && { backgroundColor: colors.accentPressed },
                      ]}>
                      <ThemedText style={[styles.dateDoneText, { color: colors.saveText }]}>
                        Done
                      </ThemedText>
                    </Pressable>
                  )}
                </View>
              )}

              <FieldLabel label="Cover Photo" colors={colors} />
              <Pressable
                onPress={pickCoverPhoto}
                style={({ pressed }) => [
                  styles.coverPicker,
                  { backgroundColor: colors.input, borderColor: colors.border },
                  pressed && styles.pressed,
                ]}>
                {coverUri ? (
                  <Image source={{ uri: coverUri }} style={styles.coverPreview} contentFit="cover" />
                ) : (
                  <View style={styles.coverPlaceholder}>
                    <Ionicons name="image-outline" size={32} color={colors.muted} />
                    <ThemedText style={[styles.coverPlaceholderText, { color: colors.muted }]}>
                      Tap to choose from your library
                    </ThemedText>
                  </View>
                )}
              </Pressable>

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

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Save book"
                style={({ pressed }) => [
                  styles.saveButton,
                  { backgroundColor: colors.accent },
                  pressed && { backgroundColor: colors.accentPressed },
                ]}>
                <ThemedText style={[styles.saveButtonText, { color: colors.saveText, fontFamily: Fonts.rounded }]}>
                  Save
                </ThemedText>
              </Pressable>
            </View>
          </View>
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
  scrollContent: {
    flexGrow: 1,
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
  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
    gap: 8,
    shadowColor: '#3D2E24',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    lineHeight: 22,
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
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 17,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.85,
  },
});
