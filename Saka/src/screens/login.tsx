import { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Animated, Easing } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { signIn, isLoading } = useAuthStore();
  
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, []);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }

    const { error } = await signIn(email, password);

    if (error) {
      Alert.alert('Error', error);
    } else {
      // Check if user is admin and redirect accordingly
      const authState = useAuthStore.getState();
      console.log('Login successful, user:', authState.user);
      console.log('Is admin:', authState.user?.is_admin);
      
      if (authState.user?.is_admin) {
        console.log('Redirecting to admin screen...');
        router.replace('/drawer/admin/[...admin]');
      } else {
        console.log('Redirecting to home screen...');
        router.replace('/drawer/home');
      }
    }
  };

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim, backgroundColor: '#F5E6D3' }]}>
      <View style={styles.leftPanel}>
        <Text style={styles.logo}>🏔️</Text>
        <Text style={styles.title}>Welcome Back</Text>
        <Text style={styles.subtitle}>Sign in to continue</Text>
      </View>
      
      <View style={styles.rightPanel}>
        <View style={styles.inputWrapper}>
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
        </View>

        <View style={styles.passwordInputWrapper}>
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#8B7355"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            editable={!isLoading}
          />
          <TouchableOpacity 
            style={styles.eyeIcon}
            onPress={() => setShowPassword(!showPassword)}
          >
            <Ionicons 
              name={showPassword ? 'eye-off' : 'eye'} 
              size={20} 
              color="#8B7355" 
            />
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={[styles.button, isLoading && styles.buttonDisabled]} 
          onPress={handleLogin}
          disabled={isLoading}
        >
          <View style={styles.submitContainer}>
            <Ionicons name="log-in" size={16} color="#FFFFFF" />
            <Text style={styles.buttonText}>
              {isLoading ? 'Signing In...' : 'Sign In'}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/forgot')}>
          <Text style={styles.forgotLink}>Forgot password?</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/signup')}>
          <Text style={styles.link}>Don't have an account? Sign Up</Text>
        </TouchableOpacity>

        {/* Demo mode removed */}
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
    flex: 1,
    height: 44,
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#6B7280',
  },
  inputWrapper: {
    borderWidth: 1,
    borderColor: '#D4A574',
    borderRadius: 8,
    backgroundColor: '#FAFAFA',
    marginBottom: 12,
  },
  passwordInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D4A574',
    borderRadius: 8,
    paddingRight: 12,
    backgroundColor: '#FAFAFA',
    marginBottom: 12,
  },
  eyeIcon: {
    padding: 4,
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
  submitContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  link: {
    color: '#2C3E50',
    fontSize: 14,
    textAlign: 'center',
  },
  forgotLink: {
    color: '#8B7355',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 14,
  },
});
