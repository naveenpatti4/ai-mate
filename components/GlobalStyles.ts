// Global styles for consistent UI across the app
export const fonts = {
  primary: 'apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  size: {
    small: 12,
    medium: 14,
    regular: 16,
    large: 18,
    xl: 24,
    xxl: 28
  },
  weight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700
  }
};

export const colors = {
  primary: '#000000', // Black instead of blue gradient
  secondary: '#666666',
  background: '#F8F9FA',
  card: '#FFFFFF',
  border: '#E5E5EA',
  text: {
    primary: '#1A1A1A',
    secondary: '#666666',
    muted: '#8E8E93'
  },
  success: '#34C759',
  warning: '#FF9500',
  error: '#FF3B30'
};

// Common input styles with no distracting focus border
export const inputStyles = {
  container: {
    marginBottom: 24,
  },
  label: {
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
    outlineStyle: 'none', // Remove focus outline on web
  },
};

// Common button styles
export const buttonStyles = {
  primary: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  text: {
    color: '#FFFFFF',
    fontSize: fonts.size.regular,
    fontWeight: fonts.weight.semibold,
    fontFamily: fonts.primary,
  }
};