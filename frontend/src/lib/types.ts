// Types mirroring the AgroDoc backend schemas.

export type UserRole = "farmer" | "expert" | "admin";

export interface User {
  id: number;
  full_name: string;
  email: string;
  phone: string | null;
  preferred_language: string;
  state: string | null;
  role: UserRole;
  is_active: boolean;
  is_verified: boolean;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface Plot {
  id: number;
  farm_id: number;
  name: string;
  crop: string | null;
  variety: string | null;
  growth_stage: string | null;
  planting_date: string | null;
  soil_type: string | null;
  irrigation_type: string | null;
  latitude: number | null;
  longitude: number | null;
  boundary_geojson: string | null;
  area_acres: number | null;
  created_at: string;
  updated_at: string;
}

export interface Farm {
  id: number;
  owner_id: number;
  name: string;
  state: string | null;
  district: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  plots: Plot[];
}

export interface DiagnosisAlternative {
  name: string;
  confidence: number;
  notes: string | null;
}

export interface DiagnosisOutcome {
  crop_identification: string | null;
  suspected_condition: string;
  confidence: number;
  uncertainty_label: string | null;
  supporting_symptoms: string[];
  alternative_possibilities: DiagnosisAlternative[];
  suggested_next_steps: string[];
  prevention_advice: string[];
  agricultural_references: string[];
  follow_up_monitoring: string | null;
  disclaimer: string;
}

export interface DiagnosisResponse {
  status: "ok" | "unavailable" | "error";
  image_id: number;
  provider: string;
  model_version: string;
  analyzed_at: string;
  outcome: DiagnosisOutcome | null;
  message: string | null;
}

export interface CurrentWeather {
  time: string;
  temperature_c: number;
  apparent_temperature_c: number | null;
  relative_humidity_pct: number | null;
  precipitation_mm: number | null;
  precipitation_probability_pct: number | null;
  wind_speed_kmh: number | null;
  wind_direction_deg: number | null;
  weather_code: number | null;
  is_day: boolean | null;
}

export interface HourlyPoint {
  time: string;
  temperature_c: number | null;
  precipitation_mm: number | null;
  precipitation_probability_pct: number | null;
  wind_speed_kmh: number | null;
  relative_humidity_pct: number | null;
}

export interface DailyPoint {
  date: string;
  weather_code: number | null;
  temp_max_c: number | null;
  temp_min_c: number | null;
  precipitation_sum_mm: number | null;
  precipitation_probability_max_pct: number | null;
  wind_speed_max_kmh: number | null;
  sunrise: string | null;
  sunset: string | null;
}

export interface WeatherAdvice {
  rain_risk: string;
  spray_suitable: boolean;
  tips: string[];
}

export interface WeatherResponse {
  source: string;
  fetched_at: string;
  latitude: number;
  longitude: number;
  current: CurrentWeather | null;
  hourly: HourlyPoint[];
  daily: DailyPoint[];
  advice: WeatherAdvice | null;
}
