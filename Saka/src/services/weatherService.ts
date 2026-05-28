import Constants from 'expo-constants';

export type WeatherCondition = {
  description: string;
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  precipitationMm: number;
  icon: string;
};

const OPENWEATHER_BASE_URL = 'https://api.openweathermap.org/data/2.5/weather';
const OPENWEATHER_ONECALL_URL = 'https://api.openweathermap.org/data/2.5/onecall';

const getWeatherApiKey = (): string | undefined => {
  const manifest = Constants.manifest || (Constants.expoConfig as any);
  const extra = manifest?.extra || {};
  return (
    extra.WEATHER_API_KEY ||
    process.env.EXPO_PUBLIC_WEATHER_API_KEY ||
    process.env.WEATHER_API_KEY ||
    process.env.EXPO_WEATHER_API_KEY
  );
};

const apiKey = getWeatherApiKey();

const handleError = (message: string) => {
  throw new Error(message);
};

export type WeatherForecastDay = {
  date: string;
  description: string;
  tempMin: number;
  tempMax: number;
  icon: string;
};

export const getCurrentWeather = async (
  latitude: number,
  longitude: number
): Promise<WeatherCondition> => {
  if (!apiKey) {
    handleError(
      'Weather API key not found. Set EXPO_PUBLIC_WEATHER_API_KEY or add WEATHER_API_KEY to expo.extra.'
    );
  }

  const url = `${OPENWEATHER_BASE_URL}?lat=${latitude}&lon=${longitude}&units=metric&appid=${apiKey}`;
  const response = await fetch(url);

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`OpenWeatherMap request failed: ${response.status} ${payload}`);
  }

  const data = await response.json();

  const precipitationMm =
    (data.rain?.['1h'] ?? data.snow?.['1h'] ?? 0) as number;

  return {
    description: data.weather?.[0]?.description || 'Unknown',
    temperature: Number(data.main?.temp ?? 0),
    feelsLike: Number(data.main?.feels_like ?? 0),
    humidity: Number(data.main?.humidity ?? 0),
    windSpeed: Number(data.wind?.speed ?? 0),
    precipitationMm,
    icon: data.weather?.[0]?.icon || '01d',
  };
};

export const getWeatherForecast = async (
  latitude: number,
  longitude: number
): Promise<WeatherForecastDay[]> => {
  if (!apiKey) {
    handleError(
      'Weather API key not found. Set EXPO_PUBLIC_WEATHER_API_KEY or add WEATHER_API_KEY to expo.extra.'
    );
  }

  const url = `${OPENWEATHER_ONECALL_URL}?lat=${latitude}&lon=${longitude}&exclude=current,minutely,hourly,alerts&units=metric&appid=${apiKey}`;
  const response = await fetch(url);

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`OpenWeatherMap forecast request failed: ${response.status} ${payload}`);
  }

  const data = await response.json();
  const timezoneOffset = Number(data.timezone_offset ?? 0);

  return (data.daily ?? []).map((day: any) => ({
    date: new Date((day.dt + timezoneOffset) * 1000).toISOString().split('T')[0],
    description: day.weather?.[0]?.description || 'Unknown',
    tempMin: Number(day.temp?.min ?? 0),
    tempMax: Number(day.temp?.max ?? 0),
    icon: day.weather?.[0]?.icon || '01d',
  }));
};

export const getWeatherSafetyAdvice = (weather: WeatherCondition): string => {
  if (weather.precipitationMm >= 5) {
    return 'Heavy precipitation expected. Use waterproof gear and avoid slippery trails.';
  }

  if (weather.windSpeed >= 12) {
    return 'Strong wind conditions detected. Stay clear of exposed ridges and loose terrain.';
  }

  if (weather.temperature <= 0) {
    return 'Freezing temperatures. Wear warm layers and watch for ice.';
  }

  if (weather.temperature >= 30) {
    return 'Hot conditions. Stay hydrated and avoid midday sun.';
  }

  if (weather.precipitationMm > 0) {
    return 'Light rain or snow is present. Take care on wet trails and pack a rain shell.';
  }

  return 'Weather is currently mild. Continue to monitor conditions while hiking.';
};

export default {
  getCurrentWeather,
  getWeatherSafetyAdvice,
};
