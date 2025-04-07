import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, Image, Alert, Platform, KeyboardAvoidingView, SafeAreaView, ScrollView, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../supabaseClient';
import { decode } from 'base64-arraybuffer';
import { Ionicons } from '@expo/vector-icons';
import { fonts, colors, inputStyles, buttonStyles } from '../components/GlobalStyles';

export default function ProfileSetupScreen({ navigation, route }: any) {
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isUpdate, setIsUpdate] = useState(false);

  // Check if this is an update from settings or initial setup
  useEffect(() => {
    // If coming from Settings, we're updating rather than setting up
    if (route.params?.fromSettings) {
      setIsUpdate(true);
      loadUserProfile();
    }
  }, []);

  // Load existing profile data if updating
  const loadUserProfile = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not found');
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      if (data) {
        setFullName(data.full_name || '');
        setAvatarUrl(data.avatar_url);
      }
      
    } catch (error) {
      console.error('Error loading profile:', error);
      Alert.alert('Error', 'Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  // Handle profile picture selection
  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant camera roll permissions to upload a profile picture.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        if (asset.base64) {
          setUploading(true);
          const fileName = `${Date.now()}.${asset.uri.split('.').pop()}`;
          const filePath = `avatars/${fileName}`;
          
          // Upload image to Supabase Storage
          const { error: uploadError } = await supabase.storage
            .from('profile-pictures')
            .upload(filePath, decode(asset.base64), {
              contentType: `image/${asset.uri.split('.').pop()}`,
            });

          if (uploadError) {
            throw uploadError;
          }

          // Get public URL for the uploaded image
          const { data } = supabase.storage
            .from('profile-pictures')
            .getPublicUrl(filePath);

          if (data) {
            setAvatarUrl(data.publicUrl);
          }
          setUploading(false);
        }
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('Upload Failed', 'There was an error uploading your profile picture.');
      setUploading(false);
    }
  };

  // Save profile information to Supabase
  const saveProfile = async () => {
    if (!fullName.trim()) {
      Alert.alert('Name Required', 'Please enter your name to continue.');
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not found');
      }

      const updates = {
        id: user.id,
        full_name: fullName.trim(),
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('profiles')
        .upsert(updates);

      if (error) {
        throw error;
      }

      if (isUpdate) {
        // If updating from settings, just go back
        Alert.alert('Success', 'Your profile has been updated.', [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]);
      } else {
        // If initial setup, proceed to household setup
        navigation.reset({
          index: 0,
          routes: [{ name: 'HouseholdSetup' }],
        });
      }
      
    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert('Update Failed', 'Unable to update your profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.content}>
            <Text style={styles.title}>
              {isUpdate ? 'Edit Profile' : 'Complete Your Profile'}
            </Text>
            <Text style={styles.subtitle}>
              {isUpdate ? 'Update your personal information' : 'Let\'s personalize your account'}
            </Text>
            
            <View style={styles.avatarContainer}>
              <TouchableOpacity
                style={styles.avatarButton}
                onPress={pickImage}
                disabled={uploading}
              >
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Ionicons name="camera-outline" size={28} color="#555" />
                    <Text style={styles.avatarPlaceholderText}>Add Photo</Text>
                  </View>
                )}
                {uploading && (
                  <View style={styles.uploadingOverlay}>
                    <ActivityIndicator color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
              <Text style={styles.avatarHelpText}>Tap to select a profile picture</Text>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Full Name</Text>
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Enter your full name"
                autoCapitalize="words"
                placeholderTextColor="#BDBDBD"
              />
            </View>

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={saveProfile}
              disabled={loading || uploading}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Saving...' : (isUpdate ? 'Update Profile' : 'Continue')}
              </Text>
            </TouchableOpacity>
            
            {isUpdate && (
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => navigation.goBack()}
                disabled={loading}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>
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
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  avatarButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 60,
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 60,
  },
  avatarPlaceholderText: {
    color: '#555',
    fontSize: 14,
    fontWeight: fonts.weight.medium,
    marginTop: 4,
    fontFamily: fonts.primary,
  },
  avatarHelpText: {
    fontSize: fonts.size.small,
    color: colors.text.secondary,
    marginTop: 8,
    fontFamily: fonts.primary,
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
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
    backgroundColor: '#FFFFFF',
    fontFamily: fonts.primary,
    color: colors.text.primary,
    outlineStyle: 'none', // Remove focus outline
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
  cancelButton: {
    marginTop: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: colors.primary,
    fontSize: fonts.size.regular,
    fontFamily: fonts.primary,
  },
});