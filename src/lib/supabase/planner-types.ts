export type TripPrivacy = "private" | "open";
export type MembershipRole = "owner" | "member";
export type InviteChannel = "email" | "sms" | "link";
export type Pace = "Slow" | "Balanced" | "Packed";
export type PlaceKind = "Restaurants" | "Coffee shops" | "Bars" | "Museums" | "Activities" | "Other";
export type ResourceType = "link" | "text" | "screenshot";
export type DecisionStatus = "open" | "closed";
export type PaceFeedback = "saw_everything" | "about_right" | "not_enough_time" | "too_packed";
export type DecisionKind = "general" | "stay";
export type StaySource = "airbnb" | "hotel" | "aparthotel" | "other";

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
  is_public: boolean;
}

export interface PlannerFollow {
  follower_id: string;
  followee_id: string;
  created_at: string;
}

export type FriendshipSource = "trip" | "manual";

/** Distinct from Follow (one-directional) — a friendship is mutual and, today, only ever created by sharing a trip. Stored with user_a < user_b so a pair has exactly one row. */
export interface PlannerFriendship {
  user_a: string;
  user_b: string;
  source: FriendshipSource;
  created_at: string;
}

export interface PlannerPlaceRating {
  id: string;
  trip_id: string;
  place_id: string;
  user_id: string;
  rating: number;
  body: string | null;
  created_at: string;
}

export type JoinRequestStatus = "pending" | "accepted" | "declined";

export interface PlannerJoinRequest {
  id: string;
  trip_id: string;
  user_id: string;
  status: JoinRequestStatus;
  created_at: string;
}

export interface AmenityEntry {
  label: string;
  available: boolean;
}

/** null = nobody's checked, true/false = a real reported value. Never coerce a missing amenity to false — that would claim knowledge nobody has. */
export interface StayAmenities {
  kitchen: boolean | null;
  ac: boolean | null;
  washer: boolean | null;
  pool: boolean | null;
  breakfast: boolean | null;
  wifi: boolean | null;
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
  rating_prompt_sent_at: string | null;
  rating_reminder_sent_at: string | null;
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
  google_place_id: string | null;
  photo_url: string | null;
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
  nights: number | null;
  party_size: number | null;
  deadline: string | null;
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
  url: string | null;
  source: StaySource | null;
  total_cost: number | null;
  currency: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  beds_note: string | null;
  amenities: StayAmenities;
  rating: number | null;
  rating_count: number | null;
  neighborhood: string | null;
  location_note: string | null;
  lat: number | null;
  lng: number | null;
  image_url: string | null;
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
