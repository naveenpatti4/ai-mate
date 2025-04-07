import React, { useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, SafeAreaView, ScrollView, Platform, Animated, Dimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { fonts, colors } from '../components/GlobalStyles';

export default function LandingScreen({ navigation }: any) {
  // Animation values
  const fadeAnim = new Animated.Value(0);
  const slideAnim = new Animated.Value(30);
  const scaleAnim = new Animated.Value(0.9);

  useEffect(() => {
    // Start animations when component mounts
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true
      })
    ]).start();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Animated.View 
          style={[
            styles.heroSection,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }, { scale: scaleAnim }]
            }
          ]}
        >
          <View style={styles.logoContainer}>
            <Ionicons name="wallet" size={48} color="#fff" />
            <Text style={styles.logo}>AIMate Finance</Text>
          </View>
          <Text style={styles.heroTitle}>Smart Finance Management</Text>
          <Text style={styles.heroSubtitle}>
            Track expenses, save money, and achieve your financial goals with personalized AI assistance.
          </Text>
          
          <View style={styles.featureRow}>
            <View style={styles.featureItem}>
              <View style={[styles.featureIcon, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                <Ionicons name="receipt-outline" size={24} color="#fff" />
              </View>
              <Text style={styles.featureLabel}>Track Expenses</Text>
            </View>
            <View style={styles.featureItem}>
              <View style={[styles.featureIcon, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                <Ionicons name="analytics-outline" size={24} color="#fff" />
              </View>
              <Text style={styles.featureLabel}>Smart Analytics</Text>
            </View>
            <View style={styles.featureItem}>
              <View style={[styles.featureIcon, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                <Ionicons name="people-outline" size={24} color="#fff" />
              </View>
              <Text style={styles.featureLabel}>Share Expenses</Text>
            </View>
          </View>
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={styles.signInButton} 
              onPress={() => navigation.navigate('SignIn')}
              activeOpacity={0.8}
            >
              <Ionicons name="log-in-outline" size={20} color={colors.primary} style={styles.buttonIcon} />
              <Text style={styles.signInButtonText}>Sign In</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.signUpButton} 
              onPress={() => navigation.navigate('SignUp')}
              activeOpacity={0.8}
            >
              <Ionicons name="person-add-outline" size={20} color="#fff" style={styles.buttonIcon} />
              <Text style={styles.signUpButtonText}>Create Account</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.footerContainer}>
            <Text style={styles.footerText}>Powered by AI</Text>
            <Ionicons name="flash-outline" size={16} color="rgba(255,255,255,0.7)" />
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: 30,
  },
  heroSection: {
    padding: 24,
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 40,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    fontSize: fonts.size.xxl,
    fontWeight: fonts.weight.bold,
    color: '#fff',
    marginLeft: 12,
    fontFamily: fonts.primary,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: fonts.weight.bold,
    color: '#fff',
    marginBottom: 16,
    textAlign: 'center',
    fontFamily: fonts.primary,
  },
  heroSubtitle: {
    fontSize: fonts.size.regular,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 40,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: width * 0.8,
    fontFamily: fonts.primary,
  },
  featureRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 40,
  },
  featureItem: {
    alignItems: 'center',
  },
  featureIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  featureLabel: {
    fontSize: fonts.size.medium,
    color: '#fff',
    fontWeight: fonts.weight.medium,
    fontFamily: fonts.primary,
  },
  buttonContainer: {
    width: '100%',
    marginBottom: 20,
  },
  buttonIcon: {
    marginRight: 8,
  },
  signInButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 15,
    flexDirection: 'row',
    justifyContent: 'center',
    shadowColor: 'rgba(0,0,0,0.3)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  signInButtonText: {
    color: colors.primary,
    fontSize: fonts.size.regular,
    fontWeight: fonts.weight.bold,
    fontFamily: fonts.primary,
  },
  signUpButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  signUpButtonText: {
    color: '#fff',
    fontSize: fonts.size.regular,
    fontWeight: fonts.weight.bold,
    fontFamily: fonts.primary,
  },
  footerContainer: {
    marginTop: 40,
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerText: {
    fontSize: fonts.size.small,
    color: 'rgba(255,255,255,0.7)',
    marginRight: 6,
    fontFamily: fonts.primary,
  },
});