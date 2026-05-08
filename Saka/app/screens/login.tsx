import { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Animated, Easing } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      router.replace('/home');
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

        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#8B7355"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={!isLoading}
        />

        <TouchableOpacity 
          style={[styles.button, isLoading && styles.buttonDisabled]} 
          onPress={handleLogin}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>
            {isLoading ? 'Signing In...' : 'Sign In'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/screens/signup')}>
          <Text style={styles.link}>Don't have an account? Sign Up</Text>
        </TouchableOpacity>

        <View style={styles.demoSection}>
          <View style={styles.divider} />
          <Text style={styles.orText}>or</Text>
          <TouchableOpacity 
            style={styles.demoButton}
            onPress={() => {
              useAuthStore.getState().demoLogin();
              router.replace('/home');
            }}
          >
            <Text style={styles.demoButtonText}>Try Demo Mode</Text>
          </TouchableOpacity>
          <Text style={styles.demoHint}>No login required • All features enabled</Text>
        </View>
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
  demoSection: {
    marginTop: 20,
    alignItems: 'center',
  },
  divider: {
    width: 100,
    height: 1,
    backgroundColor: '#D4A574',
    marginBottom: 8,
  },
  orText: {
    color: '#8B7355',
    fontSize: 12,
    marginBottom: 12,
  },
  demoButton: {
    backgroundColor: '#8B7355',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  demoButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  demoHint: {
    color: '#8B7355',
    fontSize: 11,
    marginTop: 8,
  },
});
