import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function IntroScreen() {
  const router = useRouter();

  useEffect(() => {
    console.log('Intro screen mounted');
    // Auto navigate to login after 3 seconds
    const timer = setTimeout(() => {
      console.log('Attempting to navigate to login...');
      router.replace('/Login');
    }, 3000);

    return () => {
      console.log('Cleaning up timer');
      clearTimeout(timer);
    };
  }, []);

  const handleSkipIntro = () => {
    console.log('Skip button pressed');
    router.replace('/Login');
  };

  return (
    <View style={styles.container}>
      <View style={styles.overlay}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>🏔️</Text>
          <Text style={styles.subtitle}>Hiking Adventures</Text>
          <Text style={styles.description}>Discover Amazing Trails</Text>
        </View>
        
        <TouchableOpacity 
          style={styles.skipButton}
          onPress={handleSkipIntro}
        >
          <Text style={styles.skipButtonText}>Skip Intro</Text>
          <Ionicons name="arrow-forward" size={20} color="#2C3E50" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5E6D3',
  },
  overlay: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#2C3E50',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2C3E50',
    textAlign: 'center',
    marginBottom: 10,
  },
  description: {
    fontSize: 18,
    color: '#6B7280',
    textAlign: 'center',
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  skipButtonText: {
    fontSize: 16,
    color: '#2C3E50',
    marginRight: 8,
  },
});
