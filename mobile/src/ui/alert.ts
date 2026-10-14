import { Alert as NativeAlert, AlertButton, Platform } from 'react-native';

/**
 * Drop-in for React Native's Alert. On phones it is the native dialog; on the web build (where
 * React Native's Alert does nothing) it falls back to the browser's confirm/alert so confirmations still work.
 */
export const Alert = {
  alert(title: string, message?: string, buttons?: AlertButton[]) {
    if (Platform.OS !== 'web') {
      NativeAlert.alert(title, message, buttons);
      return;
    }
    const text = message ? `${title}\n\n${message}` : title;
    const actions = (buttons ?? []).filter((b) => b.style !== 'cancel');
    const cancel = (buttons ?? []).find((b) => b.style === 'cancel');
    if (buttons && buttons.length > 1 && actions.length > 0) {
      // Two-choice dialog: OK runs the (last) action button, Cancel runs the cancel button
      if (window.confirm(text)) actions[actions.length - 1].onPress?.();
      else cancel?.onPress?.();
      return;
    }
    window.alert(text);
    (actions[0] ?? cancel)?.onPress?.();
  },
};
