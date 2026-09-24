export interface JournalEntry {
  id: string;
  user_id: string;
  mountain_id: string | null;
  hike_id: string | null;
  title: string;
  content: string;
  images: string[];
  rating: number | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface JournalImage {
  uri: string;
  mimeType?: string | null;
}

export interface CreateJournalEntryInput {
  title: string;
  content: string;
  images: JournalImage[];
  rating?: number;
  mountainId?: string | null;
  hikeId?: string | null;
  isPublic?: boolean;
}
