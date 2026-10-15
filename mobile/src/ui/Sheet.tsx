import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SPACE } from '../constants/theme';
import { usePOS } from '../context/POSContext';
import { PrivacyCover } from '../components/PrivacyCover';
import { AppText, IconButton } from './primitives';

/**
 * Standard bottom sheet: title + close, scrolling body, actions pinned at the bottom.
 * Touches count as activity for the auto-lock, and the privacy cover sits above the content.
 */
export function Sheet({
  visible,
  title,
  subtitle,
  onClose,
  children,
  footer,
  dismissOnBackdrop = true,
  testID,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Pinned actions (usually Cancel + primary) */
  footer?: React.ReactNode;
  dismissOnBackdrop?: boolean;
  testID?: string;
}) {
  const { markActivity } = usePOS();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Drawn edge to edge: the sheet keeps clear of the status bar and ends above the navigation bar */}
        <View style={[styles.overlay, { paddingTop: insets.top }]} onTouchStart={markActivity}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={dismissOnBackdrop ? onClose : undefined}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
          <View style={[styles.sheet, { paddingBottom: insets.bottom }]} testID={testID} accessibilityViewIsModal>
            <View style={styles.grabber} />
            <View style={styles.header}>
              <View style={styles.flex}>
                <AppText variant="title" numberOfLines={2}>
                  {title}
                </AppText>
                {subtitle ? (
                  <AppText variant="caption" tone="muted" numberOfLines={2}>
                    {subtitle}
                  </AppText>
                ) : null}
              </View>
              <IconButton icon="x" label="Close" onPress={onClose} testID="sheet-close" />
            </View>
            <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
              {children}
            </ScrollView>
            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </View>
        </View>
      </KeyboardAvoidingView>
      <PrivacyCover />
    </Modal>
  );
}

/** Footer layout: secondary action left (shrinks), primary right (grows). */
export function SheetActions({ children }: { children: React.ReactNode }) {
  return <View style={styles.actions}>{children}</View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    width: '100%',
    // Centred and not stretched across a landscape tablet
    maxWidth: 640,
    alignSelf: 'center',
    maxHeight: '92%',
    backgroundColor: COLORS.bgSecondary,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: COLORS.borderDefault,
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.borderStrong, marginTop: SPACE.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, paddingLeft: SPACE.xl, paddingRight: SPACE.sm, paddingTop: SPACE.sm },
  body: { flexGrow: 0 },
  bodyContent: { paddingHorizontal: SPACE.xl, paddingTop: SPACE.md, paddingBottom: SPACE.lg, gap: SPACE.md },
  footer: {
    paddingHorizontal: SPACE.xl,
    paddingTop: SPACE.md,
    paddingBottom: SPACE.xl,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSubtle,
    backgroundColor: COLORS.bgSecondary,
  },
  actions: { flexDirection: 'row', gap: SPACE.md },
});
