import { Alert, Platform } from 'react-native';
import { requestConfirmation } from './confirmationBroker';

export function confirmAction(title: string, message: string, confirmLabel = 'Conferma'): Promise<boolean> {
  if (Platform.OS === 'web') {
    return requestConfirmation(title, message, confirmLabel);
  }
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: 'Annulla', style: 'cancel', onPress: () => resolve(false) },
        { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}
