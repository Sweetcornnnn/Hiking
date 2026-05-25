// locationApi.ts - Backend API utilities for location data
// Handles Supabase integration, retries, and error handling

import { supabase } from './supabase';

/**
 * Location data interface
 */
export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude?: number;
  heading?: number;
  speed?: number;
  timestamp: string;
  is_sos?: boolean;
}

/**
 * Upload location data to Supabase
 * Called for regular tracking and SOS events
 * 
 * @param location - Location data to upload
 * @param isSOS - Whether this is an SOS emergency upload
 * @returns Promise with upload result
 */
export async function uploadLocationToSupabase(
  location: LocationData,
  isSOS: boolean = false
): Promise<{ success: boolean; error?: string }> {
  try {
    // Prepare upload data
    const uploadData = {
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy: location.accuracy,
      altitude: location.altitude || null,
      heading: location.heading || null,
      speed: location.speed || null,
      timestamp: location.timestamp,
      is_sos: isSOS,
    };

    // Insert into hiker_locations table
    const { data, error } = await supabase
      .from('hiker_locations')
      .insert([uploadData]);

    if (error) {
      // Table might not exist in development mode
      if (error.code === 'PGRST116') {
        console.warn('Note: hiker_locations table not found. Create this table in Supabase:');
        console.warn(`
          CREATE TABLE hiker_locations (
            id bigint primary key generated always as identity,
            latitude float8 not null,
            longitude float8 not null,
            accuracy float8 not null,
            altitude float8,
            heading float8,
            speed float8,
            timestamp timestamp not null,
            is_sos boolean default false,
            user_id uuid references auth.users,
            created_at timestamp default now()
          );
        `);
        return { success: true, error: 'Table not configured, but location saved locally' };
      }

      throw error;
    }

    console.log('✓ Location uploaded successfully');
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error uploading location:', message);
    return { success: false, error: message };
  }
}

/**
 * Get location history from backend
 * Retrieves all tracked locations for a user
 * 
 * @param limit - Maximum number of records to retrieve
 * @returns Promise with location history array
 */
export async function getLocationHistory(
  limit: number = 100
): Promise<LocationData[]> {
  try {
    const { data, error } = await supabase
      .from('hiker_locations')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) {
      if (error.code === 'PGRST116') {
        return [];
      }
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching location history:', error);
    return [];
  }
}

/**
 * Get latest SOS alerts
 * For emergency monitoring dashboard
 * 
 * @returns Promise with recent SOS locations
 */
export async function getSOSAlerts(): Promise<LocationData[]> {
  try {
    const { data, error } = await supabase
      .from('hiker_locations')
      .select('*')
      .eq('is_sos', true)
      .order('timestamp', { ascending: false })
      .limit(20);

    if (error) {
      if (error.code === 'PGRST116') {
        return [];
      }
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching SOS alerts:', error);
    return [];
  }
}

/**
 * Calculate distance between two coordinates
 * Using Haversine formula for accurate Earth distances
 * 
 * @param lat1 - First latitude
 * @param lon1 - First longitude
 * @param lat2 - Second latitude
 * @param lon2 - Second longitude
 * @returns Distance in kilometers
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance;
}

/**
 * Calculate time difference in minutes
 * @param timestamp1 - First timestamp
 * @param timestamp2 - Second timestamp
 * @returns Minutes difference
 */
export function getTimeDifference(
  timestamp1: string,
  timestamp2: string
): number {
  const date1 = new Date(timestamp1).getTime();
  const date2 = new Date(timestamp2).getTime();
  const diffMs = Math.abs(date2 - date1);
  return Math.floor(diffMs / 60000); // Convert to minutes
}

/**
 * Format location for display
 * @param location - Location data
 * @returns Formatted string
 */
export function formatLocation(location: LocationData): string {
  return `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`;
}

/**
 * Format timestamp for display
 * @param timestamp - ISO timestamp string
 * @returns Formatted date string
 */
export function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString();
}

/**
 * Check if location accuracy is acceptable
 * GPS accuracy varies, this helps filter poor readings
 * 
 * @param accuracy - Accuracy in meters
 * @returns true if accuracy is good
 */
export function isAccuracyGood(accuracy: number): boolean {
  return accuracy <= 50; // 50 meters or better
}

/**
 * Get accuracy level description
 * @param accuracy - Accuracy in meters
 * @returns Description string
 */
export function getAccuracyLevel(accuracy: number): string {
  if (accuracy <= 10) return 'Excellent';
  if (accuracy <= 30) return 'Good';
  if (accuracy <= 50) return 'Fair';
  if (accuracy <= 100) return 'Poor';
  return 'Very Poor';
}

/**
 * Share location via URL (for emergency contacts)
 * Generates a Google Maps link to current location
 * 
 * @param location - Location data
 * @returns Google Maps URL
 */
export function generateMapsShareUrl(location: LocationData): string {
  return `https://maps.google.com/?q=${location.latitude},${location.longitude}`;
}

/**
 * Create emergency contact notification payload
 * Used when SOS is triggered
 * 
 * @param location - Location data
 * @returns Notification payload
 */
export function createSOSNotification(location: LocationData) {
  return {
    title: '🚨 SOS Emergency Alert',
    body: `Hiker emergency at ${formatLocation(location)}`,
    latitude: location.latitude,
    longitude: location.longitude,
    timestamp: location.timestamp,
    mapUrl: generateMapsShareUrl(location),
    accuracy: `±${location.accuracy.toFixed(1)}m`,
  };
}

export default {
  uploadLocationToSupabase,
  getLocationHistory,
  getSOSAlerts,
  calculateDistance,
  getTimeDifference,
  formatLocation,
  formatTimestamp,
  isAccuracyGood,
  getAccuracyLevel,
  generateMapsShareUrl,
  createSOSNotification,
};
