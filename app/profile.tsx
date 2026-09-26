import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { openBrowserAsync, WebBrowserPresentationStyle } from 'expo-web-browser';
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
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenContainer, screenScrollContentStyle, useScreenLayout } from '@/components/ScreenContainer';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { isTabletLayout } from '@/constants/cozy-theme';
import { PRIVACY_POLICY_URL } from '@/constants/legal';
import { Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  deleteAccount,
  mapAuthError,
  resendEmailVerification,
  resetPassword,
  signIn,
  signOutUser,
  signUp,
  useAuth,
} from '@/src/services/auth';
import { getLocalBookCount, migrateLocalBooksToCloud } from '@/src/services/bookMigration';
import {
  cardShadow,
  palette,
  radii,
  type ColorScheme,
  type ThemeColors,
} from '@/utils/theme';

async function openPrivacyPolicy() {
  await openBrowserAsync(PRIVACY_POLICY_URL, {
    presentationStyle: WebBrowserPresentationStyle.AUTOMATIC,
  });
}

type AuthMode = 'sign-in' | 'sign-up';

const AUTH_CARD_MAX_WIDTH = 440;

function ProfileHeader({
  colors,
  isTablet,
  onBack,
  showTitle = true,
}: {
  colors: ThemeColors;
  isTablet: boolean;
  onBack: () => void;
  showTitle?: boolean;
}) {
  return (
    <View style={[styles.headerBlock, !showTitle && styles.headerBlockCompact]}>
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
      {showTitle && (
        <ThemedText
          style={[
            isTablet ? styles.greetingTablet : styles.greeting,
            { color: colors.text, fontFamily: Fonts.serif, textAlign: isTablet ? 'center' : 'left' },
          ]}>
          Profile
        </ThemedText>
      )}
    </View>
  );
}

function AuthFeedback({
  message,
  tone,
  colors,
}: {
  message: string;
  tone: 'error' | 'success';
  colors: ThemeColors;
}) {
  return (
    <ThemedText
      style={[
        styles.feedbackText,
        { color: tone === 'error' ? colors.danger : colors.olive, fontFamily: Fonts.rounded },
      ]}>
      {message}
    </ThemedText>
  );
}

function AuthFieldGroup({
  email,
  password,
  isSignUp,
  isBusy,
  colors,
  colorScheme,
  onEmailChange,
  onPasswordChange,
}: {
  email: string;
  password: string;
  isSignUp: boolean;
  isBusy: boolean;
  colors: ThemeColors;
  colorScheme: ColorScheme;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
}) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <View style={[styles.fieldGroup, { backgroundColor: colors.card }, cardShadow(colorScheme)]}>
      <View style={styles.fieldRow}>
        <TextInput
          value={email}
          onChangeText={onEmailChange}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          placeholder="Email"
          placeholderTextColor={colors.placeholder}
          editable={!isBusy}
          style={[styles.fieldInput, { color: colors.text }]}
        />
      </View>

      <View style={[styles.fieldSeparator, { backgroundColor: colors.border }]} />

      <View style={styles.fieldRow}>
        <TextInput
          value={password}
          onChangeText={onPasswordChange}
          secureTextEntry={!showPassword}
          textContentType={isSignUp ? 'newPassword' : 'password'}
          placeholder={isSignUp ? 'Password' : 'Password'}
          placeholderTextColor={colors.placeholder}
          editable={!isBusy}
          style={[styles.fieldInput, styles.fieldInputWithIcon, { color: colors.text }]}
        />
        <Pressable
          onPress={() => setShowPassword((current) => !current)}
          disabled={isBusy}
          accessibilityRole="button"
          accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
          hitSlop={8}
          style={({ pressed }) => [styles.passwordToggle, pressed && styles.pressed]}>
          <Ionicons
            name={showPassword ? 'eye-off-outline' : 'eye-outline'}
            size={20}
            color={colors.textSecondary}
          />
        </Pressable>
      </View>
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
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isSignUp = mode === 'sign-up';
  const isBusy = isSubmitting || isResettingPassword;

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
        setSuccessMessage('Account created. Check your inbox to verify your email.');
        setPassword('');
        onAuthSuccess(user.uid, localBookCount);
        return;
      }

      const user = await signIn(email, password);
      setSuccessMessage('Signed in successfully.');
      onAuthSuccess(user.uid, localBookCount);
    } catch (error) {
      setErrorMessage(mapAuthError(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    if (isBusy) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsResettingPassword(true);

    try {
      await resetPassword(email);
      setSuccessMessage('Password reset email sent. Check your inbox.');
    } catch (error) {
      setErrorMessage(mapAuthError(error));
    } finally {
      setIsResettingPassword(false);
    }
  };

  return (
    <View style={styles.authSheet}>
      <Animated.View
        key={mode}
        entering={FadeInDown.springify().damping(20).stiffness(240)}
        exiting={FadeOut.duration(120)}
        style={styles.authAnimatedBlock}>
        <View style={styles.authIntro}>
          <ThemedText style={[styles.authTitle, { color: colors.text, fontFamily: Fonts.rounded }]}>
            Sync your shelf
          </ThemedText>
          <ThemedText style={[styles.authSubtitle, { color: colors.textSecondary, fontFamily: Fonts.rounded }]}>
            {isSignUp
              ? 'Create an account to back up your books across devices.'
              : 'Sign in to access your books anywhere.'}
          </ThemedText>
        </View>

        <AuthFieldGroup
          email={email}
          password={password}
          isSignUp={isSignUp}
          isBusy={isBusy}
          colors={colors}
          colorScheme={colorScheme}
          onEmailChange={setEmail}
          onPasswordChange={setPassword}
        />

        {errorMessage && <AuthFeedback message={errorMessage} tone="error" colors={colors} />}
        {successMessage && <AuthFeedback message={successMessage} tone="success" colors={colors} />}

        <Pressable
          onPress={handleSubmit}
          disabled={isBusy}
          accessibilityRole="button"
          accessibilityLabel={isSignUp ? 'Create my shelf' : 'Sign in'}
          style={({ pressed }) => [
            styles.authPrimaryButton,
            { backgroundColor: colors.primary },
            (pressed || isSubmitting) && { backgroundColor: colors.primaryPressed },
            isBusy && styles.buttonDisabled,
          ]}>
          {isSubmitting ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <ThemedText style={[styles.authPrimaryButtonText, { color: colors.onPrimary, fontFamily: Fonts.rounded }]}>
              {isSignUp ? 'Create my shelf' : 'Sign in'}
            </ThemedText>
          )}
        </Pressable>

        {isSignUp ? (
          <Pressable
            onPress={() => switchMode('sign-in')}
            disabled={isBusy}
            accessibilityRole="button"
            accessibilityLabel="Sign in to existing account"
            style={({ pressed }) => [styles.authLinkStandalone, pressed && !isBusy && styles.pressed]}>
            <ThemedText style={[styles.authLinkText, { color: colors.primary, fontFamily: Fonts.rounded }]}>
              Already have an account? Sign in
            </ThemedText>
          </Pressable>
        ) : (
          <View style={styles.authLinksGroup}>
            <Pressable
              onPress={handleResetPassword}
              disabled={isBusy}
              accessibilityRole="button"
              accessibilityLabel="Forgot password"
              style={({ pressed }) => [styles.authLinkButton, pressed && !isBusy && styles.pressed]}>
              {isResettingPassword ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <ThemedText style={[styles.authLinkText, { color: colors.primary, fontFamily: Fonts.rounded }]}>
                  Forgot password?
                </ThemedText>
              )}
            </Pressable>
            <Pressable
              onPress={() => switchMode('sign-up')}
              disabled={isBusy}
              accessibilityRole="button"
              accessibilityLabel="Create a new account"
              style={({ pressed }) => [styles.authLinkButton, pressed && !isBusy && styles.pressed]}>
              <ThemedText style={[styles.authLinkText, { color: colors.primary, fontFamily: Fonts.rounded }]}>
                Create an account
              </ThemedText>
            </Pressable>
          </View>
        )}

        <Pressable
          onPress={() => {
            void openPrivacyPolicy();
          }}
          disabled={isBusy}
          accessibilityRole="link"
          accessibilityLabel="Privacy policy"
          style={({ pressed }) => [styles.authLinkStandalone, pressed && !isBusy && styles.pressed]}>
          <ThemedText style={[styles.privacyLinkText, { color: colors.textSecondary, fontFamily: Fonts.rounded }]}>
            Privacy Policy
          </ThemedText>
        </Pressable>
      </Animated.View>
    </View>
  );
}

function SignedInView({
  colors,
  colorScheme,
  email,
  emailVerified,
  isTablet,
}: {
  colors: ThemeColors;
  colorScheme: ColorScheme;
  email: string;
  emailVerified: boolean;
  isTablet: boolean;
}) {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isResendingVerification, setIsResendingVerification] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isBusy = isSigningOut || isDeleting || isResendingVerification;

  const handleSignOut = async () => {
    if (isSigningOut || isDeleting) {
      return;
    }

    setErrorMessage(null);
    setIsSigningOut(true);

    try {
      await signOutUser();
    } catch (error) {
      setErrorMessage(mapAuthError(error));
    } finally {
      setIsSigningOut(false);
    }
  };

  const handleResendVerification = async () => {
    if (isBusy) {
      return;
    }

    setErrorMessage(null);
    setVerificationMessage(null);
    setIsResendingVerification(true);

    try {
      await resendEmailVerification();
      setVerificationMessage('Verification email sent. Check your inbox.');
    } catch (error) {
      setErrorMessage(mapAuthError(error));
    } finally {
      setIsResendingVerification(false);
    }
  };

  const confirmDeleteAccount = () => {
    if (isBusy) {
      return;
    }

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
      setErrorMessage(mapAuthError(error));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <View style={styles.signedInContent}>
      <ThemedText
        style={[
          styles.signedInTitle,
          { color: colors.text, fontFamily: Fonts.serif, textAlign: isTablet ? 'center' : 'left' },
        ]}>
        Your account
      </ThemedText>

      <View style={[styles.emailRow, { backgroundColor: colors.input, borderColor: colors.border }]}>
        <Ionicons name="mail-outline" size={20} color={colors.textSecondary} />
        <ThemedText style={[styles.emailText, { color: colors.text }]}>{email}</ThemedText>
      </View>

      {!emailVerified && (
        <View style={[styles.verifyRow, { backgroundColor: colors.input, borderColor: colors.border }]}>
          <ThemedText style={[styles.verifyText, { color: colors.textSecondary, fontFamily: Fonts.rounded }]}>
            Verify your email — check your inbox
          </ThemedText>
          <Pressable
            onPress={() => {
              void handleResendVerification();
            }}
            disabled={isBusy}
            accessibilityRole="button"
            accessibilityLabel="Resend verification email"
            style={({ pressed }) => [styles.verifyResendButton, pressed && !isBusy && styles.pressed]}>
            {isResendingVerification ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <ThemedText style={[styles.verifyResendText, { color: colors.primary, fontFamily: Fonts.rounded }]}>
                Resend
              </ThemedText>
            )}
          </Pressable>
        </View>
      )}

      {verificationMessage && (
        <View style={[styles.banner, { backgroundColor: colors.input, borderColor: colors.olive }]}>
          <Ionicons name="checkmark-circle-outline" size={20} color={colors.olive} />
          <ThemedText style={[styles.bannerText, { color: colors.olive }]}>{verificationMessage}</ThemedText>
        </View>
      )}

      {errorMessage && (
        <View style={[styles.banner, { backgroundColor: colors.input, borderColor: colors.danger }]}>
          <Ionicons name="alert-circle-outline" size={20} color={colors.danger} />
          <ThemedText style={[styles.bannerText, { color: colors.danger }]}>{errorMessage}</ThemedText>
        </View>
      )}

      <Pressable
        onPress={handleSignOut}
        disabled={isBusy}
        accessibilityRole="button"
        accessibilityLabel="Sign out"
        style={({ pressed }) => [
          styles.primaryButton,
          { backgroundColor: colors.primary },
          (pressed || isSigningOut) && { backgroundColor: colors.primaryPressed },
          isBusy && styles.buttonDisabled,
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
        disabled={isBusy}
        accessibilityRole="button"
        accessibilityLabel="Delete account"
        style={({ pressed }) => [
          styles.dangerButton,
          { borderColor: colors.danger },
          pressed && !isBusy && styles.pressed,
          isBusy && styles.buttonDisabled,
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

      <Pressable
        onPress={() => {
          void openPrivacyPolicy();
        }}
        disabled={isBusy}
        accessibilityRole="link"
        accessibilityLabel="Privacy policy"
        style={({ pressed }) => [styles.privacyLinkButton, pressed && !isBusy && styles.pressed]}>
        <ThemedText style={[styles.privacyLinkText, { color: colors.textSecondary, fontFamily: Fonts.rounded }]}>
          Privacy Policy
        </ThemedText>
      </Pressable>
    </View>
  );
}

export default function ProfileScreen() {
  const colorScheme = (useColorScheme() ?? 'light') as ColorScheme;
  const colors = palette[colorScheme];
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { user, isLoading, refreshUser } = useAuth();

  useFocusEffect(
    useCallback(() => {
      if (user) {
        void refreshUser();
      }
    }, [refreshUser, user]),
  );

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
  const authFormWidth = Math.min(columnWidth, AUTH_CARD_MAX_WIDTH);

  return (
    <ThemedView style={[styles.screen, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[
            screenScrollContentStyle,
            isSignedOut && styles.signedOutScrollContent,
            {
              paddingTop: insets.top + 16,
              paddingBottom: insets.bottom + 24,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <ScreenContainer style={isSignedOut ? styles.authScreenContent : undefined}>
            <ProfileHeader
              colors={colors}
              isTablet={isTablet}
              showTitle={!isSignedOut}
              onBack={() => router.back()}
            />

            {isLoading ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : user ? (
              <SignedInView
                colors={colors}
                colorScheme={colorScheme}
                email={user.email ?? 'Signed in'}
                emailVerified={user.emailVerified}
                isTablet={isTablet}
              />
            ) : (
              <View style={[styles.signedOutPanel, { paddingBottom: signedOutVerticalBias }]}>
                <View style={[styles.authFormColumn, { width: authFormWidth }]}>
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
  signedOutScrollContent: {
    flexGrow: 1,
  },
  authScreenContent: {
    flex: 1,
  },
  signedOutPanel: {
    flex: 1,
    justifyContent: 'center',
    width: '100%',
  },
  authFormColumn: {
    alignSelf: 'center',
    width: '100%',
  },
  headerBlock: {
    marginBottom: 20,
    width: '100%',
  },
  headerBlockCompact: {
    marginBottom: 8,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    width: '100%',
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
  authSheet: {
    width: '100%',
    paddingTop: 8,
  },
  authAnimatedBlock: {
    width: '100%',
    gap: 0,
  },
  authIntro: {
    marginBottom: 36,
    gap: 10,
  },
  authTitle: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  authSubtitle: {
    fontSize: 17,
    lineHeight: 24,
    maxWidth: 320,
  },
  fieldGroup: {
    borderRadius: radii.input,
    overflow: 'hidden',
    marginBottom: 8,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 50,
    paddingHorizontal: 16,
  },
  fieldSeparator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 16,
  },
  fieldInput: {
    flex: 1,
    fontSize: 17,
    lineHeight: 22,
    paddingVertical: 14,
  },
  fieldInputWithIcon: {
    paddingRight: 8,
  },
  passwordToggle: {
    padding: 6,
  },
  feedbackText: {
    fontSize: 15,
    lineHeight: 21,
    marginTop: 12,
    marginBottom: 4,
  },
  authPrimaryButton: {
    marginTop: 28,
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authPrimaryButtonText: {
    fontSize: 17,
    fontWeight: '600',
  },
  authLinksGroup: {
    marginTop: 20,
    gap: 16,
    alignItems: 'center',
  },
  authLinkButton: {
    paddingVertical: 6,
  },
  authLinkStandalone: {
    marginTop: 20,
    paddingVertical: 6,
    alignSelf: 'center',
  },
  authLinkText: {
    fontSize: 17,
    lineHeight: 22,
    textAlign: 'center',
    fontWeight: '400',
  },
  signedInContent: {
    width: '100%',
    gap: 4,
  },
  signedInTitle: {
    fontSize: 22,
    lineHeight: 28,
    marginBottom: 12,
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
  verifyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderWidth: 1,
    borderRadius: radii.input,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 10,
  },
  verifyText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  verifyResendButton: {
    paddingVertical: 2,
    paddingHorizontal: 4,
    minWidth: 56,
    alignItems: 'center',
  },
  verifyResendText: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
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
  privacyLinkButton: {
    marginTop: 18,
    paddingVertical: 6,
    alignSelf: 'center',
  },
  privacyLinkText: {
    fontSize: 14,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  pressed: {
    opacity: 0.85,
  },
});
