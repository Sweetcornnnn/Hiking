import { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Animated, Easing } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../src/store/authStore';

export default function SignupScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const { signUp, isLoading } = useAuthStore();
  
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, []);

  const handleSignup = async () => {
    if (!email || !password || !confirmPassword || !name) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    const { error } = await signUp(email, password, name);

    if (error) {
      Alert.alert('Error', error);
    } else {
      Alert.alert('Success', 'Account created! Please sign in.');
      router.replace('/login');
    }
  };

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim, backgroundColor: '#F5E6D3' }]}>
      <View style={styles.leftPanel}>
        <Text style={styles.logo}>🏔️</Text>
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Join the hiking community</Text>
      </View>
      
      <View style={styles.rightPanel}>
        <TextInput
          style={styles.input}
          placeholder="Full name"
          placeholderTextColor="#8B7355"
          value={name}
          onChangeText={setName}
          editable={!isLoading}
        />

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

        <TextInput
          style={styles.input}
          placeholder="Confirm password"
          placeholderTextColor="#8B7355"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          editable={!isLoading}
        />

        <TouchableOpacity 
          style={[styles.button, isLoading && styles.buttonDisabled]} 
          onPress={handleSignup}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>
            {isLoading ? 'Creating Account...' : 'Sign Up'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/login')}>
          <Text style={styles.link}>Already have an account? Sign In</Text>
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
