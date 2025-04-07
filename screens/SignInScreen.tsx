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
  Image, 
  Animated,
  StatusBar 
} from 'react-native';
import { supabase } from '../supabaseClient';
import { AlertManager } from '../components/CustomAlert';
import { Ionicons } from '@expo/vector-icons';
import { fonts, colors, inputStyles, buttonStyles } from '../components/GlobalStyles';

export default function SignInScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [secureTextEntry, setSecureTextEntry] = useState(true);
  
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

  async function handleSignIn() {
    if (!email || !password) {
      AlertManager.alert('Missing fields', 'Please fill in all fields.');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        AlertManager.alert('Sign In Error', error.message);
        return;
      }
      
      // Ensure profile exists for this user
      if (data && data.user) {
        // First try to get the existing profile
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id, full_name')
          .eq('id', data.user.id)
          .maybeSingle();
          
        // Get user metadata for name if available
        const userFullName = data.user.user_metadata?.full_name;
        
        if (!existingProfile) {
          // No profile exists, create one using name from metadata or email
          const displayName = userFullName || email.split('@')[0];
          
          const { error: profileError } = await supabase
            .from('profiles')
            .upsert({
              id: data.user.id,
              full_name: displayName,
              updated_at: new Date().toISOString()
            });
            
          if (profileError) {
            console.error('Error creating profile:', profileError);
            // Continue even if profile creation fails - they can create it later
          }
        } else if (userFullName && !existingProfile.full_name) {
          // Profile exists but name is missing, update it from metadata
          const { error: updateError } = await supabase
            .from('profiles')
            .update({ 
              full_name: userFullName,
              updated_at: new Date().toISOString() 
            })
            .eq('id', data.user.id);
            
          if (updateError) {
            console.error('Error updating profile:', updateError);
          }
        }
      }
      
      // No need for an alert on success as the app will navigate automatically
    } catch (error) {
      console.error('Unexpected error:', error);
      AlertManager.alert('Sign In Error', 'An unexpected error occurred. Please try again.');
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
          
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Sign in to your account</Text>
          
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
          
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Password</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={20} color="#888" style={styles.inputIcon} />
              <TextInput
                style={styles.passwordInput}
                placeholder="Your password"
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
          </View>
          
          <TouchableOpacity 
            style={[styles.button, loading && styles.buttonDisabled]} 
            onPress={handleSignIn}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <View style={styles.loadingContainer}>
                <Ionicons name="sync" size={20} color="#fff" style={styles.loadingIcon} />
                <Text style={styles.buttonText}>Signing In...</Text>
              </View>
            ) : (
              <Text style={styles.buttonText}>Sign In</Text>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            onPress={() => navigation.navigate('SignUp')}
            style={styles.linkButton}
          >
            <Text style={styles.linkText}>
              Don't have an account? <Text style={styles.linkTextBold}>Sign Up</Text>
            </Text>
          </TouchableOpacity>
        </Animated.View>
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
    justifyContent: 'center',
    padding: 20,
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
  logo: {
    width: 80,
    height: 80,
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