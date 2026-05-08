export type UserRole = "admin" | "researcher" | "viewer";
export type TurkeyStatus = "alive" | "culled" | "dead";
export type TurkeySex = "M" | "F" | "Unknown";
export type CullReason = "harvest" | "illness" | "injury" | "other";

export interface Location {
  id: string;
  name: string;
  description: string | null;
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
  notes: string | null;
  recorded_by: string;
  created_at: string;
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
