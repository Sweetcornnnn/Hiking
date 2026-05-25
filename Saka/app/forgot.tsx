import { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Animated, Easing } from 'react-native';
import { useRouter } from 'expo-router';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, []);

  const handleReset = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    setIsLoading(true);

    // Placeholder behavior: replace with real password reset API when available.
    setTimeout(() => {
      setIsLoading(false);
      Alert.alert(
        'Reset Email Sent',
        'If this email exists in our system, a password reset link has been sent.'
      );
      router.replace('/login');
    }, 700);
  };

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim, backgroundColor: '#F5E6D3' }]}> 
      <View style={styles.leftPanel}>
        <Text style={styles.logo}>🔐</Text>
        <Text style={styles.title}>Forgot Password</Text>
        <Text style={styles.subtitle}>Enter your email to reset your password</Text>
      </View>

      <View style={styles.rightPanel}>
        <TextInput
          style={styles.input}
          placeholder="Email address"
          placeholderTextColor="#8B7355"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          editable={!isLoading}
        />

        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleReset}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>
            {isLoading ? 'Sending...' : 'Send Reset Link'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.replace('/login')}>
          <Text style={styles.link}>Back to Sign In</Text>
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
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: '#D4A574',
    borderRadius: 8,
    paddingHorizontal: 16,
    backgroundColor: '#FAFAFA',
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
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
    opacity: 0.6,
    backgroundColor: '#A0C4A2',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  link: {
    color: '#2C3E50',
    fontSize: 14,
    textAlign: 'center',
  },
});
