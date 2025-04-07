import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  SafeAreaView, 
  KeyboardAvoidingView, 
  Platform,
  ScrollView,
  ActivityIndicator,
  Animated,
  Keyboard,
  StatusBar,
  FlatList
} from 'react-native';
import { AlertManager } from '../components/CustomAlert';
import { supabase } from '../supabaseClient';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { fonts, colors, inputStyles } from '../components/GlobalStyles';

// Define expense categories with icons
const EXPENSE_CATEGORIES = [
  { name: 'Food', icon: 'fast-food-outline', color: '#FF9500' },
  { name: 'Groceries', icon: 'basket-outline', color: '#34C759' },
  { name: 'Shopping', icon: 'cart-outline', color: '#5AC8FA' },
  { name: 'Entertainment', icon: 'film-outline', color: '#AF52DE' },
  { name: 'Transport', icon: 'car-outline', color: '#007AFF' },
  { name: 'Utilities', icon: 'flash-outline', color: '#FF3B30' },
  { name: 'Housing', icon: 'home-outline', color: '#5856D6' },
  { name: 'Health', icon: 'medical-outline', color: '#FF2D55' },
  { name: 'Education', icon: 'school-outline', color: '#64D2FF' },
  { name: 'Travel', icon: 'airplane-outline', color: '#FFCC00' },
  { name: 'Dining', icon: 'restaurant-outline', color: '#FF9500' },
  { name: 'Other', icon: 'receipt-outline', color: '#8E8E93' }
];

type Expense = {
  id?: string;
  household_id: string;
  created_by: string;
  amount: number;
  store_name: string;
  description: string;
  category: string;
  date: string;
};

// Check if we're running on web platform
const isWeb = Platform.OS === 'web';

export default function ExpenseScreen({ navigation, route }: any) {
  // Get expense ID from route params if editing
  const expenseId = route.params?.expenseId;
  const isEditing = !!expenseId;
  
  // State variables for form fields
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [amount, setAmount] = useState('');
  const [storeName, setStoreName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [householdId, setHouseholdId] = useState<string | null>(null);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const keyboardHeight = useRef(new Animated.Value(0)).current;
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    // Animate component in
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true
      })
    ]).start();
    
    // Keyboard listeners (skip on web)
    if (!isWeb) {
      const keyboardWillShowListener = Keyboard.addListener(
        Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
        (event) => {
          setKeyboardVisible(true);
          Animated.timing(keyboardHeight, {
            toValue: event.endCoordinates.height,
            duration: Platform.OS === 'ios' ? 250 : 0,
            useNativeDriver: false
          }).start();
        }
      );
      
      const keyboardWillHideListener = Keyboard.addListener(
        Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
        () => {
          setKeyboardVisible(false);
          Animated.timing(keyboardHeight, {
            toValue: 0,
            duration: Platform.OS === 'ios' ? 250 : 0,
            useNativeDriver: false
          }).start();
        }
      );
      
      return () => {
        keyboardWillShowListener.remove();
        keyboardWillHideListener.remove();
      };
    }
  }, []);

  // Initial data loading
  useEffect(() => {
    loadUserHousehold();
  }, []);

  // Load expense details if editing
  useEffect(() => {
    if (isEditing && expenseId) {
      loadExpenseData(expenseId);
    }
  }, [expenseId]);

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
      AlertManager.alert('Error', 'Failed to load your household information.', () => navigation.goBack());
    }
  };

  const loadExpenseData = async (id: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('id', id)
        .single();
        
      if (error) throw error;
      
      if (data) {
        setAmount(data.amount.toString());
        setStoreName(data.store_name);
        setDescription(data.description || '');
        setCategory(data.category);
        setDate(data.date);
        // Set the selectedDate for the date picker
        setSelectedDate(new Date(data.date + 'T00:00:00'));
      }
    } catch (error) {
      console.error('Error loading expense:', error);
      AlertManager.alert('Error', 'Failed to load expense data.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveExpense = async () => {
    // Dismiss keyboard
    if (!isWeb) {
      Keyboard.dismiss();
    }
    
    // Validate form
    if (!amount || !storeName || !category) {
      AlertManager.alert('Required Fields', 'Please fill in amount, store name, and category.');
      return;
    }
    
    // Check if amount is a valid number
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      AlertManager.alert('Invalid Amount', 'Please enter a valid positive amount.');
      return;
    }
    
    if (!householdId) {
      AlertManager.alert('Error', 'No household found. Please join or create a household first.');
      return;
    }

    setSaving(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not found');
      }
      
      const expenseData: Expense = {
        household_id: householdId,
        created_by: user.id,
        amount: numAmount,
        store_name: storeName.trim(),
        description: description.trim(),
        category: category,
        date: date
      };
      
      let error;
      
      if (isEditing) {
        // Update existing expense
        const { error: updateError } = await supabase
          .from('expenses')
          .update(expenseData)
          .eq('id', expenseId);
          
        error = updateError;
      } else {
        // Create new expense
        const { error: insertError } = await supabase
          .from('expenses')
          .insert(expenseData);
          
        error = insertError;
      }
      
      if (error) throw error;
      
      // Animate out before navigation
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true
        }),
        Animated.timing(slideAnim, {
          toValue: 20,
          duration: 200,
          useNativeDriver: true
        })
      ]).start(() => {
        // Navigate back to home screen on success
        navigation.navigate('Home', { expenseUpdated: true });
      });
    } catch (error) {
      console.error('Error saving expense:', error);
      AlertManager.alert('Error', `Failed to ${isEditing ? 'update' : 'create'} expense. Please try again.`);
      setSaving(false);
    }
  };

  // Confirm and delete the expense
  const handleDeleteExpense = async () => {
    if (!expenseId) {
      console.error("No expense ID found for deletion");
      AlertManager.alert('Error', 'Cannot delete this expense. Missing expense ID.');
      return;
    }
    
    // First show a confirmation dialog
    AlertManager.show({
      title: 'Delete Expense',
      message: 'Are you sure you want to delete this expense?',
      buttons: [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            // Perform the deletion after confirmation
            setDeleting(true);
            try {
              const { data, error } = await supabase
                .from('expenses')
                .delete()
                .eq('id', expenseId)
                .select();
              
              if (error) {
                throw error;
              }
              
              setDeleting(false);
              
              // Animate out before navigation
              Animated.parallel([
                Animated.timing(fadeAnim, {
                  toValue: 0,
                  duration: 200,
                  useNativeDriver: true
                }),
                Animated.timing(slideAnim, {
                  toValue: 20,
                  duration: 200,
                  useNativeDriver: true
                })
              ]).start(() => {
                navigation.navigate('Home', { expenseUpdated: true });
              });
            } catch (error) {
              console.error('Error deleting expense:', error);
              AlertManager.alert('Error', 'Failed to delete expense. Please try again.');
              setDeleting(false);
            }
          }
        }
      ]
    });
  };

  // Handle date change from date picker (Unified handler)
  const onDateChange = (event: any, newSelectedDate?: Date) => {
    // Only update if date was actually selected (iOS passes event.type, Android just passes the date)
    const selectedDate = newSelectedDate || new Date(); 
    
    // For iOS, check if cancelled
    if (Platform.OS === 'ios' && event.type === 'dismissed') {
      setShowDatePicker(false);
      return;
    }
    
    // Update the date
    setSelectedDate(selectedDate);
    
    // Format date as YYYY-MM-DD
    const pad = (num: number) => num.toString().padStart(2, '0');
    const year = selectedDate.getFullYear();
    const month = pad(selectedDate.getMonth() + 1);
    const day = pad(selectedDate.getDate());
    setDate(`${year}-${month}-${day}`);
    
    // Hide datepicker for Android and web after selection
    if (Platform.OS === 'android' || Platform.OS === 'web') {
      setShowDatePicker(false);
    }
  };

  // Show date picker directly
  const showDatePickerField = () => {
    if (!isWeb) {
      Keyboard.dismiss();
    }
    setShowDatePicker(true);
  };

  // Format the date for display
  const formatDateForDisplay = (dateString: string) => {
    // Add time component to ensure correct date parsing regardless of timezone
    const dateObj = new Date(`${dateString}T00:00:00`); 
    return dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Find category icon and color
  const getCategoryIcon = (categoryName: string) => {
    const categoryObj = EXPENSE_CATEGORIES.find(cat => cat.name === categoryName);
    return categoryObj ? categoryObj.icon : 'receipt-outline';
  };

  const getCategoryColor = (categoryName: string) => {
    const categoryObj = EXPENSE_CATEGORIES.find(cat => cat.name === categoryName);
    return categoryObj ? categoryObj.color : '#8E8E93';
  };

  // Render a category item in the grid
  const renderCategoryItem = ({ item }) => (
    <TouchableOpacity 
      style={[
        styles.categoryGridItem,
        category === item.name && styles.selectedCategoryGridItem
      ]}
      onPress={() => setCategory(item.name)}
      activeOpacity={0.7}
    >
      <View style={[
        styles.categoryGridIconContainer, 
        { backgroundColor: `${item.color}20` },
        category === item.name && { backgroundColor: `${item.color}40` }
      ]}>
        <Ionicons name={item.icon} size={24} color={item.color} />
      </View>
      <Text 
        style={[
          styles.categoryGridItemText,
          category === item.name && styles.selectedCategoryGridItemText,
          category === item.name && { color: item.color }
        ]}
        numberOfLines={1}
      >
        {item.name}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
      >
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {isEditing ? 'Edit Expense' : 'Add Expense'}
          </Text>
          {isEditing ? (
            <TouchableOpacity 
              style={styles.deleteButton}
              onPress={handleDeleteExpense}
              disabled={deleting}
            >
              <Ionicons name="trash-outline" size={22} color="#ff3b30" />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 32 }} />
          )}
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading expense data...</Text>
          </View>
        ) : (
          <Animated.ScrollView 
            style={[
              styles.scrollView,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }]
              }
            ]}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.formContainer}>

              {/* Store Name Field */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Store / Vendor</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="business-outline" size={20} color="#8E8E93" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={storeName}
                    onChangeText={setStoreName}
                    placeholder="Where did you make this purchase?"
                    returnKeyType="next"
                    placeholderTextColor="#BDBDBD"
                  />
                </View>
              </View>
              
              {/* Amount Field */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Amount</Text>
                <View style={styles.currencyInputContainer}>
                  <Text style={styles.currencySymbol}>$</Text>
                  <TextInput
                    style={styles.currencyInput}
                    value={amount}
                    onChangeText={setAmount}
                    placeholder="0.00"
                    keyboardType="numeric"
                    returnKeyType="next"
                    placeholderTextColor="#BDBDBD"
                  />
                </View>
              </View>
              
              {/* Category Field - Now as a grid */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Category</Text>
                <FlatList
                  data={EXPENSE_CATEGORIES}
                  renderItem={renderCategoryItem}
                  keyExtractor={item => item.name}
                  numColumns={3}
                  scrollEnabled={false}
                  contentContainerStyle={styles.categoryGrid}
                />
              </View>
              
              {/* Date Field with DatePicker - Updated to open directly from field */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Date</Text>
                <TouchableOpacity
                  style={[
                    styles.dateSelector,
                    showDatePicker && { borderColor: colors.primary, borderWidth: 2 }
                  ]}
                  onPress={showDatePickerField}
                  activeOpacity={0.7}
                >
                  <Ionicons name="calendar-outline" size={20} color={showDatePicker ? colors.primary : "#8E8E93"} style={styles.inputIcon} />
                  <Text style={[
                    styles.dateText,
                    showDatePicker && { color: colors.primary, fontWeight: fonts.weight.semibold }
                  ]}>
                    {formatDateForDisplay(date)}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color={showDatePicker ? colors.primary : "#8E8E93"} />
                </TouchableOpacity>

                {showDatePicker && (
                  <View style={styles.datePickerContainer}>
                    {Platform.OS === 'ios' && (
                      <View style={styles.datePickerHeader}>
                        <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                          <Text style={styles.datePickerButtonText}>Cancel</Text>
                        </TouchableOpacity>
                        <Text style={styles.datePickerTitle}>Select Date</Text>
                        <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                          <Text style={[styles.datePickerButtonText, { color: colors.primary }]}>Done</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                    
                    {(Platform.OS === 'ios' || Platform.OS === 'android') && (
                      <DateTimePicker
                        value={selectedDate}
                        mode="date"
                        display={Platform.OS === 'ios' ? "inline" : "default"}
                        onChange={onDateChange}
                        maximumDate={new Date()}
                        style={{ width: '100%' }}
                        textColor={colors.text.primary}
                        accentColor={colors.primary}
                      />
                    )}

                    {Platform.OS === 'web' && (
                      <View style={styles.webDatePickerContainer}>
                        <input
                          type="date"
                          value={date}
                          onChange={(e) => {
                            if (e.target.value) {
                              const newDate = new Date(e.target.value + 'T00:00:00');
                              setSelectedDate(newDate);
                              setDate(e.target.value);
                              setShowDatePicker(false);
                            }
                          }}
                          max={new Date().toISOString().split('T')[0]}
                          style={{
                            fontSize: fonts.size.regular,
                            padding: 16,
                            borderRadius: 12,
                            borderColor: colors.border,
                            borderWidth: 1,
                            width: '100%',
                            fontFamily: fonts.primary,
                            color: colors.text.primary,
                            backgroundColor: '#FFFFFF',
                            outlineColor: colors.primary,
                            cursor: 'pointer'
                          }}
                        />
                      </View>
                    )}
                  </View>
                )}
              </View>
              
              {/* Description Field */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Description (Optional)</Text>
                <View style={[styles.inputWrapper, styles.textAreaWrapper]}>
                  <Ionicons name="create-outline" size={20} color="#8E8E93" style={[styles.inputIcon, { alignSelf: 'flex-start', marginTop: 12 }]} />
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Add any additional details"
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                    placeholderTextColor="#BDBDBD"
                  />
                </View>
              </View>
              
              {/* Save Button */}
              <TouchableOpacity
                style={[styles.saveButton, saving && styles.buttonDisabled]}
                onPress={handleSaveExpense}
                disabled={saving}
                activeOpacity={0.8}
              >
                {saving ? (
                  <View style={styles.buttonLoadingContainer}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={[styles.saveButtonText, { marginLeft: 8 }]}>
                      {isEditing ? 'Updating...' : 'Saving...'}
                    </Text>
                  </View>
                ) : (
                  <>
                    <Ionicons 
                      name={isEditing ? 'checkmark-circle-outline' : 'add-circle-outline'} 
                      size={22} 
                      color="#FFFFFF" 
                      style={{ marginRight: 8 }}
                    />
                    <Text style={styles.saveButtonText}>
                      {isEditing ? 'Update Expense' : 'Add Expense'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </Animated.ScrollView>
        )}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: fonts.size.xl,
    fontWeight: fonts.weight.semibold,
    color: colors.text.primary,
    fontFamily: fonts.primary,
  },
  deleteButton: {
    padding: 8,
    borderRadius: 20,
  },
  scrollView: {
    flex: 1,
    backgroundColor: colors.background,
  },
  formContainer: {
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginLeft: 10,
    fontSize: fonts.size.regular,
    color: colors.text.secondary,
    fontFamily: fonts.primary,
  },
  buttonLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: fonts.size.regular,
    color: colors.text.primary,
    fontFamily: fonts.primary,
    outlineStyle: 'none', // Remove focus outline on web
  },
  textAreaWrapper: {
    height: 120,
    alignItems: 'flex-start',
  },
  textArea: {
    height: 120,
    paddingTop: 16,
  },
  currencyInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 60,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
  },
  currencySymbol: {
    fontSize: 24,
    color: colors.text.primary,
    paddingRight: 8,
    fontWeight: fonts.weight.semibold,
    fontFamily: fonts.primary,
  },
  currencyInput: {
    flex: 1,
    height: '100%',
    fontSize: 28,
    fontWeight: fonts.weight.semibold,
    color: colors.text.primary,
    fontFamily: fonts.primary,
    outlineStyle: 'none', // Remove focus outline on web
  },
  categoryGrid: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  categoryGridItem: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    minWidth: '33.3%',
  },
  selectedCategoryGridItem: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
  },
  categoryGridIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  categoryGridItemText: {
    fontSize: fonts.size.medium,
    textAlign: 'center',
    color: colors.text.secondary,
    fontWeight: fonts.weight.medium,
    fontFamily: fonts.primary,
  },
  selectedCategoryGridItemText: {
    fontWeight: fonts.weight.semibold,
    fontFamily: fonts.primary,
  },
  dateSelector: {
    flexDirection: 'row',
    height: 56,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
  },
  dateText: {
    fontSize: fonts.size.regular,
    color: colors.text.primary,
    flex: 1,
    fontFamily: fonts.primary,
  },
  modalOverlay: {
    flex: 1, 
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)'
  },
  modalContainer: {
    width: '100%',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 5,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickerHeaderText: {
    color: '#007AFF',
    fontSize: fonts.size.regular,
    fontWeight: fonts.weight.semibold,
    fontFamily: fonts.primary,
  },
  pickerTitle: {
    fontSize: fonts.size.regular,
    fontWeight: fonts.weight.semibold,
    color: colors.text.primary,
    fontFamily: fonts.primary,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    flexDirection: 'row',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: fonts.size.large,
    fontWeight: fonts.weight.semibold,
    fontFamily: fonts.primary,
  },
  webDatePickerContainer: {
    marginTop: 8,
    width: '100%',
    padding: 8,
    backgroundColor: colors.card,
  },
  datePickerContainer: {
    backgroundColor: colors.card,
    borderRadius: 12,
    marginTop: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  datePickerTitle: {
    fontSize: fonts.size.regular,
    fontWeight: fonts.weight.semibold,
    color: colors.text.primary,
    fontFamily: fonts.primary,
  },
  datePickerButtonText: {
    fontSize: fonts.size.regular,
    color: colors.primary,
    fontFamily: fonts.primary,
  },
});