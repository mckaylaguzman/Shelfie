import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  InteractionManager,
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

import { ScreenContainer, useScreenLayout } from '@/components/ScreenContainer';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { isTabletLayout } from '@/constants/cozy-theme';
import { Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  deleteAccount,
  resetPassword,
  signIn,
  signOutUser,
  signUp,
  useAuth,
} from '@/src/services/auth';
import { getLocalBookCount, migrateLocalBooksToCloud } from '@/src/services/bookMigration';
import {
  cardStyle,
  palette,
  radii,
  type ColorScheme,
  type ThemeColors,
} from '@/utils/theme';

type AuthMode = 'sign-in' | 'sign-up';

const AUTH_CARD_MAX_WIDTH = 440;

function ProfileHeader({
  colors,
  isTablet,
  onBack,
}: {
  colors: ThemeColors;
  isTablet: boolean;
  onBack: () => void;
}) {
  return (
    <View style={[styles.headerBlock, isTablet && styles.headerBlockCentered]}>
      <View style={styles.headerTopRow}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={({ pressed }) => [styles.headerIconButton, pressed && styles.pressed]}>
          <Ionicons name="chevron-back" size={32} color={colors.textSecondary} />
        </Pressable>
        <View style={styles.headerTopSpacer} />
      </View>
      <ThemedText
        style={[
          isTablet ? styles.greetingTablet : styles.greeting,
          { color: colors.text, fontFamily: Fonts.serif, textAlign: isTablet ? 'center' : 'left' },
        ]}>
        Profile
      </ThemedText>
    </View>
  );
}


function FieldLabel({ label, colors }: { label: string; colors: ThemeColors }) {
  return (
    <ThemedText style={[styles.label, { color: colors.textSecondary, fontFamily: Fonts.rounded }]}>
      {label}
    </ThemedText>
  );
}

function AuthHeroHeader({ colors }: { colors: ThemeColors }) {
  return (
    <View style={styles.authHero}>
      <ThemedText style={[styles.cardTitle, { color: colors.text, fontFamily: Fonts.serif, textAlign: 'center' }]}>
        Sync your shelf across devices
      </ThemedText>
      <ThemedText style={[styles.cardSubtitle, { color: colors.textSecondary, textAlign: 'center' }]}>
        Sign in to keep your books backed up. Your shelf works fully without an account too.
      </ThemedText>
    </View>
  );
}

function SignedOutView({
  colors,
  colorScheme,
  onAuthSuccess,
}: {
  colors: ThemeColors;
  colorScheme: ColorScheme;
  onAuthSuccess: (uid: string, localBookCount: number) => void;
}) {
  const [mode, setMode] = useState<AuthMode>('sign-up');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isSignUp = mode === 'sign-up';

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleSubmit = async () => {
    if (isSubmitting) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const localBookCount = await getLocalBookCount();

      if (isSignUp) {
        const user = await signUp(email, password);
        setSuccessMessage('Account created. Welcome to Shelfie!');
        setPassword('');
        onAuthSuccess(user.uid, localBookCount);
        return;
      }

      const user = await signIn(email, password);
      setSuccessMessage('Signed in successfully.');
      onAuthSuccess(user.uid, localBookCount);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    if (isSubmitting) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      await resetPassword(email);
      setSuccessMessage('Password reset email sent. Check your inbox.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={[styles.card, styles.authCard, cardStyle(colorScheme)]}>
      <AuthHeroHeader colors={colors} />

      {errorMessage && (
        <View style={[styles.banner, { backgroundColor: colors.input, borderColor: colors.danger }]}>
          <Ionicons name="alert-circle-outline" size={20} color={colors.danger} />
          <ThemedText style={[styles.bannerText, { color: colors.danger }]}>{errorMessage}</ThemedText>
        </View>
      )}

      {successMessage && (
        <View style={[styles.banner, { backgroundColor: colors.input, borderColor: colors.olive }]}>
          <Ionicons name="checkmark-circle-outline" size={20} color={colors.olive} />
          <ThemedText style={[styles.bannerText, { color: colors.olive }]}>{successMessage}</ThemedText>
        </View>
      )}

      <FieldLabel label="Email" colors={colors} />
      <TextInput
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        placeholder="you@example.com"
        placeholderTextColor={colors.placeholder}
        style={[
          styles.input,
          {
            color: colors.text,
            backgroundColor: colors.input,
            borderColor: colors.border,
          },
        ]}
      />

      <FieldLabel label="Password" colors={colors} />
      <TextInput
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        textContentType={isSignUp ? 'newPassword' : 'password'}
        placeholder={isSignUp ? 'Choose a password' : 'Your password'}
        placeholderTextColor={colors.placeholder}
        style={[
          styles.input,
          {
            color: colors.text,
            backgroundColor: colors.input,
            borderColor: colors.border,
          },
        ]}
      />
      {isSignUp && (
        <ThemedText style={[styles.fieldHint, { color: colors.textSecondary, fontFamily: Fonts.rounded }]}>
          At least 6 characters
        </ThemedText>
      )}

      <Pressable
        onPress={handleSubmit}
        disabled={isSubmitting}
        accessibilityRole="button"
        accessibilityLabel={isSignUp ? 'Create my shelf' : 'Sign in'}
        style={({ pressed }) => [
          styles.primaryButton,
          { backgroundColor: colors.primary },
          (pressed || isSubmitting) && { backgroundColor: colors.primaryPressed },
          isSubmitting && styles.buttonDisabled,
        ]}>
        {isSubmitting ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <ThemedText style={[styles.primaryButtonText, { color: colors.onPrimary, fontFamily: Fonts.rounded }]}>
            {isSignUp ? 'Create my shelf' : 'Sign in'}
          </ThemedText>
        )}
      </Pressable>

      {isSignUp ? (
        <Pressable
          onPress={() => switchMode('sign-in')}
          disabled={isSubmitting}
          accessibilityRole="button"
          accessibilityLabel="Sign in to existing account"
          style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}>
          <ThemedText style={[styles.linkButtonText, { color: colors.textSecondary, fontFamily: Fonts.rounded }]}>
            Already have an account?{' '}
            <ThemedText style={{ color: colors.primary, fontWeight: '600' }}>Sign in</ThemedText>
          </ThemedText>
        </Pressable>
      ) : (
        <>
          <Pressable
            onPress={handleResetPassword}
            disabled={isSubmitting}
            accessibilityRole="button"
            accessibilityLabel="Forgot password"
            style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}>
            <ThemedText style={[styles.linkButtonText, { color: colors.primary, fontFamily: Fonts.rounded }]}>
              Forgot password?
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={() => switchMode('sign-up')}
            disabled={isSubmitting}
            accessibilityRole="button"
            accessibilityLabel="Create a new account"
            style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}>
            <ThemedText style={[styles.linkButtonText, { color: colors.textSecondary, fontFamily: Fonts.rounded }]}>
              New here?{' '}
              <ThemedText style={{ color: colors.primary, fontWeight: '600' }}>Create an account</ThemedText>
            </ThemedText>
          </Pressable>
        </>
      )}
    </View>
  );
}

function SignedInView({
  colors,
  colorScheme,
  email,
}: {
  colors: ThemeColors;
  colorScheme: ColorScheme;
  email: string;
}) {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSignOut = async () => {
    if (isSigningOut || isDeleting) {
      return;
    }

    setErrorMessage(null);
    setIsSigningOut(true);

    try {
      await signOutUser();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSigningOut(false);
    }
  };

  const confirmDeleteAccount = () => {
    Alert.alert(
      'Delete account?',
      'This permanently deletes your Shelfie account and all synced books. Local books on this device will stay.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: () => {
            void handleDeleteAccount();
          },
        },
      ],
    );
  };

  const handleDeleteAccount = async () => {
    if (isSigningOut || isDeleting) {
      return;
    }

    setErrorMessage(null);
    setIsDeleting(true);

    try {
      await deleteAccount();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Something went wrong. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <View style={[styles.card, styles.authCard, cardStyle(colorScheme)]}>
      <ThemedText
        style={[
          styles.cardTitle,
          { color: colors.text, fontFamily: Fonts.serif, textAlign: 'center' },
        ]}>
        Your account
      </ThemedText>

      <View style={[styles.emailRow, { backgroundColor: colors.input, borderColor: colors.border }]}>
        <Ionicons name="mail-outline" size={20} color={colors.textSecondary} />
        <ThemedText style={[styles.emailText, { color: colors.text }]}>{email}</ThemedText>
      </View>

      {errorMessage && (
        <View style={[styles.banner, { backgroundColor: colors.input, borderColor: colors.danger }]}>
          <Ionicons name="alert-circle-outline" size={20} color={colors.danger} />
          <ThemedText style={[styles.bannerText, { color: colors.danger }]}>{errorMessage}</ThemedText>
        </View>
      )}

      <Pressable
        onPress={handleSignOut}
        disabled={isSigningOut || isDeleting}
        accessibilityRole="button"
        accessibilityLabel="Sign out"
        style={({ pressed }) => [
          styles.primaryButton,
          { backgroundColor: colors.primary },
          (pressed || isSigningOut) && { backgroundColor: colors.primaryPressed },
          (isSigningOut || isDeleting) && styles.buttonDisabled,
        ]}>
        {isSigningOut ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <ThemedText style={[styles.primaryButtonText, { color: colors.onPrimary, fontFamily: Fonts.rounded }]}>
            Sign Out
          </ThemedText>
        )}
      </Pressable>

      <Pressable
        onPress={confirmDeleteAccount}
        disabled={isSigningOut || isDeleting}
        accessibilityRole="button"
        accessibilityLabel="Delete account"
        style={({ pressed }) => [
          styles.dangerButton,
          { borderColor: colors.danger },
          pressed && styles.pressed,
          (isSigningOut || isDeleting) && styles.buttonDisabled,
        ]}>
        {isDeleting ? (
          <ActivityIndicator color={colors.danger} />
        ) : (
          <>
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
            <ThemedText style={[styles.dangerButtonText, { color: colors.danger, fontFamily: Fonts.rounded }]}>
              Delete Account
            </ThemedText>
          </>
        )}
      </Pressable>
    </View>
  );
}

export default function ProfileScreen() {
  const colorScheme = (useColorScheme() ?? 'light') as ColorScheme;
  const colors = palette[colorScheme];
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { user, isLoading } = useAuth();

  const promptLocalBookMigration = useCallback((uid: string, count: number) => {
    if (count === 0) {
      return;
    }

    InteractionManager.runAfterInteractions(() => {
      Alert.alert(
        `Upload your ${count} local book${count === 1 ? '' : 's'} to your account?`,
        undefined,
        [
          { text: 'Not now', style: 'cancel' },
          {
            text: 'Upload',
            onPress: () => {
              void migrateLocalBooksToCloud(uid);
            },
          },
        ],
      );
    });
  }, []);

  const isPad = Platform.OS === 'ios' && Platform.isPad;
  const isTablet = isTabletLayout(width, { isPad });
  const isSignedOut = !isLoading && !user;
  const signedOutVerticalBias = Math.min(height * 0.06, 72);
  const { columnWidth } = useScreenLayout();
  const authColumnWidth = Math.min(columnWidth, AUTH_CARD_MAX_WIDTH);

  return (
    <ThemedView style={[styles.screen, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            isSignedOut && styles.signedOutScrollContent,
            {
              paddingTop: insets.top + 16,
              paddingBottom: insets.bottom + 24,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <ScreenContainer style={isSignedOut ? styles.authScreenContent : undefined}>
            <ProfileHeader colors={colors} isTablet={isTablet} onBack={() => router.back()} />

            {isLoading ? (
              <View style={[styles.authPanel, isSignedOut && styles.authPanelCentered]}>
                <View style={[styles.authCardWrap, { width: authColumnWidth }]}>
                  <View style={styles.loadingWrap}>
                    <ActivityIndicator size="large" color={colors.primary} />
                  </View>
                </View>
              </View>
            ) : user ? (
              <View style={styles.authPanel}>
                <View style={[styles.authCardWrap, { width: authColumnWidth }]}>
                  <SignedInView colors={colors} colorScheme={colorScheme} email={user.email ?? 'Signed in'} />
                </View>
              </View>
            ) : (
              <View style={[styles.authPanel, styles.authPanelCentered, { paddingBottom: signedOutVerticalBias }]}>
                <View style={[styles.authCardWrap, { width: authColumnWidth }]}>
                  <SignedOutView
                    colors={colors}
                    colorScheme={colorScheme}
                    onAuthSuccess={promptLocalBookMigration}
                  />
                </View>
              </View>
            )}
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
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
  },
  signedOutScrollContent: {
    flexGrow: 1,
  },
  authScreenContent: {
    flex: 1,
  },
  authPanel: {
    width: '100%',
  },
  authCardWrap: {
    alignSelf: 'center',
  },
  authPanelCentered: {
    flex: 1,
    justifyContent: 'center',
  },
  headerBlock: {
    marginBottom: 20,
  },
  headerBlockCentered: {
    alignItems: 'center',
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  headerTopSpacer: {
    flex: 1,
  },
  headerIconButton: {
    padding: 4,
  },
  greeting: {
    fontSize: 28,
    lineHeight: 34,
  },
  greetingTablet: {
    fontSize: 36,
    lineHeight: 42,
  },
  loadingWrap: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  card: {
    padding: 20,
    gap: 4,
  },
  authCard: {
    width: '100%',
  },
  authHero: {
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 22,
    lineHeight: 28,
    marginBottom: 6,
  },
  cardSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: radii.input,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 8,
    marginBottom: 4,
  },
  bannerText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: radii.input,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    lineHeight: 22,
  },
  fieldHint: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  primaryButton: {
    marginTop: 16,
    borderRadius: radii.button,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '700',
  },
  linkButton: {
    alignSelf: 'center',
    marginTop: 12,
    paddingVertical: 8,
  },
  linkButtonText: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: radii.input,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginTop: 8,
  },
  emailText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
  },
  dangerButton: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: radii.button,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dangerButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  pressed: {
    opacity: 0.85,
  },
});
