import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useWildTrackStore } from '../store/wildtrackStore';
import { getMountainById } from '../data/mountains';
import weatherService, { WeatherCondition } from '../services/weatherService';

export default function WeatherScreen() {
  const router = useRouter();
  const { selectedMountainId } = useWildTrackStore();
  const selectedMountain = getMountainById(selectedMountainId) || getMountainById('1');
  const [weather, setWeather] = useState<WeatherCondition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadWeather();
  }, [selectedMountainId]);

  const loadWeather = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!selectedMountain) {
        setError('No mountain selected for weather lookup. Please choose a mountain in WildTrack.');
        setWeather(null);
        return;
      }

      const currentWeather = await weatherService.getCurrentWeather(
        selectedMountain.latitude,
        selectedMountain.longitude
      );
      setWeather(currentWeather);
    } catch (error: any) {
      console.error('Weather screen load failed:', error);
      setError(error?.message || 'Unable to fetch weather data.');
      setWeather(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.page}>
      <View style={styles.card}>
        <View style={styles.leftPanel}>
          <Text style={styles.pageTitle}>Weather Overview</Text>
          <Text style={styles.pageSubtitle}>
            Current weather for {selectedMountain?.name ?? 'your selected mountain'}
          </Text>
          <View style={styles.dividerH} />
          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color="#C9A96E" />
              <Text style={styles.loadingText}>Fetching weather data…</Text>
            </View>
          ) : error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : weather ? (
            <>
              <Text style={styles.weatherValue}>{weather.temperature.toFixed(1)}°C</Text>
              <Text style={styles.weatherTitle}>{weather.description}</Text>
              <Text style={styles.tabPaneBody}>
                Feels like {weather.feelsLike.toFixed(1)}°C · Humidity {weather.humidity}% · Wind {weather.windSpeed.toFixed(1)} m/s
              </Text>
              {weather.precipitationMm > 0 && (
                <Text style={styles.tabPaneBody}>Precipitation: {weather.precipitationMm.toFixed(1)} mm</Text>
              )}
            </>
          ) : null}
        </View>

        <View style={styles.dividerV} />

        <View style={styles.rightPanel}>
          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>Weather Safety</Text>
            <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
              <Ionicons name="close" size={14} color="rgba(255,255,255,0.4)" />
            </TouchableOpacity>
          </View>

          <View style={styles.tabPane}>
            <Text style={styles.tabPaneTitle}>Advice</Text>
            <Text style={styles.tabPaneBody}>
              {weather
                ? weatherService.getWeatherSafetyAdvice(weather)
                : 'Weather advice will appear once data is loaded.'}
            </Text>
            <TouchableOpacity style={styles.tabPaneBtn} onPress={loadWeather}>
              <Text style={styles.tabPaneBtnText}>Refresh Weather</Text>
              <Ionicons name="refresh" size={11} color="#C9A96E" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#0E1520',
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: '92%',
    maxWidth: 960,
    minHeight: 320,
    flexDirection: 'row',
    backgroundColor: '#111927',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  leftPanel: {
    flex: 1,
    padding: 24,
    backgroundColor: '#121B2A',
  },
  rightPanel: {
    flex: 1,
    padding: 24,
    backgroundColor: '#0E1520',
  },
  pageTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
  },
  pageSubtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    marginBottom: 18,
    lineHeight: 18,
  },
  dividerH: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginBottom: 18,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  listTitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabPane: {
    flex: 1,
    justifyContent: 'space-between',
    gap: 12,
  },
  tabPaneTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  tabPaneBody: {
    color: 'rgba(255,255,255,0.48)',
    fontSize: 12,
    lineHeight: 18,
  },
  tabPaneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(201,169,110,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(201,169,110,0.25)',
    alignSelf: 'flex-start',
  },
  tabPaneBtnText: {
    color: '#C9A96E',
    fontSize: 12,
    fontWeight: '700',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 12,
  },
  errorText: {
    color: '#F38B5C',
    fontSize: 12,
    lineHeight: 18,
  },
  weatherValue: {
    color: '#C9A96E',
    fontSize: 42,
    fontWeight: '900',
    marginTop: 10,
  },
  weatherTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 6,
    marginBottom: 10,
  },
});
