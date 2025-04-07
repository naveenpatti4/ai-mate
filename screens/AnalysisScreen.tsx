import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../supabaseClient';
import { PieChart } from 'react-native-chart-kit';
import { fonts, colors } from '../components/GlobalStyles';

type MonthData = {
  value: string;
  label: string;
  year: number;
  month: number;
};

type Expense = {
  id: string;
  store_name: string;
  amount: number;
  category: string;
  date: string;
};

type CategoryTotal = {
  category: string;
  total: number;
  color: string;
  count: number;
};

const AnalysisScreen = ({ navigation }: any) => {
  const [selectedMonthData, setSelectedMonthData] = useState<MonthData | null>(null);
  const [availableMonths, setAvailableMonths] = useState<MonthData[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [monthlyTotal, setMonthlyTotal] = useState(0);
  const [categoryTotals, setCategoryTotals] = useState<CategoryTotal[]>([]);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const screenWidth = Dimensions.get("window").width;

  useEffect(() => {
    loadUserHousehold();
    generateMonths();
  }, []);

  useEffect(() => {
    if (selectedMonthData && householdId) {
      loadExpenses();
    }
  }, [selectedMonthData, householdId]);

  const loadUserHousehold = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not found');
      }
      
      // Get the user's household
      const { data: householdData, error: householdError } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('user_id', user.id)
        .limit(1)
        .single();
        
      if (householdError) throw householdError;
      
      setHouseholdId(householdData.household_id);
    } catch (error) {
      console.error('Error loading household:', error);
      setError('Failed to load your household information.');
      setLoading(false);
    }
  };

  const generateMonths = () => {
    const now = new Date();
    const months: MonthData[] = [];
    
    // Generate last 12 months
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const month = date.getMonth();
      const year = date.getFullYear();
      
      months.push({
        value: `${year}-${String(month + 1).padStart(2, '0')}`,
        label: date.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
        year: year,
        month: month + 1
      });
    }
    
    setAvailableMonths(months);
    setSelectedMonthData(months[0]); // Current month
  };

  const loadExpenses = async () => {
    if (!selectedMonthData || !householdId) return;
    
    setLoading(true);
    try {
      const year = selectedMonthData.year;
      const month = selectedMonthData.month; 
      
      // First day of current month
      const firstDay = new Date(year, month - 1, 1);
      
      // Last day of current month
      const lastDay = new Date(year, month, 0);
      
      // Manually format dates as YYYY-MM-DD strings to avoid timezone issues
      const pad = (num: number) => num.toString().padStart(2, '0');
      const firstDayStr = `${firstDay.getFullYear()}-${pad(firstDay.getMonth() + 1)}-${pad(firstDay.getDate())}`;
      const lastDayStr = `${lastDay.getFullYear()}-${pad(lastDay.getMonth() + 1)}-${pad(lastDay.getDate())}`;
      
      // Use our RPC function to get expenses with creator profiles
      const { data, error } = await supabase
        .rpc('get_expenses_with_creator_profiles', { 
          household_id_param: householdId, 
          start_date: firstDayStr,
          end_date: lastDayStr
        });

      if (error) throw error;

      // Transform data from RPC format
      const transformedExpenses: Expense[] = data.map(expense => ({
        id: expense.expense_id,
        store_name: expense.store_name,
        amount: expense.amount,
        category: expense.category,
        date: expense.expense_date,
      }));

      setExpenses(transformedExpenses);
      
      // Calculate monthly total
      const total = transformedExpenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
      setMonthlyTotal(total);

      // Calculate totals by category
      calculateCategoryTotals(transformedExpenses);
    } catch (error) {
      console.error('Error loading expenses:', error);
      setError('Failed to load expenses');
    } finally {
      setLoading(false);
    }
  };

  const calculateCategoryTotals = (expenses: Expense[]) => {
    // Group expenses by category
    const categoryGroups: Record<string, { total: number, count: number }> = {};
    
    expenses.forEach(expense => {
      const category = expense.category || 'Other';
      
      if (!categoryGroups[category]) {
        categoryGroups[category] = { total: 0, count: 0 };
      }
      
      categoryGroups[category].total += Number(expense.amount);
      categoryGroups[category].count += 1;
    });
    
    // Convert to array and assign colors
    const categoryData = Object.entries(categoryGroups).map(([category, data], index) => ({
      category,
      total: data.total,
      count: data.count,
      color: getCategoryColor(category)
    }));
    
    // Sort by total amount (descending)
    categoryData.sort((a, b) => b.total - a.total);
    
    setCategoryTotals(categoryData);
  };

  const handleMonthSelect = (monthData: MonthData) => {
    setSelectedMonthData(monthData);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const getCategoryIcon = (category: string) => {
    switch(category?.toLowerCase()) {
      case 'food': return 'fast-food-outline';
      case 'groceries': return 'basket-outline';
      case 'shopping': return 'cart-outline';
      case 'entertainment': return 'film-outline';
      case 'transport': 
      case 'transportation': return 'car-outline';
      case 'utilities': return 'flash-outline';
      case 'rent':
      case 'housing': return 'home-outline';
      case 'healthcare':
      case 'health': return 'medical-outline';
      case 'education': return 'school-outline';
      case 'travel': return 'airplane-outline';
      case 'dining': return 'restaurant-outline';
      default: return 'receipt-outline';
    }
  };

  const getCategoryColor = (category: string) => {
    switch(category?.toLowerCase()) {
      case 'food': return '#FF9500';
      case 'groceries': return '#34C759';
      case 'shopping': return '#5AC8FA';
      case 'entertainment': return '#AF52DE';
      case 'transport': 
      case 'transportation': return '#007AFF';
      case 'utilities': return '#FF3B30';
      case 'rent':
      case 'housing': return '#5856D6';
      case 'healthcare':
      case 'health': return '#FF2D55';
      case 'education': return '#64D2FF';
      case 'travel': return '#FFCC00';
      case 'dining': return '#FF9500';
      default: return '#8E8E93';
    }
  };

  // Prepare data for pie chart
  const getChartData = () => {
    // If no data, return placeholder
    if (categoryTotals.length === 0) {
      return [
        {
          name: 'No Data',
          amount: 1,
          color: '#CCCCCC',
          legendFontColor: '#7F7F7F',
          legendFontSize: 12
        }
      ];
    }
    
    return categoryTotals.map(item => ({
      name: item.category,
      amount: item.total,
      color: item.color,
      legendFontColor: '#7F7F7F',
      legendFontSize: 12
    }));
  };

  // Calculate percentage of total for a category
  const calculatePercentage = (categoryTotal: number) => {
    if (monthlyTotal === 0) return 0;
    return Math.round((categoryTotal / monthlyTotal) * 100);
  };

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorMessage}>{error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => {
            setError(null);
            loadUserHousehold();
          }}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
            <TouchableOpacity 
                style={styles.backButton}
                onPress={() => navigation.goBack()}
            >
                <Ionicons name="arrow-back" size={24} color={colors.primary} />
            </TouchableOpacity>
            <Text style={[styles.header, { marginLeft: 10 }]}>Analysis</Text>
        </View>
      
      <View style={styles.monthFilterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {availableMonths.map((month) => (
            <TouchableOpacity 
              key={month.value} 
              style={[
                styles.monthItem,
                selectedMonthData?.value === month.value && styles.selectedMonthItem
              ]}
              onPress={() => handleMonthSelect(month)}
            >
              <Text 
                style={[
                  styles.monthItemText,
                  selectedMonthData?.value === month.value && styles.selectedMonthItemText
                ]}
              >
                {month.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      
      <ScrollView style={styles.contentContainer}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3f51b5" />
            <Text style={styles.loadingText}>Loading analysis...</Text>
          </View>
        ) : (
          <>
            {/* Monthly Total Card */}
            <View style={styles.card}>
              <View style={styles.totalContainer}>
                <Text style={styles.totalLabel}>Monthly Total</Text>
                <Text style={styles.monthlyTotal}>{formatCurrency(monthlyTotal)}</Text>
              </View>
            </View>

            {/* Pie Chart Card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Spending by Category</Text>
              
              {expenses.length === 0 ? (
                <View style={styles.noDataContainer}>
                  <Ionicons name="pie-chart-outline" size={64} color="#CCCCCC" />
                  <Text style={styles.noDataText}>No data for this month</Text>
                </View>
              ) : (
                <>
                  <View style={styles.chartContainer}>
                    <PieChart
                      data={getChartData()}
                      width={screenWidth - 64}
                      height={200}
                      chartConfig={{
                        backgroundColor: '#FFFFFF',
                        backgroundGradientFrom: '#FFFFFF',
                        backgroundGradientTo: '#FFFFFF',
                        color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                      }}
                      accessor="amount"
                      backgroundColor="transparent"
                      paddingLeft="15"
                      absolute={false}
                    />
                  </View>

                  {/* Category Breakdown */}
                  <View style={styles.categoryBreakdownContainer}>
                    {categoryTotals.map((category) => (
                      <View key={category.category} style={styles.categoryBreakdownItem}>
                        <View style={styles.categoryLeftSection}>
                          <View style={[styles.categoryIconContainer, { backgroundColor: `${category.color}20` }]}>
                            <Ionicons
                              name={getCategoryIcon(category.category)}
                              size={20} 
                              color={category.color}
                            />
                          </View>
                          <View style={styles.categoryDetails}>
                            <Text style={styles.categoryName}>{category.category}</Text>
                            <Text style={styles.categoryCount}>{category.count} transactions</Text>
                          </View>
                        </View>
                        
                        <View style={styles.categoryRightSection}>
                          <Text style={styles.categoryAmount}>{formatCurrency(category.total)}</Text>
                          <Text style={styles.categoryPercentage}>
                            {calculatePercentage(category.total)}%
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </>
              )}
            </View>

            {/* All Expenses Card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>All Expenses</Text>
              
              {expenses.length === 0 ? (
                <View style={styles.noExpensesContainer}>
                  <Ionicons name="receipt-outline" size={64} color="#CCCCCC" />
                  <Text style={styles.noExpensesText}>No expenses found for this month</Text>
                </View>
              ) : (
                <View style={styles.expensesList}>
                  {expenses.map((expense) => (
                    <View key={expense.id} style={styles.expenseItem}>
                      <View style={[styles.expenseIconContainer, { backgroundColor: `${getCategoryColor(expense.category)}20` }]}>
                        <Ionicons
                          name={getCategoryIcon(expense.category)}
                          size={24} 
                          color={getCategoryColor(expense.category)}
                        />
                      </View>
                      <View style={styles.expenseDetails}>
                        <Text style={styles.expenseStoreName}>{expense.store_name}</Text>
                        <Text style={styles.expenseCategory}>{expense.category}</Text>
                      </View>
                      <Text style={styles.expenseAmount}>${Number(expense.amount).toFixed(2)}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: colors.background,
  },
  backButton: {
    padding: 10,
    borderRadius: 20,
    position: 'absolute',
    top: 10,
    left: 10,
    zIndex: 10,
  },
  header: {
    fontSize: fonts.size.xxl,
    fontWeight: fonts.weight.bold,
    marginBottom: 20,
    marginTop: 40,
    color: colors.text.primary,
    fontFamily: fonts.primary,
  },
  monthFilterContainer: {
    marginBottom: 20,
  },
  monthItem: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 12,
    borderRadius: 20,
    backgroundColor: '#EEEEEE',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  selectedMonthItem: {
    backgroundColor: colors.primary,
  },
  monthItemText: {
    fontSize: fonts.size.medium,
    color: colors.text.secondary,
    fontFamily: fonts.primary,
  },
  selectedMonthItemText: {
    fontWeight: fonts.weight.bold,
    color: '#FFFFFF',
    fontFamily: fonts.primary,
  },
  contentContainer: {
    flex: 1,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  cardTitle: {
    fontSize: fonts.size.large,
    fontWeight: fonts.weight.semibold,
    color: colors.text.primary,
    marginBottom: 16,
    fontFamily: fonts.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 10,
    color: colors.text.secondary,
    fontSize: fonts.size.regular,
    fontFamily: fonts.primary,
  },
  totalContainer: {
    alignItems: 'center',
    padding: 16,
  },
  totalLabel: {
    fontSize: fonts.size.regular,
    fontWeight: fonts.weight.semibold,
    color: colors.text.secondary,
    marginBottom: 8,
    fontFamily: fonts.primary,
  },
  monthlyTotal: {
    fontSize: 36,
    fontWeight: fonts.weight.bold,
    color: colors.text.primary,
    fontFamily: fonts.primary,
  },
  chartContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  categoryBreakdownContainer: {
    marginTop: 16,
  },
  categoryBreakdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  categoryLeftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  categoryDetails: {
    flex: 1,
  },
  categoryName: {
    fontSize: fonts.size.regular,
    fontWeight: fonts.weight.medium,
    color: colors.text.primary,
    marginBottom: 2,
    fontFamily: fonts.primary,
  },
  categoryCount: {
    fontSize: fonts.size.small,
    color: colors.text.muted,
    fontFamily: fonts.primary,
  },
  categoryRightSection: {
    alignItems: 'flex-end',
  },
  categoryAmount: {
    fontSize: fonts.size.regular,
    fontWeight: fonts.weight.semibold,
    color: colors.text.primary,
    marginBottom: 2,
    fontFamily: fonts.primary,
  },
  categoryPercentage: {
    fontSize: fonts.size.small,
    color: colors.text.muted,
    fontFamily: fonts.primary,
  },
  expensesList: {
    marginTop: 8,
  },
  expenseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  expenseIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  expenseDetails: {
    flex: 1,
  },
  expenseStoreName: {
    fontSize: fonts.size.regular,
    fontWeight: fonts.weight.medium,
    color: colors.text.primary,
    fontFamily: fonts.primary,
  },
  expenseCategory: {
    fontSize: fonts.size.medium,
    color: colors.text.secondary,
    marginTop: 2,
    fontFamily: fonts.primary,
  },
  expenseAmount: {
    fontSize: fonts.size.regular,
    fontWeight: fonts.weight.semibold,
    color: colors.text.primary,
    fontFamily: fonts.primary,
  },
  noDataContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  noDataText: {
    fontSize: fonts.size.regular,
    color: colors.text.secondary,
    marginTop: 12,
    fontFamily: fonts.primary,
  },
  noExpensesContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  noExpensesText: {
    fontSize: fonts.size.regular,
    color: colors.text.secondary,
    marginTop: 12,
    fontFamily: fonts.primary,
  },
  errorMessage: {
    fontSize: fonts.size.regular,
    color: colors.error,
    textAlign: 'center',
    marginBottom: 16,
    fontFamily: fonts.primary,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignSelf: 'center',
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: fonts.weight.semibold,
    fontSize: fonts.size.regular,
    fontFamily: fonts.primary,
  },
});

export default AnalysisScreen;