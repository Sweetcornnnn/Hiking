export interface User {
  id: string;
  email: string;
  name: string;
  is_admin: boolean;
}

export interface Hike {
  id: string;
  user_id: string;
  date: string;
  start_time: string;
  end_time: string;
  tagalongs: number;
  contact_number: string;
  emergency_contact: string;
  created_at: string;
  user?: {
    email: string;
    name: string;
  };
}

export interface Mountain {
  id: string;
  name: string;
  image: any;
  viewpoints: Viewpoint[];
}

export interface Viewpoint {
  id: string;
  name: string;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  image: any;
  description: string;
}

export interface Species {
  id: number;
  scientific_name: string;
  common_name: string;
  category: string;
  conservation_status?: string;
  gbif_id?: number;
  inaturalist_id?: number;
  image_url?: string;
  description?: string;
  habitat?: string;
  fun_facts?: string;
  is_endemic?: boolean;
  mountain_id?: string;
  discovered?: boolean;
}

export interface Discovery {
  id: number;
  user_id: number;
  species_id: number;
  mountain_id: string;
  discovered_at: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
  scientific_name?: string;
  common_name?: string;
  category?: string;
  image_url?: string;
  conservation_status?: string;
}

export interface RootStackParamList {
  Intro: undefined;
  Login: undefined;
  Signup: undefined;
  Home: undefined;
  Viewpoint: { viewpointId: string; mountainId: string };
  Calendar: undefined;
  AddHike: { hike?: Hike };
  Admin: undefined;
  WildTrack: undefined;
  SpeciesDetail: { speciesId: number };
  MyDiscoveries: undefined;
}
