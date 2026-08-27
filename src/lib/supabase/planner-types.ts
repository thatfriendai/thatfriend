export type TripPrivacy = "private" | "open";
export type MembershipRole = "owner" | "member";
export type InviteChannel = "email" | "sms" | "link";
export type Pace = "Slow" | "Balanced" | "Packed";
export type PlaceKind = "Restaurants" | "Bars" | "Museums" | "Activities" | "Other";
export type ResourceType = "link" | "text" | "screenshot";

export interface PlannerUser {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  whatsapp_opt_in: boolean;
  auth_user_id: string | null;
  created_at: string;
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
