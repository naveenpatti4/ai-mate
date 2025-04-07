import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator, Share, Image, Animated, StatusBar } from 'react-native';
import { supabase } from '../supabaseClient';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { AlertManager } from '../components/CustomAlert';
import { fonts, colors } from '../components/GlobalStyles';

type Household = {
  id: string;
  name: string;
  join_code: string;
  member_count: number;
};

type Profile = {
  id: string;
  full_name: string;
  avatar_url: string | null;
};

type HouseholdMember = {
  id: string;
  user_id: string;
  display_name: string;
  role: string;
  full_name: string | null;
  avatar_url: string | null;
};

export default function SettingsScreen({ navigation }: any) {
  const [loading, setLoading] = useState(true);
  const [loadingHousehold, setLoadingHousehold] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);
  const [householdMembers, setHouseholdMembers] = useState<HouseholdMember[]>([]);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    loadData();
    
    // Start animations when component mounts
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true
      })
    ]).start();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not found');
      }

      // Load profile data
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;

      setProfile({
        id: profileData.id,
        full_name: profileData.full_name,
        avatar_url: profileData.avatar_url
      });
      
      // Load user's household data
      await loadHouseholdData(user.id);
    } catch (error) {
      console.error('Error loading data:', error);
      AlertManager.alert('Error', 'Failed to load profile and household data.');
    } finally {
      setLoading(false);
    }
  };
  
  const loadHouseholdData = async (userId: string) => {
    setLoadingHousehold(true);
    try {
      // Get the household ID first from the household_members table
      const { data: membershipData, error: membershipError } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('user_id', userId)
        .limit(1)
        .single();
        
      if (membershipError) {
        if (membershipError.code === 'PGRST116') { // PGRST116 is "no rows returned"
          setHousehold(null);
          setLoadingHousehold(false);
          return;
        }
        throw membershipError;
      }
      
      // Then get the household details from household_summary view
      if (membershipData?.household_id) {
        const { data: householdData, error: householdError } = await supabase
          .from('household_summary')
          .select('household_id, household_name, join_code, member_count')
          .eq('household_id', membershipData.household_id)
          .single();
          
        if (householdError) throw householdError;
        
        if (householdData) {
          const household = {
            id: householdData.household_id,
            name: householdData.household_name,
            join_code: householdData.join_code,
            member_count: householdData.member_count
          };
          
          setHousehold(household);
          
          // Load the household members once we have the household ID
          loadHouseholdMembers(householdData.household_id);
        }
      } else {
        setHousehold(null);
      }
    } catch (error) {
      console.error('Error loading household data:', error);
      setHousehold(null);
    } finally {
      setLoadingHousehold(false);
    }
  };
  
  const loadHouseholdMembers = async (householdId: string) => {
    setLoadingMembers(true);
    try {
      console.log('Loading household members for household:', householdId);
      
      // Using a more direct approach with PostgreSQL-style joins
      // This will ensure we get all profiles for household members
      const { data, error } = await supabase
        .rpc('get_household_members_with_profiles', { 
          household_id_param: householdId 
        });
      
      if (error) {
        console.error('Error loading members with RPC:', error);
        
        // Fallback to direct query if RPC fails
        const { data: directData, error: directError } = await supabase
          .from('household_members')
          .select(`
            id, 
            user_id,
            display_name,
            role,
            profiles(id, full_name, avatar_url)
          `)
          .eq('household_id', householdId);
        
        if (directError) {
          throw directError;
        }
        
        // Transform data
        const members: HouseholdMember[] = directData.map(member => {
          return {
            id: member.id,
            user_id: member.user_id,
            display_name: member.display_name,
            role: member.role,
            full_name: member.profiles ? member.profiles.full_name : null,
            avatar_url: member.profiles ? member.profiles.avatar_url : null
          };
        });
        
        setHouseholdMembers(members);
      } else {
        // Transform data from RPC
        const members: HouseholdMember[] = data.map(member => ({
          id: member.member_id,
          user_id: member.user_id,
          display_name: member.display_name || member.full_name || 'Unknown',
          role: member.role,
          full_name: member.full_name,
          avatar_url: member.avatar_url
        }));
        
        setHouseholdMembers(members);
      }
    } catch (error) {
      console.error('Error loading household members:', error);
      AlertManager.alert('Error', 'Failed to load household members.');
    } finally {
      setLoadingMembers(false);
    }
  };

  // Sign out function
  const handleSignOut = async () => {
    AlertManager.show({
      title: 'Sign Out',
      message: 'Are you sure you want to sign out?',
      buttons: [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Sign Out',
          onPress: async () => {
            const { error } = await supabase.auth.signOut();
            
            if (error) {
              AlertManager.alert('Error signing out', error.message);
            }
          }
        }
      ]
    });
  };

  // Copy household join code to clipboard
  const copyJoinCode = async (code: string) => {
    await Clipboard.setStringAsync(code);
    AlertManager.alert('Copied', 'Join code copied to clipboard');
  };

  // Share household join code
  const shareJoinCode = async (name: string, code: string) => {
    try {
      await Share.share({
        message: `Join my household "${name}" in AIMate Finance! Use join code: ${code}`,
      });
    } catch (error) {
        AlertManager.alert('Error', 'Failed to share join code');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading settings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={colors.primary} />
          </TouchableOpacity>
          <Text style={styles.title}>Settings</Text>
        </View>

        <Animated.View
          style={[
            styles.animatedContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          {/* Profile Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Profile</Text>
            <View style={styles.profileCard}>
              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Text style={styles.avatarInitial}>
                    {profile?.full_name?.charAt(0) || '?'}
                  </Text>
                </View>
              )}
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{profile?.full_name}</Text>
                <TouchableOpacity 
                  style={styles.editButton}
                  onPress={() => navigation.navigate('ProfileSetup', { fromSettings: true })}
                >
                  <Text style={styles.editButtonText}>Edit Profile</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* My Household Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>My Household</Text>
            {loadingHousehold ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.loadingText}>Loading household data...</Text>
              </View>
            ) : household ? (
              <View style={styles.householdCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.headerContent}>
                    <View style={styles.headerIconContainer}>
                      <Ionicons name="home" size={20} color={colors.primary} />
                    </View>
                    <Text style={styles.householdName}>{household.name}</Text>
                  </View>
                  <TouchableOpacity 
                    style={styles.editButton}
                    onPress={() => navigation.navigate('HouseholdSetup', { editMode: true })}
                  >
                    <Ionicons name="pencil-outline" size={16} color={colors.primary} />
                  </TouchableOpacity>
                </View>
                
                <View style={styles.membersInfo}>
                  <Ionicons name="people" size={16} color="#8E8E93" />
                  <Text style={styles.memberCount}>
                    {household.member_count} {household.member_count === 1 ? 'member' : 'members'}
                  </Text>
                </View>
                <View style={styles.codeContainer}>
                  <View style={styles.codeHeader}>
                    <Text style={styles.codeLabel}>Household Join Code</Text>
                    <Text style={styles.codeHint}>Share this code to invite others</Text>
                  </View>
                  <View style={styles.codeBox}>
                    <Text style={styles.code}>{household.join_code}</Text>
                  </View>
                  <View style={styles.codeActions}>
                    <TouchableOpacity 
                      style={[styles.actionButton, styles.copyButton]}
                      onPress={() => copyJoinCode(household.join_code)}
                    >
                      <Ionicons name="copy-outline" size={18} color={colors.primary} style={styles.buttonIcon} />
                      <Text style={styles.copyButtonText}>Copy Code</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.actionButton, styles.shareButton]}
                      onPress={() => shareJoinCode(household.name, household.join_code)}
                    >
                      <Ionicons name="share-social-outline" size={18} color="#FFFFFF" style={styles.buttonIcon} />
                      <Text style={styles.shareButtonText}>Share Invite</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                
                {/* Household Members List */}
                <View style={styles.membersContainer}>
                  <Text style={styles.membersListTitle}>Household Members</Text>
                  
                  {loadingMembers ? (
                    <View style={styles.loadingMembersContainer}>
                      <ActivityIndicator size="small" color="#8E8E93" />
                      <Text style={styles.loadingText}>Loading members...</Text>
                    </View>
                  ) : (
                    householdMembers.map((member, index) => (
                      <View 
                        key={member.id} 
                        style={[
                          styles.memberRow, 
                          index === householdMembers.length - 1 && styles.memberRow_last
                        ]}
                      >
                        {member.avatar_url ? (
                          <Image source={{ uri: member.avatar_url }} style={styles.memberAvatar} />
                        ) : (
                          <View style={[styles.memberAvatar, styles.memberAvatarPlaceholder]}>
                            <Text style={styles.memberAvatarInitial}>
                              {member.display_name.charAt(0) || '?'}
                            </Text>
                          </View>
                        )}
                        
                        <View style={styles.memberInfo}>
                          <Text style={styles.memberName}>
                            {member.display_name}
                          </Text>
                          {member.user_id === profile?.id && (
                            <Text style={styles.memberRole}>You</Text>
                          )}
                        </View>
                        
                        {member.role === 'admin' && (
                          <View style={styles.adminBadge}>
                            <Text style={styles.adminText}>Admin</Text>
                          </View>
                        )}
                      </View>
                    ))
                  )}
                </View>
              </View>
            ) : (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconContainer}>
                  <Ionicons name="home-outline" size={48} color="#C7C7CC" />
                </View>
                <Text style={styles.emptyText}>You haven't joined a household yet</Text>
                <TouchableOpacity 
                  style={styles.addButton}
                  onPress={() => navigation.navigate('HouseholdSetup')}
                >
                  <Ionicons name="add" size={20} color="#FFFFFF" style={styles.buttonIcon} />
                  <Text style={styles.addButtonText}>Create or Join Household</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Account Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>
            <View style={styles.accountCard}>
              <TouchableOpacity
                style={styles.settingsRow}
                onPress={() => navigation.navigate('ProfileSetup', { fromSettings: true })}
              >
                <View style={styles.settingsRowIcon}>
                  <Ionicons name="person" size={20} color={colors.primary} />
                </View>
                <Text style={styles.settingsRowText}>Edit Profile</Text>
                <Ionicons name="chevron-forward" size={18} color="#8E8E93" />
              </TouchableOpacity>
              
              <View style={styles.divider} />
              
              <TouchableOpacity
                style={styles.settingsRow}
                onPress={handleSignOut}
              >
                <View style={[styles.settingsRowIcon, styles.dangerIcon]}>
                  <Ionicons name="log-out" size={20} color="#FF3B30" />
                </View>
                <Text style={[styles.settingsRowText, styles.dangerText]}>Sign Out</Text>
                <Ionicons name="chevron-forward" size={18} color="#8E8E93" />
              </TouchableOpacity>
            </View>
          </View>

          {/* App Info */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>AIMate Finance v1.0.0</Text>
            <Text style={styles.copyrightText}>© 2025 AIMate Finance</Text>
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 16,
  },
  animatedContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 24,
  },
  loadingText: {
    fontSize: fonts.size.medium,
    color: colors.text.muted,
    marginTop: 8,
    fontFamily: fonts.primary,
  },
  header: {
    marginBottom: 20,
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 10,
    padding: 4,
  },
  title: {
    fontSize: fonts.size.xxl,
    fontWeight: fonts.weight.bold,
    color: colors.text.primary,
    fontFamily: fonts.primary,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: fonts.size.large,
    fontWeight: fonts.weight.semibold,
    color: colors.text.secondary,
    marginBottom: 12,
    fontFamily: fonts.primary,
  },
  profileCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  avatarPlaceholder: {
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: fonts.size.xxl,
    fontWeight: fonts.weight.bold,
    color: '#fff',
    fontFamily: fonts.primary,
  },
  profileInfo: {
    marginLeft: 16,
    flex: 1,
  },
  profileName: {
    fontSize: fonts.size.large,
    fontWeight: fonts.weight.bold,
    color: colors.text.primary,
    marginBottom: 4,
    fontFamily: fonts.primary,
  },
  editButton: {
    paddingVertical: 6,
  },
  editButtonText: {
    color: colors.primary,
    fontWeight: fonts.weight.medium,
    fontFamily: fonts.primary,
  },
  emptyState: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyText: {
    textAlign: 'center',
    color: colors.text.muted,
    marginVertical: 16,
    fontSize: fonts.size.regular,
    fontFamily: fonts.primary,
  },
  householdCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `rgba(${parseInt(colors.primary.slice(1, 3), 16)}, ${parseInt(colors.primary.slice(3, 5), 16)}, ${parseInt(colors.primary.slice(5, 7), 16)}, 0.1)`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  householdName: {
    fontSize: fonts.size.large,
    fontWeight: fonts.weight.bold,
    color: colors.text.primary,
    fontFamily: fonts.primary,
  },
  membersInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  memberCount: {
    fontSize: fonts.size.medium,
    color: colors.text.muted,
    marginLeft: 6,
    fontFamily: fonts.primary,
  },
  codeContainer: {
    marginBottom: 20,
  },
  codeHeader: {
    marginBottom: 8,
  },
  codeLabel: {
    fontSize: fonts.size.regular,
    fontWeight: fonts.weight.semibold,
    color: colors.text.primary,
    marginBottom: 4,
    fontFamily: fonts.primary,
  },
  codeHint: {
    fontSize: fonts.size.small,
    color: colors.text.muted,
    fontFamily: fonts.primary,
  },
  codeBox: {
    backgroundColor: '#F9F9FB',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  code: {
    fontSize: fonts.size.xl,
    fontWeight: fonts.weight.bold,
    color: colors.primary,
    letterSpacing: 2,
    fontFamily: fonts.primary,
  },
  codeActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flex: 1,
  },
  copyButton: {
    backgroundColor: `rgba(${parseInt(colors.primary.slice(1, 3), 16)}, ${parseInt(colors.primary.slice(3, 5), 16)}, ${parseInt(colors.primary.slice(5, 7), 16)}, 0.1)`,
    marginRight: 8,
  },
  shareButton: {
    backgroundColor: colors.primary,
    marginLeft: 8,
  },
  buttonIcon: {
    marginRight: 6,
  },
  copyButtonText: {
    color: colors.primary,
    fontWeight: fonts.weight.semibold,
    fontSize: fonts.size.medium,
    fontFamily: fonts.primary,
  },
  shareButtonText: {
    color: '#FFFFFF',
    fontWeight: fonts.weight.semibold,
    fontSize: fonts.size.medium,
    fontFamily: fonts.primary,
  },
  addButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: fonts.weight.semibold,
    fontSize: fonts.size.regular,
    fontFamily: fonts.primary,
  },
  membersContainer: {
    marginTop: 4,
  },
  membersListTitle: {
    fontSize: fonts.size.regular,
    fontWeight: fonts.weight.semibold,
    color: colors.text.primary,
    marginBottom: 12,
    fontFamily: fonts.primary,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  memberRow_last: {
    borderBottomWidth: 0,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  memberAvatarPlaceholder: {
    backgroundColor: '#E5E5EA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberAvatarInitial: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#8E8E93',
  },
  memberInfo: {
    marginLeft: 12,
    flex: 1,
  },
  memberName: {
    fontSize: fonts.size.regular,
    fontWeight: fonts.weight.medium,
    color: colors.text.primary,
    fontFamily: fonts.primary,
  },
  memberRole: {
    fontSize: fonts.size.small,
    color: colors.text.muted,
    marginTop: 2,
    fontFamily: fonts.primary,
  },
  adminBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: `rgba(${parseInt(colors.primary.slice(1, 3), 16)}, ${parseInt(colors.primary.slice(3, 5), 16)}, ${parseInt(colors.primary.slice(5, 7), 16)}, 0.1)`,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  adminText: {
    fontSize: fonts.size.small,
    color: colors.primary,
    fontWeight: fonts.weight.semibold,
    fontFamily: fonts.primary,
  },
  loadingMembersContainer: {
    padding: 20,
    alignItems: 'center',
  },
  accountCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  settingsRowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `rgba(${parseInt(colors.primary.slice(1, 3), 16)}, ${parseInt(colors.primary.slice(3, 5), 16)}, ${parseInt(colors.primary.slice(5, 7), 16)}, 0.1)`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  dangerIcon: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
  },
  settingsRowText: {
    fontSize: fonts.size.regular,
    color: colors.text.primary,
    flex: 1,
    fontFamily: fonts.primary,
  },
  dangerText: {
    color: '#FF3B30',
  },
  divider: {
    height: 1,
    backgroundColor: '#F2F2F7',
    marginHorizontal: 16,
  },
  footer: {
    alignItems: 'center',
    marginVertical: 24,
  },
  footerText: {
    fontSize: fonts.size.medium,
    color: colors.text.muted,
    marginBottom: 4,
    fontFamily: fonts.primary,
  },
  copyrightText: {
    fontSize: fonts.size.small,
    color: colors.text.muted,
    fontFamily: fonts.primary,
  },
});