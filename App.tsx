import 'react-native-gesture-handler'; // Must be at the top
import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { Session } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';
import LandingScreen from './screens/LandingScreen';
import SignInScreen from './screens/SignInScreen';
import SignUpScreen from './screens/SignUpScreen';
import HomeScreen from './screens/HomeScreen'; // Your main app screen after login
import ProfileSetupScreen from './screens/ProfileSetupScreen';
import HouseholdSetupScreen, { householdEmitter, HOUSEHOLD_CREATED_EVENT } from './screens/HouseholdSetupScreen';
import SettingsScreen from './screens/SettingsScreen';
import ExpenseScreen from './screens/ExpenseScreen';
import AnalysisScreen from './screens/AnalysisScreen';
import { ActivityIndicator, View } from 'react-native'; // Import View for loading state
import { AlertProvider } from './components/CustomAlert'; // Import the AlertProvider

// Define stack parameter list
type RootStackParamList = {
  Landing: undefined;
  SignIn: undefined;
  SignUp: undefined;
  Home: undefined;
  ProfileSetup: undefined;
  HouseholdSetup: undefined;
  Settings: undefined;
  Expense: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [householdComplete, setHouseholdComplete] = useState(false);
  
  useEffect(() => {
    // Check initial session state
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        checkHouseholdSetup(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (_event === 'SIGNED_IN' && session) {
        checkHouseholdSetup(session.user.id);
      } else if (_event === 'SIGNED_OUT' || _event === 'INITIAL_SESSION') {
        setHouseholdComplete(false);
        setLoading(false);
      }
    });

    // Listen for household creation/joining events
    const householdListener = householdEmitter.addListener(
      HOUSEHOLD_CREATED_EVENT,
      () => {
        console.log('Household created/joined event received');
        setHouseholdComplete(true);
      }
    );

    // Cleanup listeners on unmount
    return () => {
      authListener?.subscription.unsubscribe();
      householdListener.remove();
    };
  }, []);

  // Check if user belongs to any households - simplified approach
  const checkHouseholdSetup = async (userId: string) => {
    try {
      // Simple direct query without using a function call
      const { data, error } = await supabase
        .from('household_members')
        .select('id')
        .eq('user_id', userId)
        .limit(1);

      if (error) {
        console.error('Error checking household setup:', error);
        // If there's an error, default to showing the household setup screen
        setHouseholdComplete(false);
      } else {
        setHouseholdComplete(data && data.length > 0);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error in household check:', error);
      setHouseholdComplete(false);
      setLoading(false);
    }
  };

  // Show a loading indicator while checking auth state
  if (loading) {
    return (
      <AlertProvider>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#0000ff" />
        </View>
      </AlertProvider>
    );
  }
  
  return (
    <AlertProvider>
      <NavigationContainer>
        <Stack.Navigator id="rootStack" screenOptions={{ headerShown: false }}>
          {session && session.user ? (
            // User is signed in - determine which screen to show
            !householdComplete ? (
              // No household yet, show household setup screen
              <Stack.Screen name="HouseholdSetup" component={HouseholdSetupScreen} />
            ) : (
              // User has a household, show main app screens
              <>
                <Stack.Screen name="Home" component={HomeScreen} />
                <Stack.Screen name="Settings" component={SettingsScreen} />
                <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
                <Stack.Screen name="HouseholdSetup" component={HouseholdSetupScreen} />
                <Stack.Screen name="Expense" component={ExpenseScreen} />
                <Stack.Screen name="Analysis" component={AnalysisScreen} />
              </>
            )
          ) : (
            // User is not signed in
            <>
              <Stack.Screen name="Landing" component={LandingScreen} />
              <Stack.Screen name="SignIn" component={SignInScreen} />
              <Stack.Screen name="SignUp" component={SignUpScreen} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </AlertProvider>
  );
}