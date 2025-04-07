import React from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type ExpenseItemProps = {
  id: string;
  amount: number;
  storeName: string;
  category: string;
  date: string;
  creatorName: string;
  creatorAvatar: string | null;
  onPress: (id: string) => void;
};

// Function to generate category icon name
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

// Function to generate category color
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

// Format the date string
const formatDate = (dateString: string) => {
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return new Date(dateString).toLocaleDateString('en-US', options);
};

// Format amount as USD
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(amount);
};

const ExpenseItem = ({ 
  id, 
  amount, 
  storeName, 
  category, 
  date, 
  creatorName, 
  creatorAvatar, 
  onPress 
}: ExpenseItemProps) => {
  const categoryIcon = getCategoryIcon(category);
  const categoryColor = getCategoryColor(category);
  const formattedDate = formatDate(date);
  const formattedAmount = formatCurrency(amount);
  const creatorInitial = creatorName ? creatorName.charAt(0).toUpperCase() : '?';

  return (
    <TouchableOpacity 
      style={styles.container}
      onPress={() => onPress(id)}
      activeOpacity={0.7}
    >
      {/* Category Icon */}
      <View style={[styles.iconContainer, { backgroundColor: `${categoryColor}20` }]}>
        <Ionicons name={categoryIcon} size={22} color={categoryColor} />
      </View>
      
      {/* Expense Details */}
      <View style={styles.contentContainer}>
        <Text style={styles.storeName} numberOfLines={1}>
          {storeName}
        </Text>
        <View style={styles.detailsRow}>
          <Text style={styles.categoryText}>{category}</Text>
          <Text style={styles.dateText}>{formattedDate}</Text>
        </View>
      </View>
      
      {/* Amount and Creator */}
      <View style={styles.rightContainer}>
        <Text style={styles.amount}>{formattedAmount}</Text>
        <View style={styles.creatorContainer}>
          {creatorAvatar ? (
            <Image 
              source={{ uri: creatorAvatar }} 
              style={styles.creatorAvatar} 
            />
          ) : (
            <View style={styles.creatorAvatarPlaceholder}>
              <Text style={styles.creatorAvatarText}>{creatorInitial}</Text>
            </View>
          )}
          <Text style={styles.creatorName} numberOfLines={1}>
            {creatorName?.split(' ')[0]}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  storeName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryText: {
    fontSize: 14,
    color: '#666666',
  },
  dateText: {
    fontSize: 14,
    color: '#8E8E93',
    marginLeft: 8,
  },
  rightContainer: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  creatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  creatorAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 4,
  },
  creatorAvatarPlaceholder: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#E5E5EA',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
  },
  creatorAvatarText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#8E8E93',
  },
  creatorName: {
    fontSize: 12,
    color: '#8E8E93',
    maxWidth: 60,
  }
});

export default ExpenseItem;