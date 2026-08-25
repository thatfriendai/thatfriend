export type TripStatus = "planning" | "confirmed" | "archived";

export type ParticipantRole = "organizer" | "guest";

export type PreferenceCategory =
  | "Dates"
  | "Budget"
  | "Location"
  | "Activity"
  | "Veto";

export type PreferenceType = "Preference" | "Constraint" | "Veto";

export interface Trip {
  id: string;
  name: string;
  target_dates: string | null;
  status: TripStatus;
  created_by: string;
  created_at: string;
}

export interface Participant {
  id: string;
  trip_id: string;
  name: string;
  email: string | null;
  role: ParticipantRole;
  created_at: string;
}

export interface Preference {
  id: string;
  trip_id: string;
  participant_id: string;
  category: PreferenceCategory;
  value: string;
  type: PreferenceType;
  source_text: string | null;
  is_anonymous: boolean;
  created_at: string;
}

export interface Place {
  id: string;
  trip_id: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  category: string | null;
  added_by: string | null;
  created_at: string;
}

export interface PlaceNote {
  id: string;
  trip_id: string;
  place_id: string;
  participant_id: string | null;
  text: string;
  created_at: string;
}

export interface PreferenceWithParticipant extends Preference {
  participants: Pick<Participant, "id" | "name" | "role"> | null;
}

export interface PlaceNoteWithParticipant extends PlaceNote {
  participants: Pick<Participant, "id" | "name" | "role"> | null;
}

export interface PlaceWithParticipant extends Place {
  participants: Pick<Participant, "id" | "name" | "role"> | null;
  place_notes: PlaceNoteWithParticipant[];
}
