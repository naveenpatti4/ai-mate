import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  TextInput, 
  StyleSheet, 
  Text, 
  TouchableOpacity, 
  Platform, 
  KeyboardAvoidingView, 
  SafeAreaView, 
  Animated,
  StatusBar,
  ScrollView
} from 'react-native';
import { supabase } from '../supabaseClient';
import { AlertManager } from '../components/CustomAlert';
import { Ionicons } from '@expo/vector-icons';
import { fonts, colors, inputStyles, buttonStyles } from '../components/GlobalStyles';

export default function SignUpScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [secureTextEntry, setSecureTextEntry] = useState(true);
  const [secureConfirmTextEntry, setSecureConfirmTextEntry] = useState(true);
  
  // Animation values with useRef to persist across renders
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    // Start animations when component mounts
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true
      })
    ]).start();
  }, []);

  async function handleSignUp() {
    if (!email || !password || !confirmPassword || !fullName) {
      AlertManager.alert('Missing fields', 'Please fill in all fields.');
      return;
    }

    if (password !== confirmPassword) {
      AlertManager.alert('Password Error', 'Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      AlertManager.alert('Password Error', 'Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);

    try {
      // Trimming email and full name
      const trimmedEmail = email.trim();
      const trimmedName = fullName.trim();

      // Sign up the user
      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: {
            full_name: trimmedName
          }
        }
      });

      if (error) {
        AlertManager.alert('Sign up error', error.message);
        return;
      }
      
      // Create profile in profiles table
      if (data && data.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({
            id: data.user.id,
            full_name: trimmedName,
            updated_at: new Date().toISOString()
          });
          
        if (profileError) {
          console.error('Error creating profile:', profileError);
          AlertManager.alert('Profile Error', 'There was an issue setting up your profile. You can update it later in settings.');
          // Continue with sign up flow even if profile creation fails
        }
      }
      
      AlertManager.alert(
        'Check your email', 
        'We\'ve sent you a confirmation link to complete your sign up.', 
        () => navigation.navigate('SignIn')
      );
      
    } catch (error) {
      console.error('Unexpected error:', error);
      AlertManager.alert('Sign Up Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <Animated.View 
            style={[
              styles.card,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }]
              }
            ]}
          >
            <View style={styles.logoContainer}>
              <Ionicons name="wallet" size={48} color={colors.primary} />
            </View>
            
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join our community today</Text>
            
            {/* Full Name Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Full Name</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="person-outline" size={20} color="#888" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Your full name"
                  value={fullName}
                  onChangeText={setFullName}
                  autoCapitalize="words"
                  placeholderTextColor="#BDBDBD"
                />
              </View>
            </View>
            
            {/* Email Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Email</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="mail-outline" size={20} color="#888" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="your@email.com"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholderTextColor="#BDBDBD"
                />
              </View>
            </View>
            
            {/* Password Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Password</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={20} color="#888" style={styles.inputIcon} />
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Create a password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={secureTextEntry}
                  placeholderTextColor="#BDBDBD"
                />
                <TouchableOpacity 
                  style={styles.passwordToggle}
                  onPress={() => setSecureTextEntry(!secureTextEntry)}
                >
                  <Ionicons 
                    name={secureTextEntry ? "eye-outline" : "eye-off-outline"} 
                    size={20} 
                    color="#888" 
                  />
                </TouchableOpacity>
              </View>
              <Text style={styles.passwordHint}>At least 6 characters required</Text>
            </View>
            
            {/* Confirm Password Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Confirm Password</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={20} color="#888" style={styles.inputIcon} />
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={secureConfirmTextEntry}
                  placeholderTextColor="#BDBDBD"
                />
                <TouchableOpacity 
                  style={styles.passwordToggle}
                  onPress={() => setSecureConfirmTextEntry(!secureConfirmTextEntry)}
                >
                  <Ionicons 
                    name={secureConfirmTextEntry ? "eye-outline" : "eye-off-outline"} 
                    size={20} 
                    color="#888" 
                  />
                </TouchableOpacity>
              </View>
            </View>
            
            {/* Sign Up Button */}
            <TouchableOpacity 
              style={[styles.button, loading && styles.buttonDisabled]} 
              onPress={handleSignUp}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <View style={styles.loadingContainer}>
                  <Ionicons name="sync" size={20} color="#fff" style={styles.loadingIcon} />
                  <Text style={styles.buttonText}>Creating Account...</Text>
                </View>
              ) : (
                <Text style={styles.buttonText}>Create Account</Text>
              )}
            </TouchableOpacity>
            
            {/* Sign In Link */}
            <TouchableOpacity 
              onPress={() => navigation.navigate('SignIn')}
              style={styles.linkButton}
            >
              <Text style={styles.linkText}>
                Already have an account? <Text style={styles.linkTextBold}>Sign In</Text>
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    paddingTop: 50,
  },
  backButton: {
    position: 'absolute',
    top: 20,
    left: 20,
    zIndex: 10,
    padding: 8,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: fonts.size.xl,
    fontWeight: fonts.weight.bold,
    color: colors.text.primary,
    textAlign: 'center',
    fontFamily: fonts.primary,
  },
  subtitle: {
    fontSize: fonts.size.regular,
    color: colors.text.secondary,
    marginBottom: 30,
    textAlign: 'center',
    fontFamily: fonts.primary,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: fonts.size.medium,
    fontWeight: fonts.weight.semibold,
    marginBottom: 8,
    color: colors.text.primary,
    fontFamily: fonts.primary,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: fonts.size.regular,
    color: colors.text.primary,
    fontFamily: fonts.primary,
    outlineStyle: 'none', // Remove focus outline on web
  },
  passwordInput: {
    flex: 1,
    height: '100%',
    fontSize: fonts.size.regular,
    color: colors.text.primary,
    fontFamily: fonts.primary,
    outlineStyle: 'none', // Remove focus outline on web
  },
  passwordToggle: {
    padding: 8,
  },
  passwordHint: {
    fontSize: fonts.size.small,
    color: colors.text.muted,
    marginTop: 6,
    fontFamily: fonts.primary,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: fonts.size.regular,
    fontWeight: fonts.weight.bold,
    fontFamily: fonts.primary,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingIcon: {
    marginRight: 8,
  },
  linkButton: {
    alignItems: 'center',
    marginTop: 24,
    padding: 10,
  },
  linkText: {
    color: colors.text.secondary,
    fontSize: fonts.size.medium,
    fontFamily: fonts.primary,
  },
  linkTextBold: {
    fontWeight: fonts.weight.bold,
    color: colors.primary,
    fontFamily: fonts.primary,
  },
});