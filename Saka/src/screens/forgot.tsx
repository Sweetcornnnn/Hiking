import { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Animated, Easing } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import { API_BASE_URL } from '../config/api';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { user, authToken } = useAuthStore();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, []);

  const getPasswordStrength = (password: string): { strength: 'weak' | 'fair' | 'strong'; color: string } => {
    if (password.length === 0) return { strength: 'weak', color: '#D1D5DB' };
    if (password.length < 8) return { strength: 'weak', color: '#EF4444' };
    if (password.length < 12) return { strength: 'fair', color: '#F59E0B' };
    return { strength: 'strong', color: '#10B981' };
  };

  const checkPasswordRequirements = (pwd: string) => {
    return {
      hasNumber: /\d/.test(pwd),
      hasUpperCase: /[A-Z]/.test(pwd),
      hasLowerCase: /[a-z]/.test(pwd),
      hasSymbol: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd),
      isLongEnough: pwd.length >= 6,
    };
  };

  const passwordStrength = getPasswordStrength(newPassword);
  const requirements = checkPasswordRequirements(newPassword);
  const allRequirementsMet = Object.values(requirements).every(val => val === true);
  const doPasswordsMatch = newPassword === confirmPassword && newPassword.length > 0;
  const canSubmit = allRequirementsMet && doPasswordsMatch && !isLoading;

  const handleReset = async () => {
    if (!newPassword) {
      Alert.alert('Error', 'Please enter your new password');
      return;
    }

    if (!confirmPassword) {
      Alert.alert('Error', 'Please confirm your password');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (!allRequirementsMet) {
      Alert.alert('Error', 'Password must contain a number, uppercase letter, lowercase letter, and symbol');
      return;
    }

    setIsLoading(true);

    try {
      console.log(`Requesting password change to ${API_BASE_URL}/api/password-change-request`);
      const response = await fetch(`${API_BASE_URL}/api/password-change-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          userId: user?.id,
          newPassword: newPassword,
        }),
      });

      console.log('Response status:', response.status);
      const data = await response.json();
      console.log('Response data:', data);

      if (!response.ok) {
        setIsLoading(false);
        Alert.alert('Error', data.error || 'Failed to request password change');
        return;
      }

      setIsLoading(false);
      Alert.alert(
        'Request Sent ✓',
        'Your password change request has been sent to admin for approval. You will be redirected to login.',
        [{ text: 'OK', onPress: () => router.replace('/login') }]
      );
    } catch (error: any) {
      setIsLoading(false);
      console.log('Error:', error.message);
      Alert.alert('Error', error.message || 'Network error');
    }
  };

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim, backgroundColor: '#F5E6D3' }]}> 
      <View style={styles.leftPanel}>
        <Text style={styles.logo}>🔐</Text>
        <Text style={styles.title}>Change Password</Text>
        <Text style={styles.subtitle}>Secure your account with a new password</Text>
        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={16} color="#2C3E50" />
          <Text style={styles.infoText}>Admin approval required</Text>
        </View>
      </View>

      <View style={styles.rightPanel}>
        {/* New Password Field */}
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>New Password</Text>
          <View style={styles.passwordInputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="Enter new password"
              placeholderTextColor="#8B7355"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry={!showNewPassword}
              editable={!isLoading}
            />
            <TouchableOpacity 
              style={styles.eyeIcon}
              onPress={() => setShowNewPassword(!showNewPassword)}
            >
              <Ionicons 
                name={showNewPassword ? 'eye-off' : 'eye'} 
                size={20} 
                color="#8B7355" 
              />
            </TouchableOpacity>
          </View>

          {/* Password Strength Indicator */}
          {newPassword.length > 0 && (
            <View style={styles.strengthContainer}>
              <View style={[styles.strengthBar, { backgroundColor: passwordStrength.color }]} />
              <Text style={[styles.strengthText, { color: passwordStrength.color }]}>
                {passwordStrength.strength.charAt(0).toUpperCase() + passwordStrength.strength.slice(1)} strength
              </Text>
            </View>
          )}

          {/* Password Requirements */}
          <View style={styles.requirementsContainer}>
            <View style={styles.requirementRow}>
              <Ionicons 
                name={requirements.hasNumber ? 'checkmark-circle' : 'close-circle'} 
                size={14} 
                color={requirements.hasNumber ? '#10B981' : '#D1D5DB'} 
              />
              <Text style={[styles.requirementText, { color: requirements.hasNumber ? '#10B981' : '#9CA3AF' }]}>
                At least one number
              </Text>
            </View>
            <View style={styles.requirementRow}>
              <Ionicons 
                name={requirements.hasUpperCase ? 'checkmark-circle' : 'close-circle'} 
                size={14} 
                color={requirements.hasUpperCase ? '#10B981' : '#D1D5DB'} 
              />
              <Text style={[styles.requirementText, { color: requirements.hasUpperCase ? '#10B981' : '#9CA3AF' }]}>
                At least one uppercase letter
              </Text>
            </View>
            <View style={styles.requirementRow}>
              <Ionicons 
                name={requirements.hasLowerCase ? 'checkmark-circle' : 'close-circle'} 
                size={14} 
                color={requirements.hasLowerCase ? '#10B981' : '#D1D5DB'} 
              />
              <Text style={[styles.requirementText, { color: requirements.hasLowerCase ? '#10B981' : '#9CA3AF' }]}>
                At least one lowercase letter
              </Text>
            </View>
            <View style={styles.requirementRow}>
              <Ionicons 
                name={requirements.hasSymbol ? 'checkmark-circle' : 'close-circle'} 
                size={14} 
                color={requirements.hasSymbol ? '#10B981' : '#D1D5DB'} 
              />
              <Text style={[styles.requirementText, { color: requirements.hasSymbol ? '#10B981' : '#9CA3AF' }]}>
                At least one symbol (!@#$%^&*)
              </Text>
            </View>
          </View>
        </View>

        {/* Confirm Password Field */}
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Confirm Password</Text>
          <View style={styles.passwordInputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="Confirm password"
              placeholderTextColor="#8B7355"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirmPassword}
              editable={!isLoading}
            />
            <TouchableOpacity 
              style={styles.eyeIcon}
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              <Ionicons 
                name={showConfirmPassword ? 'eye-off' : 'eye'} 
                size={20} 
                color="#8B7355" 
              />
            </TouchableOpacity>
          </View>

          {/* Match Indicator */}
          {confirmPassword.length > 0 && (
            <View style={styles.matchRow}>
              <Ionicons 
                name={doPasswordsMatch ? 'checkmark-circle' : 'close-circle'} 
                size={14} 
                color={doPasswordsMatch ? '#10B981' : '#EF4444'} 
              />
              <Text style={[styles.matchText, { color: doPasswordsMatch ? '#10B981' : '#EF4444' }]}>
                {doPasswordsMatch ? 'Passwords match' : 'Passwords do not match'}
              </Text>
            </View>
          )}
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.button, !canSubmit && styles.buttonDisabled]}
          onPress={handleReset}
          disabled={!canSubmit}
        >
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <Ionicons name="hourglass" size={16} color="#FFFFFF" style={styles.spinner} />
              <Text style={styles.buttonText}>Sending Request...</Text>
            </View>
          ) : (
            <View style={styles.submitContainer}>
              <Ionicons name="checkmark" size={16} color="#FFFFFF" />
              <Text style={styles.buttonText}>Request Password Change</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Back to Login Link */}
        <TouchableOpacity onPress={() => router.replace('/login')} style={styles.linkContainer}>
          <Ionicons name="arrow-back" size={14} color="#2C3E50" />
          <Text style={styles.link}>Back to Login</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#F5E6D3',
    paddingHorizontal: 40,
    paddingVertical: 20,
  },
  leftPanel: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingRight: 30,
  },
  rightPanel: {
    flex: 1.5,
    justifyContent: 'center',
    paddingLeft: 30,
  },
  logo: {
    fontSize: 48,
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 20,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(44, 62, 80, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#2C3E50',
    fontWeight: '500',
  },
  fieldContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 8,
  },
  passwordInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D4A574',
    borderRadius: 8,
    paddingRight: 12,
    backgroundColor: '#FAFAFA',
  },
  input: {
    flex: 1,
    height: 44,
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#6B7280',
  },
  eyeIcon: {
    padding: 4,
  },
  strengthContainer: {
    marginTop: 8,
    gap: 6,
  },
  strengthBar: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
  },
  strengthText: {
    fontSize: 12,
    fontWeight: '500',
  },
  requirementsContainer: {
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: '#F9FAFB',
    borderRadius: 6,
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  requirementText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  matchRow: {
    marginTop: 8,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  matchText: {
    fontSize: 12,
    fontWeight: '500',
  },
  button: {
    backgroundColor: '#2C3E50',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  buttonDisabled: {
    opacity: 0.5,
    backgroundColor: '#A0C4A2',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  submitContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  spinner: {
    opacity: 0.8,
  },
  linkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  link: {
    color: '#2C3E50',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
});
