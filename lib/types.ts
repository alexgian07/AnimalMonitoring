export type UserRole = "admin" | "researcher" | "viewer";
export type TurkeyStatus = "alive" | "culled" | "dead";
export type TurkeySex = "M" | "F" | "Unknown";
export type CullReason = "harvest" | "illness" | "injury" | "other";

export interface Location {
  id: string;
  name: string;
  description: string | null;
  position: number | null;
  side: "left" | "right" | null;
  created_at: string;
}

export interface Turkey {
  id: string;
  location_id: string;
  tag: string;
  sex: TurkeySex;
  birth_date: string | null;
  status: TurkeyStatus;
  notes: string | null;
  created_at: string;
}

export interface Measurement {
  id: string;
  turkey_id: string;
  location_id: string;
  measured_at: string;
  weight_kg: number | null;
  temperature_celsius: number | null;
  metatarsus_length_mm: number | null;
  metatarsus_diameter_mm: number | null;
  chest_width_mm: number | null;
  keel_length_mm: number | null;
  body_length_mm: number | null;
  notes: string | null;
  recorded_by: string;
  created_at: string;
}

export interface AviagenTarget {
  week_start: number;
  week_end: number | null;
  temp_min: number;
  temp_max: number;
  humid_min: number;
  humid_max: number;
  notes: string | null;
}

export interface DailyTemperature {
  id: string;
  location_id: string;
  recorded_on: string;
  temp_min: number | null;
  temp_max: number | null;
  temp_morning: number | null;
  temp_midday: number | null;
  temp_evening: number | null;
  humidity: number | null;
  mortality: number;
  sick_count: number;
  notes: string | null;
  recorded_by: string;
  created_at: string;
}

export interface FeedLog {
  id: string;
  location_id: string;
  feeder_label: string;
  week_number: number;
  week_start_date: string;
  weight_before_kg: number | null;
  feed_added_kg: number | null;
  weight_after_kg: number | null;
  consumption_kg: number | null;
  bird_count: number | null;
  avg_weight_kg: number | null;
  total_flock_kg: number | null;
  weight_gain_kg: number | null;
  notes: string | null;
  recorded_by: string;
  created_at: string;
}

export interface TaskTemplate {
  id: string;
  day_of_week: number;
  time_slot: string | null;
  task_label: string;
  category: string | null;
  position: number;
}

export interface SlaughterEvent {
  id: string;
  scheduled_on: string;
  notes: string | null;
}

export interface Cull {
  id: string;
  turkey_id: string;
  location_id: string;
  culled_at: string;
  weight_at_cull: number | null;
  reason: CullReason;
  notes: string | null;
  recorded_by: string;
  created_at: string;
}

export interface Profile {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  allowed_locations: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface LocationWithStats extends Location {
  alive_count: number;
  culled_count: number;
  avg_weight: number | null;
  last_measurement: string | null;
}

export interface TurkeyWithLatest extends Turkey {
  latest_weight: number | null;
  latest_temp: number | null;
  latest_measured_at: string | null;
}
