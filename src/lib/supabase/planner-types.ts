export type TripPrivacy = "private" | "open";
export type MembershipRole = "owner" | "member";
export type InviteChannel = "email" | "sms" | "link";
export type Pace = "Slow" | "Balanced" | "Packed";

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
