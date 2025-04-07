import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Image,
  ScrollView,
  RefreshControl,
  StatusBar,
  Animated,
  ActivityIndicator,
  Platform
} from 'react-native';
import { AlertManager } from '../components/CustomAlert';
import { supabase } from '../supabaseClient';
import { Ionicons } from '@expo/vector-icons';
import ExpenseItem from '../components/ExpenseItem';
import { fonts, colors, buttonStyles } from '../components/GlobalStyles';

type Profile = {
  id: string;
  full_name: string;
  avatar_url: string | null;
};

type Household = {
  id: string;
  name: string;
  join_code: string;
  member_count: number;
};

type Expense = {
  id: string;
  store_name: string;
  amount: number;
  category: string;
  date: string;
  description: string;
  created_by: string;
  creator_name: string;
  creator_avatar: string | null;
};

type MonthData = {
  value: string;
  label: string;
  year: number;
  month: number;
};

export default function HomeScreen({ navigation, route }: any) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingHousehold, setLoadingHousehold] = useState(true);
  const [loadingExpenses, setLoadingExpenses] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const scrollY = new Animated.Value(0);
  const [recentTransactionsCount, setRecentTransactionsCount] = useState(5); // Show 5 recent transactions by default
  
  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    loadData();

    // Animate content when component mounts
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true
      })
    ]).start();
  }, []);

  // Refresh data if expenses were updated
  useEffect(() => {
    if (route.params?.expenseUpdated) {
      loadExpenses();
      // Clear the parameter to prevent repeated loading
      navigation.setParams({ expenseUpdated: undefined });
    }
  }, [route.params?.expenseUpdated]);

  const loadData = async () => {
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
    } finally {
      setLoading(false);
      setRefreshing(false);
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
          setLoadingExpenses(false);
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

          // Load expenses for this household
          await loadExpenses(household.id);
        }
      } else {
        setHousehold(null);
        setLoadingExpenses(false);
      }
    } catch (error) {
      console.error('Error loading household data:', error);
      setHousehold(null);
      setLoadingExpenses(false);
    } finally {
      setLoadingHousehold(false);
    }
  };

  const loadExpenses = async (householdId?: string) => {
    try {
      setLoadingExpenses(true);

      const hId = householdId || household?.id;
      if (!hId) {
        setLoadingExpenses(false);
        return;
      }

      // Get the current date
      const now = new Date();
      
      // Get date 30 days ago for recent transactions
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(now.getDate() - 30);
      
      // Format dates as YYYY-MM-DD
      const pad = (num: number) => num.toString().padStart(2, '0');
      const startDate = `${thirtyDaysAgo.getFullYear()}-${pad(thirtyDaysAgo.getMonth() + 1)}-${pad(thirtyDaysAgo.getDate())}`;
      const endDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

      // Get recent expenses from the last 30 days
      const { data, error } = await supabase
        .rpc('get_expenses_with_creator_profiles', {
          household_id_param: hId,
          start_date: startDate,
          end_date: endDate
        });

      if (error) {
        console.error('Error loading expenses with RPC:', error);

        // Fallback to direct query if RPC fails
        console.log('Falling back to direct query...');
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('expenses')
          .select(`
            id,
            store_name,
            amount,
            category,
            date,
            description,
            created_by,
            profiles(full_name, avatar_url)
          `)
          .eq('household_id', hId)
          .gte('date', startDate)
          .lte('date', endDate)
          .order('date', { ascending: false });

        if (fallbackError) throw fallbackError;

        // Transform data for fallback query
        const transformedExpenses: Expense[] = fallbackData.map(expense => ({
          id: expense.id,
          store_name: expense.store_name,
          amount: expense.amount,
          category: expense.category,
          date: expense.date,
          description: expense.description,
          created_by: expense.created_by,
          creator_name: expense.profiles ? expense.profiles.full_name || 'Unknown' : 'Unknown',
          creator_avatar: expense.profiles ? expense.profiles.avatar_url : null
        }));

        setExpenses(transformedExpenses);
      } else {
        // Transform data from RPC format
        const transformedExpenses: Expense[] = data.map(expense => ({
          id: expense.expense_id,
          store_name: expense.store_name,
          amount: expense.amount,
          category: expense.category,
          date: expense.expense_date,
          description: expense.description || '',
          created_by: expense.created_by,
          creator_name: expense.creator_name || 'Unknown',
          creator_avatar: expense.creator_avatar
        }));

        // Sort by date (newest first)
        transformedExpenses.sort((a, b) => 
          new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        setExpenses(transformedExpenses);
      }

      // Animate the expenses list
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 0.95, duration: 100, useNativeDriver: true }),
        Animated.parallel([
          Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(scaleAnim, { toValue: 1, duration: 300, useNativeDriver: true })
        ])
      ]).start();
    } catch (error) {
      console.error('Error loading expenses:', error);
    } finally {
      setLoadingExpenses(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const loadMoreTransactions = () => {
    setRecentTransactionsCount(prev => prev + 5);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const handleEditExpense = (expenseId: string) => {
    navigation.navigate('Expense', { expenseId });
  };

  const firstName = profile?.full_name?.split(' ')[0] || '';
  const date = new Date();
  const formattedDate = date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  });

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error signing out:', error);
    }
  };

  // Animation for header parallax effect
  const headerHeight = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [200, 120],
    extrapolate: 'clamp',
  });

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 60, 90],
    outputRange: [1, 0.3, 0],
    extrapolate: 'clamp',
  });

  // Animation for date on scroll
  const dateScale = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const dateTranslateY = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [0, 20],
    extrapolate: 'clamp',
  });

  // Calculate the total for recent transactions
  const recentTotal = expenses.slice(0, recentTransactionsCount).reduce((sum, exp) => sum + Number(exp.amount), 0);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      {/* Animated Header */}
      <Animated.View style={[styles.header, { height: headerHeight }]}>
        <View style={styles.headerContent}>
          <View style={styles.greetingContainer}>
            <Animated.Text style={[styles.greeting, { opacity: headerOpacity }]}>
              {getGreeting()}
            </Animated.Text>
            <Text style={styles.userName}>{firstName}</Text>
            <Animated.Text
              style={[
                styles.date,
                {
                  opacity: headerOpacity,
                  transform: [
                    { scale: dateScale },
                    { translateY: dateTranslateY }
                  ]
                }
              ]}
            >
              {formattedDate}
            </Animated.Text>
          </View>

          <TouchableOpacity
            style={styles.avatarContainer}
            onPress={() => navigation.navigate('Settings')}
          >
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarText}>{firstName.charAt(0)}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </Animated.View>

      {loading ? (
        <View style={styles.fullLoadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading your dashboard...</Text>
        </View>
      ) : (
        <Animated.ScrollView
          contentContainerStyle={styles.scrollContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
          }
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false }
          )}
          scrollEventThrottle={16}
        >
          <Animated.View
            style={[
              styles.animatedContent,
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }]
              }
            ]}
          >
            {/* Quick Actions Card in Single Row */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Quick Actions</Text>
              <View style={styles.actionButtonsRow}>
                <TouchableOpacity
                  style={styles.actionButtonSmall}
                  onPress={() => navigation.navigate('Analysis')}
                  activeOpacity={0.7}
                >
                  <View style={[styles.actionIconSmall, { backgroundColor: '#E9FCF1' }]}>
                    <Ionicons name="stats-chart-outline" size={20} color="#34C759" />
                  </View>
                  <Text style={styles.actionTextSmall}>Analysis</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionButtonSmall}
                  onPress={() => navigation.navigate('Settings')}
                  activeOpacity={0.7}
                >
                  <View style={[styles.actionIconSmall, { backgroundColor: '#E9F0FC' }]}>
                    <Ionicons name="home-outline" size={20} color="#000000" />
                  </View>
                  <Text style={styles.actionTextSmall}>Household</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionButtonSmall}
                  onPress={() => navigation.navigate('ProfileSetup', { fromSettings: true })}
                  activeOpacity={0.7}
                >
                  <View style={[styles.actionIconSmall, { backgroundColor: '#FCF1E9' }]}>
                    <Ionicons name="person-outline" size={20} color="#FF9500" />
                  </View>
                  <Text style={styles.actionTextSmall}>Profile</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionButtonSmall}
                  onPress={handleSignOut}
                  activeOpacity={0.7}
                >
                  <View style={[styles.actionIconSmall, { backgroundColor: '#FCE9E9' }]}>
                    <Ionicons name="log-out-outline" size={20} color="#FF3B30" />
                  </View>
                  <Text style={styles.actionTextSmall}>Sign Out</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Recent Transactions Card - Only show if household exists */}
            {household && (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>Recent Transactions</Text>
                  <TouchableOpacity
                    style={styles.addExpenseButton}
                    onPress={() => navigation.navigate('Expense')}
                  >
                    <Ionicons name="add" size={20} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>

                {loadingExpenses ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={styles.loadingText}>Loading transactions...</Text>
                  </View>
                ) : expenses.length > 0 ? (
                  <View style={styles.expensesList}>
                    {expenses.slice(0, recentTransactionsCount).map(expense => (
                      <ExpenseItem
                        key={expense.id}
                        id={expense.id}
                        amount={expense.amount}
                        storeName={expense.store_name}
                        category={expense.category}
                        date={expense.date}
                        creatorName={expense.creator_name}
                        creatorAvatar={expense.creator_avatar}
                        onPress={handleEditExpense}
                      />
                    ))}
                    
                    {expenses.length > recentTransactionsCount && (
                      <TouchableOpacity 
                        style={styles.loadMoreButton}
                        onPress={loadMoreTransactions}
                      >
                        <Text style={styles.loadMoreButtonText}>Load More</Text>
                      </TouchableOpacity>
                    )}
                    
                    <TouchableOpacity 
                      style={styles.viewAllButton}
                      onPress={() => navigation.navigate('Analysis')}
                    >
                      <Text style={styles.viewAllButtonText}>View All in Analysis</Text>
                      <Ionicons name="arrow-forward" size={16} color={colors.primary} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.emptyExpensesState}>
                    <Ionicons name="receipt-outline" size={48} color="#C7C7CC" style={styles.emptyStateIcon} />
                    <Text style={styles.emptyStateText}>No transactions yet</Text>
                    <TouchableOpacity
                      style={styles.addButton}
                      onPress={() => navigation.navigate('Expense')}
                    >
                      <Text style={styles.addButtonText}>Add First Expense</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* Spacing at the bottom */}
            <View style={{ height: 100 }} />
          </Animated.View>
        </Animated.ScrollView>
      )}

      {/* Floating Action Button for Adding Expenses - Only show if not loading */}
      {!loading && household && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => navigation.navigate('Expense')}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.card,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 5,
    zIndex: 100,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: '100%',
  },
  greetingContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  greeting: {
    fontSize: fonts.size.medium,
    color: colors.text.secondary,
    marginBottom: 4,
    fontFamily: fonts.primary,
  },
  userName: {
    fontSize: fonts.size.xxl,
    fontWeight: fonts.weight.bold,
    color: colors.text.primary,
    marginBottom: 4,
    fontFamily: fonts.primary,
  },
  date: {
    fontSize: fonts.size.medium,
    color: colors.text.secondary,
    fontFamily: fonts.primary,
  },
  avatarContainer: {
    marginLeft: 20,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: colors.border,
  },
  avatarPlaceholder: {
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: 'white',
    fontSize: 20,
    fontWeight: fonts.weight.semibold,
    fontFamily: fonts.primary,
  },
  scrollContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  animatedContent: {
    width: '100%',
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: fonts.size.large,
    fontWeight: fonts.weight.semibold,
    color: colors.text.primary,
    fontFamily: fonts.primary,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  actionButtonSmall: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  actionIconSmall: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  actionTextSmall: {
    fontSize: fonts.size.small,
    fontWeight: fonts.weight.medium,
    color: colors.text.primary,
    textAlign: 'center',
    fontFamily: fonts.primary,
  },
  addExpenseButton: {
    backgroundColor: colors.primary,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  loadingText: {
    fontSize: fonts.size.medium,
    color: colors.text.muted,
    marginTop: 8,
    fontFamily: fonts.primary,
  },
  expensesList: {
    marginTop: 8,
  },
  emptyExpensesState: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyStateIcon: {
    marginBottom: 16,
  },
  emptyStateText: {
    fontSize: fonts.size.regular,
    color: colors.text.muted,
    marginBottom: 16,
    textAlign: 'center',
    fontFamily: fonts.primary,
  },
  addButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  addButtonText: {
    color: 'white',
    fontSize: fonts.size.regular,
    fontWeight: fonts.weight.medium,
    fontFamily: fonts.primary,
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
    zIndex: 100,
  },
  fullLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 8,
  },
  viewAllButtonText: {
    fontSize: fonts.size.regular,
    color: colors.primary,
    fontWeight: fonts.weight.medium,
    marginRight: 4,
    fontFamily: fonts.primary,
  },
  loadMoreButton: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginVertical: 10,
  },
  loadMoreButtonText: {
    fontSize: fonts.size.medium,
    color: colors.text.secondary,
    fontWeight: fonts.weight.medium,
    fontFamily: fonts.primary,
  },
});