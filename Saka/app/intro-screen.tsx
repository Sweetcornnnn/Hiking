import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';

const { width, height } = Dimensions.get('window');

export default function IntroScreen() {
  const navigation = useNavigation();

  const fadeAnim = useRef<Animated.Value>(new Animated.Value(0));
  const textAnim = useRef<Animated.Value>(new Animated.Value(0));

  useEffect(() => {
    // Fade in animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();

    // Text slide animation
    Animated.timing(textAnim, {
      toValue: 1,
      duration: 1500,
      useNativeDriver: true,
    }).start();

    // Auto navigate to signup after 3 seconds
    const timer = setTimeout(() => {
      navigation.navigate('Signup' as any);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View 
        style={[
          styles.background,
          {
            opacity: fadeAnim,
          }
        ]}
      >
        <View style={styles.overlay}>
          <Animated.View
            style={[
              styles.titleContainer,
              {
                transform: [
                  {
                    translateX: textAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-50, 0],
                      extrapolate: 'clamp',
                    }),
                  },
                ],
              },
            ]}
          >
            <Animated.Text style={styles.title}>Hiking Adventures</Animated.Text>
            <Animated.Text style={styles.subtitle}>Discover Amazing Trails</Animated.Text>
          </Animated.View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  background: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#F5E6D3',
  },
  overlay: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2C3E50',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    color: '#6B7280',
    textAlign: 'center',
  },
});
