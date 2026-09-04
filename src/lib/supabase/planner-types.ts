export type TripPrivacy = "private" | "open";
export type MembershipRole = "owner" | "member";
export type InviteChannel = "email" | "sms" | "link";
export type Pace = "Slow" | "Balanced" | "Packed";
export type PlaceKind = "Restaurants" | "Coffee shops" | "Bars" | "Museums" | "Activities" | "Other";
export type ResourceType = "link" | "text" | "screenshot";
export type DecisionStatus = "open" | "closed";
export type PaceFeedback = "saw_everything" | "about_right" | "not_enough_time" | "too_packed";
export type DecisionKind = "general" | "lodging";

export interface PlannerUser {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  whatsapp_opt_in: boolean;
  auth_user_id: string | null;
  created_at: string;
  username: string | null;
  tagline: string | null;
}

export interface PlannerFollow {
  follower_id: string;
  followee_id: string;
  created_at: string;
}

export interface AmenityEntry {
  label: string;
  available: boolean;
}

export interface PlannerTrip {
  id: string;
  name: string;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  occasion: string | null;
  budget_band: string | null;
  privacy: TripPrivacy;
  created_by: string;
  created_at: string;
  dates_locked_at: string | null;
  dates_flagged_by: string | null;
  dates_flagged_at: string | null;
  dates_flag_note: string | null;
  share_token: string | null;
  twilio_conversation_sid: string | null;
  preferences_skipped_at: string | null;
  preferences_skipped_by: string | null;
  is_public: boolean;
}

export interface PlannerMembership {
  trip_id: string;
  user_id: string;
  role: MembershipRole;
  joined_at: string;
}

export interface PlannerInvite {
  id: string;
  trip_id: string;
  token: string;
  channel: InviteChannel;
  sent_to: string | null;
  accepted_by: string | null;
  created_at: string;
}

export interface PlannerPreference {
  trip_id: string;
  user_id: string;
  stay_max: number | null;
  flight_max: number | null;
  food_max: number | null;
  pace: Pace | null;
  interests: string[];
  non_negotiable: string | null;
  updated_at: string;
}

export interface PlannerDay {
  id: string;
  trip_id: string;
  date: string;
  city: string | null;
  color: string;
}

export interface PlannerItineraryItem {
  id: string;
  day_id: string;
  trip_id: string;
  text: string;
  position: number;
  created_by: string | null;
  created_at: string;
}

export interface PlannerPlace {
  id: string;
  trip_id: string;
  day_id: string | null;
  name: string;
  kind: PlaceKind;
  note: string | null;
  map_x: number;
  map_y: number;
  lat: number | null;
  lng: number | null;
  address: string | null;
  added_by: string | null;
  resource_id: string | null;
  created_at: string;
}

export interface PlannerResource {
  id: string;
  trip_id: string;
  type: ResourceType;
  label: string;
  source_url: string | null;
  added_by: string | null;
  created_at: string;
}

export interface PlannerDecision {
  id: string;
  trip_id: string;
  title: string;
  why: string | null;
  status: DecisionStatus;
  decided_option_id: string | null;
  created_by: string | null;
  created_at: string;
  closed_at: string | null;
  kind: DecisionKind;
}

export interface PlannerDecisionOption {
  id: string;
  decision_id: string;
  trip_id: string;
  label: string;
  sub: string | null;
  cost: string | null;
  fors: string[];
  against: string[];
  position: number;
  created_at: string;
  option_type: string | null;
  price_per_person_night: number | null;
  total_price: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  sharing_note: string | null;
  amenities: AmenityEntry[];
  neighborhood: string | null;
  location_note: string | null;
  lat: number | null;
  lng: number | null;
  source_url: string | null;
}

export interface PlannerDecisionVote {
  decision_id: string;
  option_id: string;
  user_id: string;
  created_at: string;
}

export interface PlannerDecisionNote {
  id: string;
  decision_id: string;
  trip_id: string;
  text: string;
  created_by: string | null;
  created_at: string;
}

export interface PlannerAvailabilityMark {
  trip_id: string;
  user_id: string;
  date: string;
  created_at: string;
}

export interface PlannerItemRating {
  id: string;
  trip_id: string;
  item_id: string;
  user_id: string;
  stars: number;
  note: string | null;
  created_at: string;
}

export interface PlannerTripReview {
  trip_id: string;
  user_id: string;
  stay_rating: number | null;
  pace_feedback: PaceFeedback | null;
  created_at: string;
}
