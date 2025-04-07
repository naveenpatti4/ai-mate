import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, Alert, TextInput, TouchableOpacity, SafeAreaView, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { supabase } from '../supabaseClient';
// Add EventEmitter for household status updates
import { EventEmitter } from 'fbemitter';
import { AlertManager } from 'components/CustomAlert';
import { fonts, colors } from '../components/GlobalStyles';

// Create an event emitter for household status updates
export const householdEmitter = new EventEmitter();
export const HOUSEHOLD_CREATED_EVENT = 'HOUSEHOLD_CREATED';

type ScreenMode = 'select' | 'create' | 'join' | 'loading';

export default function HouseholdSetupScreen({ navigation }: any) {
  const [mode, setMode] = useState<ScreenMode>('loading');
  const [householdName, setHouseholdName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [showNameField, setShowNameField] = useState(false);

  // Check if user already has a household when component mounts
  useEffect(() => {
    checkExistingHouseholds();
  }, []);

  // Function to check if the user already has a household
  const checkExistingHouseholds = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        // If no user is found, redirect to sign in
        navigation.reset({
          index: 0,
          routes: [{ name: 'SignIn' }],
        });
        return;
      }

      // Check if the user has any household memberships
      const { data: memberships, error } = await supabase
        .from('household_members')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);

      if (error) {
        console.error('Error checking household memberships:', error);
        setMode('select'); // Default to selection screen on error
        return;
      }

      // If the user already has a household, go to the home screen
      if (memberships && memberships.length > 0) {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Home' }],
        });
      } else {
        // Otherwise show the selection screen
        setMode('select');
      }
    } catch (error) {
      console.error('Error in checkExistingHouseholds:', error);
      setMode('select'); // Default to selection screen on error
    }
  };

  // Create a new household 
  const createHousehold = async () => {
    if (!householdName.trim()) {
      AlertManager.alert('Name Required', 'Please enter a name for your household.');
      return;
    }

    setLoading(true);

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not found');
      }

      // Check auth session
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        AlertManager.alert('Authentication Error', 'You need to be signed in to create a household.');
        setLoading(false);
        return;
      }
      
      console.log('Creating household with user ID:', user.id);
      
      // Try to get user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

      // If profile doesn't exist or doesn't have a name, create one with email username
      if (!profile || !profile.full_name) {
        const emailUsername = user.email ? user.email.split('@')[0] : 'User';
        await supabase
          .from('profiles')
          .upsert({ 
            id: user.id, 
            full_name: emailUsername,
            updated_at: new Date().toISOString()
          });
      }
      
      // Step 1: Use the simplified RPC function to create household only
      const { data: householdData, error: householdError } = await supabase
        .rpc('create_household_only', {
          household_name: householdName.trim(),
          user_id: user.id
        });

      if (householdError) {
        console.error('Error creating household:', householdError);
        AlertManager.alert('Creation Failed', `Error: ${householdError.message || 'Unable to create household'}`);
        setLoading(false);
        return;
      }

      console.log('Household created successfully:', householdData);
      
      // Step 2: Now manually add the user as a household member
      try {
        // First check if already a member to avoid duplicate key errors
        const { data: existingMember } = await supabase
          .from('household_members')
          .select('id')
          .eq('user_id', user.id)
          .eq('household_id', householdData.id)
          .maybeSingle();
          
        if (!existingMember) {
          // Get the user's display name
          const displayName = profile?.full_name || (user.email ? user.email.split('@')[0] : 'User');
          
          // Add user as household admin
          const { error: memberError } = await supabase
            .from('household_members')
            .insert({
              user_id: user.id,
              household_id: householdData.id,
              role: 'admin',
              display_name: displayName
            });
          
          if (memberError) {
            console.error('Error adding user as household member:', memberError);
          } else {
            console.log('Added user as household member successfully');
          }
        } else {
          console.log('User already a member, skipping insertion');
        }
      } catch (memberError: any) {
        // Only log the error but continue
        console.error('Error adding household member:', memberError);
      }
      
      // Emit event for household creation - notify App.tsx to update its state
      console.log('Emitting household created event with ID:', householdData.id);
      householdEmitter.emit(HOUSEHOLD_CREATED_EVENT, { householdId: householdData.id });
      
      // Add a small delay to ensure the event is processed
      setTimeout(() => {
        console.log('Navigating to Home screen after household creation');
        
        // Use both navigation methods for redundancy
        try {
          // Method 1: Reset navigation stack
          navigation.reset({
            index: 0,
            routes: [{ name: 'Home' }],
          });
          
          // Method 2: Direct navigation (backup if reset fails)
          setTimeout(() => {
            if (navigation.getCurrentRoute()?.name !== 'Home') {
              console.log('Backup navigation to Home');
              navigation.navigate('Home');
            }
          }, 300);
        } catch (navError) {
          console.error('Navigation error:', navError);
          AlertManager.alert(
            'Navigation Issue',
            'Household created successfully but navigation failed. Please go back to the home screen manually.'
          );
        }
      }, 500);
      
    } catch (error: any) {
      console.error('Error creating household:', error);
      AlertManager.alert('Creation Failed', `Unable to create your household: ${error.message || 'Please try again.'}`);
    } finally {
      setLoading(false);
    }
  };

  // Join an existing household
  const joinHousehold = async () => {
    if (!joinCode.trim()) {
        AlertManager.alert('Code Required', 'Please enter a household join code.');
      return;
    }

    if (showNameField && !displayName.trim()) {
        AlertManager.alert('Name Required', 'Please enter a display name for this household.');
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not found');
      
      // First check if this household exists
      const { data: household, error: householdError } = await supabase
        .rpc('find_household_by_join_code', { search_code: joinCode.trim() });

      if (householdError) throw householdError;
      
      if (!household || household.length === 0) {
        AlertManager.alert('Join Failed', 'Invalid household code. Please check and try again.');
        setLoading(false);
        return;
      }

      // Next check if user is already a member of this household
      const householdId = household[0].household_id;
      const { data: existingMembership, error: membershipError } = await supabase
        .from('household_members')
        .select('id')
        .eq('user_id', user.id)
        .eq('household_id', householdId)
        .maybeSingle();
      
      if (membershipError && membershipError.code !== 'PGRST116') throw membershipError;
      
      // If user is already a member, inform them and navigate to Home
      if (existingMembership) {
        // Emit event since user is already a member of a household
        householdEmitter.emit(HOUSEHOLD_CREATED_EVENT);
        
        Alert.alert(
          'Already a Member',
          'You are already a member of this household.',
          [
            {
              text: 'Go to Home',
              onPress: () => {
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'Home' }],
                });
              }
            }
          ]
        );
        setLoading(false);
        return;
      }

      // Check if user profile exists
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

      let userDisplayName = displayName.trim();
      
      // If display name not entered but showing the field, use username from email
      if (!userDisplayName && showNameField) {
        userDisplayName = user.email ? user.email.split('@')[0] : 'New Member';
      }
      
      // If not showing name field, get name from profile or use email username
      if (!showNameField) {
        userDisplayName = profile?.full_name || (user.email ? user.email.split('@')[0] : 'New Member');
        
        // Create profile if it doesn't exist
        if (!profile || !profile.full_name) {
          await supabase
            .from('profiles')
            .upsert({ 
              id: user.id, 
              full_name: userDisplayName,
              updated_at: new Date().toISOString()
            });
        }
      }

      // Now join the household with our validated data
      const { data, error } = await supabase
        .from('household_members')
        .insert({
          user_id: user.id,
          household_id: householdId,
          display_name: userDisplayName
        });

      if (error) {
        // If we still somehow get a duplicate key error, handle it gracefully
        if (error.code === '23505') {
          // Emit event for household joining - notify App.tsx to update its state
          householdEmitter.emit(HOUSEHOLD_CREATED_EVENT);
          
          Alert.alert(
            'Already a Member',
            'You are already a member of this household.',
            [
              {
                text: 'Go to Home',
                onPress: () => {
                  navigation.reset({
                    index: 0,
                    routes: [{ name: 'Home' }],
                  });
                }
              }
            ]
          );
          setLoading(false);
          return;
        }
        throw error;
      }

      // Emit event for household joining - notify App.tsx to update its state
      householdEmitter.emit(HOUSEHOLD_CREATED_EVENT, { householdId });
      
      // Navigate to the home screen
      navigation.reset({
        index: 0,
        routes: [{ name: 'Home' }],
      });
      
    } catch (error) {
      console.error('Error joining household:', error);
      Alert.alert('Join Failed', 'Unable to join the household. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Check if user needs to enter display name when joining
  React.useEffect(() => {
    if (mode === 'join') {
      checkUserProfile();
    }
  }, [mode]);

  const checkUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();
      
      setShowNameField(!data || !data.full_name);
    } catch (error) {
      console.error('Error checking profile:', error);
      setShowNameField(true);
    }
  };

  // Render the selection screen
  const renderSelectionScreen = () => (
    <View style={styles.content}>
      <Text style={styles.title}>Join or Create a Household</Text>
      <Text style={styles.subtitle}>Track expenses together with family or roommates</Text>
      
      <TouchableOpacity
        style={styles.optionButton}
        onPress={() => setMode('create')}
      >
        <Text style={styles.optionTitle}>Create a New Household</Text>
        <Text style={styles.optionDescription}>Start a new household and invite others</Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={styles.optionButton}
        onPress={() => setMode('join')}
      >
        <Text style={styles.optionTitle}>Join an Existing Household</Text>
        <Text style={styles.optionDescription}>Enter a code to join someone else's household</Text>
      </TouchableOpacity>
      
      <Text style={styles.noteText}>
        You can complete your profile details later in the Settings screen
      </Text>
    </View>
  );

  // Render the create household screen
  const renderCreateScreen = () => (
    <View style={styles.content}>
      <Text style={styles.title}>Create Household</Text>
      <Text style={styles.subtitle}>Give your household a name</Text>
      
      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Household Name</Text>
        <TextInput
          style={styles.input}
          value={householdName}
          onChangeText={setHouseholdName}
          placeholder="e.g. My Family, Apartment 4B"
        />
      </View>
      
      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={createHousehold}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Creating...' : 'Create Household'}
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => setMode('select')}
        disabled={loading}
      >
        <Text style={styles.backButtonText}>Back</Text>
      </TouchableOpacity>
    </View>
  );

  // Render the join household screen
  const renderJoinScreen = () => (
    <View style={styles.content}>
      <Text style={styles.title}>Join Household</Text>
      <Text style={styles.subtitle}>Enter the invite code from another member</Text>
      
      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Join Code</Text>
        <TextInput
          style={styles.input}
          value={joinCode}
          onChangeText={setJoinCode}
          placeholder="Enter 6-character code"
          autoCapitalize="characters"
          maxLength={6}
        />
      </View>
      
      {showNameField && (
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Your Display Name</Text>
          <TextInput
            style={styles.input}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="How others will see you in this household"
          />
        </View>
      )}
      
      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={joinHousehold}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Joining...' : 'Join Household'}
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => setMode('select')}
        disabled={loading}
      >
        <Text style={styles.backButtonText}>Back</Text>
      </TouchableOpacity>
    </View>
  );

  // Render the appropriate screen based on the current mode
  const renderContent = () => {
    switch (mode) {
      case 'loading':
        return (
          <View style={[styles.content, styles.loadingContainer]}>
            <ActivityIndicator size="large" color="#4a86f7" />
            <Text style={styles.loadingText}>Checking account status...</Text>
          </View>
        );
      case 'create':
        return renderCreateScreen();
      case 'join':
        return renderJoinScreen();
      default:
        return renderSelectionScreen();
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          {renderContent()}
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
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: fonts.size.xxl,
    fontWeight: fonts.weight.bold,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: 10,
    fontFamily: fonts.primary,
  },
  subtitle: {
    fontSize: fonts.size.regular,
    color: colors.text.secondary,
    marginBottom: 30,
    textAlign: 'center',
    fontFamily: fonts.primary,
  },
  optionButton: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  optionTitle: {
    fontSize: fonts.size.large,
    fontWeight: fonts.weight.bold,
    marginBottom: 6,
    color: colors.text.primary,
    fontFamily: fonts.primary,
  },
  optionDescription: {
    fontSize: fonts.size.medium,
    color: colors.text.secondary,
    fontFamily: fonts.primary,
  },
  inputContainer: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: fonts.size.medium,
    fontWeight: fonts.weight.semibold,
    marginBottom: 8,
    color: colors.text.primary,
    fontFamily: fonts.primary,
  },
  input: {
    height: 50,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: fonts.size.regular,
    backgroundColor: colors.inputBackground,
    fontFamily: fonts.primary,
    color: colors.text.primary,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: fonts.size.regular,
    fontWeight: fonts.weight.semibold,
    fontFamily: fonts.primary,
  },
  backButton: {
    marginTop: 20,
    padding: 10,
    alignItems: 'center',
  },
  backButtonText: {
    color: colors.primary,
    fontSize: fonts.size.regular,
    fontFamily: fonts.primary,
  },
  noteText: {
    fontSize: fonts.size.small,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: 20,
    fontStyle: 'italic',
    fontFamily: fonts.primary,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: fonts.size.regular,
    color: colors.text.secondary,
    fontFamily: fonts.primary,
  },
});