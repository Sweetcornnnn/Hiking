import Constants from 'expo-constants';

// API configuration for different environments
const getApiUrl = () => {
  // For development, use the IP address when on physical device
  // For web/simulator, use localhost
  if (__DEV__) {
    // Check if we're running on a physical device
    if (Constants.platform?.web) {
      return 'http://localhost:3000';
    } else {
      // For physical devices, use your computer's IP address
      return 'http://10.0.6.50:3000';
    }
  }
  
  // For production, use your production API URL
  return 'https://your-production-api.com';
};

export const API_BASE_URL = getApiUrl();
