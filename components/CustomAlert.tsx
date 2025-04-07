import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Platform,
  Dimensions
} from 'react-native';

interface CustomAlertProps {
  visible: boolean;
  title: string;
  message: string;
  buttons?: Array<{
    text: string;
    onPress?: () => void;
    style?: 'default' | 'cancel' | 'destructive';
  }>;
  onDismiss?: () => void;
}

const CustomAlert: React.FC<CustomAlertProps> = ({
  visible,
  title,
  message,
  buttons = [{ text: 'OK' }],
  onDismiss
}) => {
  const handleButtonPress = (button: { text: string; onPress?: () => void }) => {
    if (button.onPress) {
      button.onPress();
    }
    if (onDismiss) {
      onDismiss();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <View style={styles.alertBox}>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>{title}</Text>
          </View>
          <View style={styles.messageContainer}>
            <Text style={styles.message}>{message}</Text>
          </View>
          <View style={styles.buttonContainer}>
            {buttons.map((button, index) => {
              const isDestructive = button.style === 'destructive';
              const isCancel = button.style === 'cancel';
              
              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.button,
                    buttons.length > 1 && index < buttons.length - 1 && styles.buttonBorder,
                    isDestructive && styles.destructiveButton,
                    isCancel && styles.cancelButton
                  ]}
                  onPress={() => handleButtonPress(button)}
                >
                  <Text 
                    style={[
                      styles.buttonText, 
                      isDestructive && styles.destructiveText,
                      isCancel && styles.cancelText
                    ]}
                  >
                    {button.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
};

// Create a component-based alert system
interface AlertInterface {
  show: (options: {
    title: string;
    message: string;
    buttons?: Array<{
      text: string;
      onPress?: () => void;
      style?: 'default' | 'cancel' | 'destructive';
    }>;
  }) => void;
  alert: (title: string, message: string, onPress?: () => void) => void;
}

// Singleton instance for the alert manager
export const AlertManager: AlertInterface = {
  _ref: null,

  show: (options) => {
    // For web, fall back to browser alert in case the component isn't mounted
    if (Platform.OS === 'web' && !global.__alertManagerRef) {
      window.alert(`${options.title}\n\n${options.message}`);
      if (options.buttons && options.buttons.length > 0 && options.buttons[0].onPress) {
        options.buttons[0].onPress();
      }
      return;
    }

    if (global.__alertManagerRef) {
      global.__alertManagerRef.show(options);
    }
  },

  alert: (title, message, onPress) => {
    AlertManager.show({
      title,
      message,
      buttons: [{ text: 'OK', onPress: onPress }]
    });
  }
};

// Add a provider component that will render the actual alerts
export class AlertProvider extends React.Component {
  state = {
    visible: false,
    title: '',
    message: '',
    buttons: [{ text: 'OK' }],
  };

  constructor(props) {
    super(props);
    global.__alertManagerRef = this;
  }

  componentWillUnmount() {
    global.__alertManagerRef = null;
  }

  show = (options) => {
    this.setState({
      visible: true,
      title: options.title,
      message: options.message,
      buttons: options.buttons || [{ text: 'OK' }]
    });
  };

  dismiss = () => {
    this.setState({ visible: false });
  };

  render() {
    return (
      <>
        {this.props.children}
        <CustomAlert
          visible={this.state.visible}
          title={this.state.title}
          message={this.state.message}
          buttons={this.state.buttons}
          onDismiss={this.dismiss}
        />
      </>
    );
  }
}

const { width } = Dimensions.get('window');
const alertWidth = Math.min(300, width * 0.8);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertBox: {
    width: alertWidth,
    backgroundColor: 'white',
    borderRadius: 10,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  titleContainer: {
    padding: 16,
    paddingBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  messageContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  message: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  buttonContainer: {
    borderTopWidth: 1,
    borderTopColor: '#e1e1e1',
  },
  button: {
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#e1e1e1',
  },
  buttonText: {
    fontSize: 16,
    color: '#4a86f7',
    fontWeight: '600',
  },
  destructiveButton: {
    backgroundColor: 'rgba(255, 59, 48, 0.05)',
  },
  destructiveText: {
    color: '#ff3b30',
  },
  cancelButton: {
    backgroundColor: '#f9f9f9',
  },
  cancelText: {
    fontWeight: '500',
  }
});

export default CustomAlert;