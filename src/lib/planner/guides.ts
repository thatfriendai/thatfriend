import type { PlaceKind } from "@/lib/supabase/planner-types";

export type GuideType = "Trending cities" | "Set-jetting" | "Local insider" | "Best of That Friend" | "Seasonal" | "Reported sightings";
export type GuidePlaceKind = "Restaurant" | "Bar" | "Museum" | "Activity" | "Beach" | "Stay" | "Bakery";

export interface GuidePlace {
  name: string;
  kind: GuidePlaceKind;
  where: string;
  note: string;
  keep?: boolean;
}

export interface Guide {
  id: string;
  type: GuideType;
  city: string;
  title: string;
  blurb: string;
  byline?: string;
  creditLabel: string;
  credit: string;
  creditNote: string;
  sourceLabel?: string;
  sourceHref?: string;
  why1: string;
  why2: string;
  cloneNote: string;
  facts: { label: string; value: string }[];
  places: GuidePlace[];
}

export const GUIDE_TYPES: GuideType[] = [
  "Trending cities",
  "Set-jetting",
  "Local insider",
  "Best of That Friend",
  "Seasonal",
  "Reported sightings",
];

// Types that are editorial (written by That Friend or an outside contributor)
// rather than aggregated from real trip data — see "Best of That Friend"
// below, the one type built from actual organizer trips.
export const EDITORIAL: GuideType[] = ["Trending cities", "Set-jetting", "Seasonal", "Reported sightings", "Local insider"];

export const TYPE_COLORS: Record<GuideType, string> = {
  "Trending cities": "#8A5A7A",
  "Set-jetting": "#8A5A7A",
  "Local insider": "#6E5A7A",
  "Best of That Friend": "#5E5A6E",
  Seasonal: "#985B88", // darkened from #A9709A, same as DAY_COLORS/COVER_TINTS — was below AA as text/button-bg
  "Reported sightings": "#7A5A6E",
};

export const TYPE_WASH: Record<GuideType, string> = {
  "Trending cities": "#F4F1F5",
  "Set-jetting": "#F6F1F4",
  "Local insider": "#F2F0F5",
  "Best of That Friend": "#F1F1F4",
  Seasonal: "#F8F1F6",
  "Reported sightings": "#F5F1F3",
};

// The city palette (ink/wash/line) for Home's "Trending right now" cards —
// distinct from TYPE_COLORS, which is one color per guide category. Each
// entry's `guide` id must match a TRENDING guide below.
export interface TrendingCity {
  guide: string;
  name: string;
  country: string;
  rank: string;
  why: string;
  itinerary: string;
  ink: string;
  wash: string;
  line: string;
}

export const TRENDING_CITIES: TrendingCity[] = [
  {
    guide: "tc1",
    name: "Seoul",
    country: "South Korea",
    rank: "No. 1",
    why: "Planning is up sharply for spring. Cheap flights and a long shoulder season.",
    itinerary: "4-day itinerary · 8 places",
    ink: "#6B5560",
    wash: "#F2F0F5",
    line: "#E2DEE7",
  },
  {
    guide: "tc2",
    name: "Mexico City",
    country: "Mexico",
    rank: "No. 2",
    why: "The most copied itinerary on That Friend three months running.",
    itinerary: "3-day itinerary · 8 places",
    ink: "#6B5560",
    wash: "#F2F0F5",
    line: "#E2DEE7",
  },
  {
    guide: "tc3",
    name: "Naples",
    country: "Italy",
    rank: "No. 3",
    why: "Rising fast as the Amalfi alternative, and open all winter.",
    itinerary: "3-day itinerary · 7 places",
    ink: "#5E5A68",
    wash: "#F2F0F5",
    line: "#E2DEE7",
  },
];

// A guide place's kind uses its own small vocabulary (it predates and is
// richer than the real itinerary board's PlaceKind); this is how a cloned
// place's kind maps onto the real planner_places check constraint. Bakery
// matches the same choice already made for Google Places results in
// itinerary.ts's GOOGLE_TYPE_TO_KIND.
export const GUIDE_KIND_TO_PLACE_KIND: Record<GuidePlaceKind, PlaceKind> = {
  Restaurant: "Restaurants",
  Bar: "Bars",
  Museum: "Museums",
  Activity: "Activities",
  Beach: "Activities",
  Stay: "Other",
  Bakery: "Coffee shops",
};

const TRENDING: Guide[] = [
  {
    id: "tc1",
    type: "Trending cities",
    city: "Seoul, South Korea",
    title: "Seoul in four days, the itinerary we built",
    blurb:
      "The most-planned city on That Friend this month. Four days that hold up in any season, built to be walked one neighbourhood at a time.",
    creditLabel: "Editorial",
    credit: "Built by That Friend",
    creditNote:
      "Assembled by our editors and pressure-tested against organizer feedback. Nothing here is a paid placement.",
    why1: "Seoul rewards staying in one district per day. The city is large, the subway is fast, and the common mistake is crossing it four times a day for a restaurant.",
    why2: "So the days are geographic: Jongno, then Seochon and the palaces, then Euljiro at night, then a market morning before you leave.",
    cloneNote: "Eight anchors in a new workspace, already grouped by day.",
    facts: [
      { label: "Best time", value: "Late March to May, or October" },
      { label: "Getting around", value: "Subway and a T-money card" },
      { label: "Sensible base", value: "Jongno or Mapo" },
      { label: "Length", value: "Four days, three nights" },
    ],
    places: [
      { name: "Gyeongbokgung", kind: "Activity", where: "Jongno · mornings", note: "Go at opening, before the tour groups. The changing of the guard is at ten." },
      { name: "Tosokchon", kind: "Restaurant", where: "Seochon · walk-in", note: "Ginseng chicken soup in a warren of old rooms. Lunch, and expect a short queue." },
      { name: "Bukchon Hanok Village", kind: "Activity", where: "Jongno · quiet hours", note: "People live here. Go early, keep your voice down, skip the rental hanbok photo crush." },
      { name: "Euljiro alleys", kind: "Bar", where: "Euljiro · evenings", note: "Beer and grilled things at plastic tables between print shops. The best night in the city." },
      { name: "Gwangjang Market", kind: "Activity", where: "Jongno · before noon", note: "Mung bean pancakes at the stalls in the middle. Cash, and go hungry." },
      { name: "Leeum Museum", kind: "Museum", where: "Itaewon", note: "Two buildings, one ticket, and the only museum worth crossing the river for." },
      { name: "Mangwon neighbourhood", kind: "Activity", where: "Mapo · afternoon", note: "Where the day off goes. Market street, coffee, and the river path at the end of it." },
      { name: "Cheongsu-dang", kind: "Bakery", where: "Seongsu · afternoon", note: "The cafe that started the Seongsu wave. Worth it once, on a weekday." },
    ],
  },
  {
    id: "tc2",
    type: "Trending cities",
    city: "Mexico City, Mexico",
    title: "Mexico City in three days, the itinerary we built",
    blurb:
      "The most copied itinerary on That Friend three months running. Three days across Roma, Centro and Coyoacán, with the drive times that actually work.",
    creditLabel: "Editorial",
    credit: "Built by That Friend",
    creditNote: "Assembled by our editors from the routes organizer trips kept converging on. No paid placements.",
    why1: "The city is bigger than it looks on a map and traffic decides your day. Groups that try Centro and Coyoacán on the same afternoon spend two hours in a car.",
    why2: "One district a day, museums in the morning, dinner within walking distance of where you sleep.",
    cloneNote: "Eight places in a new workspace, in the order the days run.",
    facts: [
      { label: "Best time", value: "March to May, or October" },
      { label: "Getting around", value: "Walk your district, car between them" },
      { label: "Sensible base", value: "Roma Norte or Juárez" },
      { label: "Length", value: "Three days, two nights" },
    ],
    places: [
      { name: "Museo Nacional de Antropología", kind: "Museum", where: "Chapultepec · mornings", note: "Three hours minimum. Closed Mondays, which trips keep forgetting." },
      { name: "Panadería Rosetta", kind: "Bakery", where: "Roma Norte", note: "The guava roll, standing up, before anything else." },
      { name: "Mercado de Medellín", kind: "Activity", where: "Roma Sur", note: "Lunch at the counters rather than the restaurants around it." },
      { name: "Centro Histórico walk", kind: "Activity", where: "Centro · morning", note: "Zócalo, Templo Mayor, then the Bellas Artes interior. Half a day, on foot." },
      { name: "Contramar", kind: "Restaurant", where: "Roma Norte · book ahead", note: "Lunch only, tuna tostadas, and a three-week booking window." },
      { name: "Coyoacán", kind: "Activity", where: "South · half day", note: "Frida Kahlo house needs a timed ticket. The market and the plazas are the better part." },
      { name: "Licorería Limantour", kind: "Bar", where: "Roma Norte", note: "The first-night drink. Walk-in before nine, otherwise queue." },
      { name: "Xochimilco", kind: "Activity", where: "Far south · full day", note: "Only if you have a fourth day, and only with a group. Book the boat, bring the food." },
    ],
  },
  {
    id: "tc3",
    type: "Trending cities",
    city: "Naples, Italy",
    title: "Naples in three days, the itinerary we built",
    blurb:
      "Rising fast as the Amalfi alternative, and open all winter. Three days of the city itself, with the one day trip that is worth the train.",
    creditLabel: "Editorial",
    credit: "Built by That Friend",
    creditNote: "Assembled by our editors. Nothing on this list is a paid placement.",
    why1: "Most trips treat Naples as an airport on the way to the coast. Three days in the city costs a third of Positano and is better in February.",
    why2: "The centre is walkable and chaotic, so the days are short and the day trip is the only thing on its day.",
    cloneNote: "Seven places in a new workspace, with the train day separated out.",
    facts: [
      { label: "Best time", value: "October to April" },
      { label: "Getting around", value: "On foot, plus the Circumvesuviana" },
      { label: "Sensible base", value: "Chiaia or the centro storico" },
      { label: "Length", value: "Three days, two nights" },
    ],
    places: [
      { name: "Museo Archeologico Nazionale", kind: "Museum", where: "Centro · mornings", note: "Everything excavated from Pompeii is here, not there. Go before the site, not after." },
      { name: "Pizzeria Da Attilio", kind: "Restaurant", where: "Pignasecca · walk-in", note: "Lunch, cash, and a wait. Better than the famous one with the queue around the block." },
      { name: "Napoli Sotterranea", kind: "Activity", where: "Centro · book ahead", note: "Greek cisterns under the old city. Tours run hourly and the last one fills." },
      { name: "Spanish Quarter", kind: "Activity", where: "Centro · afternoon", note: "Walk it uphill in the late afternoon when the laundry and the light line up." },
      { name: "Pompeii", kind: "Activity", where: "Circumvesuviana · full day", note: "Its own day. First train, water, and the Villa dei Misteri before you leave." },
      { name: "Sfogliatella at Attanasio", kind: "Bakery", where: "Near Garibaldi station", note: "Fifty metres from the station, hot from the oven, eaten standing." },
      { name: "Lungomare Caracciolo", kind: "Activity", where: "Chiaia · sunset", note: "The evening walk along the water, with Vesuvius on your left the whole way." },
    ],
  },
];

export const GUIDES: Guide[] = [
  ...TRENDING,
  {
    id: "g1",
    type: "Set-jetting",
    city: "Sardinia, Italy",
    title: "Sardinia, on screen: the coast productions keep renting",
    blurb:
      "Four summers of film and television crews have run through the same forty kilometres of the Costa Smeralda. This is where they shot, and what is actually open to you when you get there.",
    creditLabel: "Sources",
    credit: "Curated by That Friend, from published location reporting",
    creditNote:
      "Locations are cited from press coverage of each production. Nobody here endorses anything, and no production is affiliated with That Friend.",
    sourceLabel: "Condé Nast Traveller location report →",
    sourceHref: "#",
    why1: "Set-jetting works badly when you copy the screen and not the place. A cliffside villa that read as a hotel was a private rental; a restaurant terrace was three days of set dressing on a public beach.",
    why2: "So this guide splits the difference. Every entry says what was filmed there and whether you can get in — the ones you can book are listed first, and the ones you can only look at from the water are marked as such.",
    cloneNote: "All eleven places land in a new workspace, still unscheduled. Set dates and the car days sort themselves out.",
    facts: [
      { label: "Best time", value: "Late May to mid-June, or September" },
      { label: "Getting around", value: "Rental car, non-negotiable" },
      { label: "Sensible base", value: "Olbia or Cannigione" },
      { label: "Cost note", value: "Prices roughly double in August" },
    ],
    places: [
      { name: "Cala di Volpe bay", kind: "Beach", where: "Porto Cervo · boat access", note: "The cove behind most of the exterior water shots. Reachable by boat taxi from Porto Cervo; the shoreline itself is public." },
      { name: "Su Gologone", kind: "Stay", where: "Oliena · 1h50 inland", note: "Stood in for the interior scenes. A working hotel you can actually book, and the only inland stop worth the drive time." },
      { name: "Ristorante Il Pescatore", kind: "Restaurant", where: "Porto Cervo, old harbour", note: "Used for the dinner sequence. Books out three weeks ahead in July; walk-in at 7pm in June." },
      { name: "Spiaggia del Principe", kind: "Beach", where: "Romazzino · 25 min drive", note: "The wide establishing shot. Park before 9am or you park a kilometre out." },
      { name: "Nuraghe Albucciu", kind: "Activity", where: "Arzachena · 15 min drive", note: "Bronze Age site that shows up in two productions as set dressing. Twenty minutes is enough." },
      { name: "Phi Beach", kind: "Bar", where: "Baja Sardinia · sunset", note: "Sunset bar in the rocks. Genuinely worth it once, and the reason so many crews stayed nearby." },
      { name: "Hotel Romazzino", kind: "Stay", where: "Romazzino · bookable", note: "Interior corridors and the pool deck appear in two productions. Bookable, expensive, and the bar is open to non-guests." },
      { name: "Capriccioli headland", kind: "Beach", where: "Costa Smeralda · look only", note: "The villa on the point is private and stays private. Best seen from the water on the Cala di Volpe boat run." },
      { name: "Porto Cervo old town steps", kind: "Activity", where: "Porto Cervo centre", note: "The staircase in every walking shot. Five minutes, free, and quiet before ten in the morning." },
      { name: "Ristorante Gianni Pedrinelli", kind: "Restaurant", where: "Porto Cervo · book ahead", note: "Where the crews ate rather than filmed. Takes big tables and the bill is survivable." },
      { name: "Golfo Aranci ferry pier", kind: "Activity", where: "Golfo Aranci · 40 min", note: "The arrival sequence. Worth timing your own arrival here if you are coming by ferry from Livorno." },
    ],
  },
  {
    id: "g2",
    type: "Local insider",
    city: "Istanbul, Türkiye",
    title: "Where a sommelier drinks when she is off the clock in Istanbul",
    byline: "Deniz Aydın",
    blurb: "Deniz buys wine for a Beyoğlu restaurant group and eats out most nights. None of these are hers, none paid to be here, and most are a meze-and-rakı bill under 700 lira.",
    creditLabel: "Written by",
    credit: "Deniz Aydın · Sommelier, Beyoğlu",
    creditNote: "Written for That Friend and reviewed before publishing. Deniz has no financial relationship with any place on this list.",
    why1: "Istanbul lists collapse into the same six restaurants in Karaköy because those are the ones that answer emails. Deniz eats on the other side of that: neighbourhood meyhanes, a fish market lunch counter, one kebab place she has been going to for eleven years.",
    why2: "The order is geographic, not ranked. It runs from Karaköy up through Beyoğlu, then crosses to Kadıköy, so you can walk most of it and take one ferry.",
    cloneNote: "Eight places in a new workspace, in walking order with the ferry crossing between them.",
    facts: [
      { label: "Price band", value: "Mostly 400 to 900 lira a head" },
      { label: "Booking", value: "Three need a reservation, five do not" },
      { label: "Best nights", value: "Thursday, when meyhanes have music" },
      { label: "Route", value: "Two neighbourhoods, one ferry" },
    ],
    places: [
      { name: "Karaköy Lokantası", kind: "Restaurant", where: "Karaköy · book ahead", note: "The one tourist-known place she keeps. Lunch, not dinner, and the cold meze counter over the menu." },
      { name: "Kahve 6", kind: "Bakery", where: "Cihangir", note: "Her morning. Sit in the back garden and nobody will hurry you for two hours." },
      { name: "Asmalı Cavit", kind: "Restaurant", where: "Asmalımescit", note: "A proper meyhane. Order the seasonal meze, drink rakı, expect to stay four hours." },
      { name: "Solera Winery", kind: "Bar", where: "Beyoğlu", note: "Where she goes to taste Anatolian bottles she has not sold. Ask for something from Bozcaada." },
      { name: "Çiya Sofrası", kind: "Restaurant", where: "Kadıköy · walk-in", note: "Southeastern regional cooking, counter service, no wine. Worth the ferry on its own." },
      { name: "Kadıköy fish market", kind: "Activity", where: "Kadıköy · mornings", note: "She shops here and eats standing up at one of the counters inside. Go before noon." },
      { name: "Fazıl Bey", kind: "Bakery", where: "Kadıköy", note: "Turkish coffee, one table, ten minutes. The ritual between the market and the ferry back." },
      { name: "Bej", kind: "Bar", where: "Yeldegırmeni", note: "Small natural wine bar in the neighbourhood she actually lives in. Last stop before the last ferry." },
    ],
  },
  {
    id: "g3",
    type: "Best of That Friend",
    city: "New York, USA",
    title: "The NYC weekend 38 organizers kept rebuilding",
    blurb: "We looked at every New York trip planned on That Friend last year with four or more people. Thirty-eight of them converged on a near-identical three days. This is the consensus route.",
    creditLabel: "Built from real trips",
    credit: "From 38 organizer trips, 412 saved places",
    creditNote: "Aggregated from public trips. Organizers opted in to be counted; no names or itineraries are shown without permission.",
    why1: "Group trips fail on logistics, not taste. When thirty-eight separate groups independently land on the same Saturday, that is a route that survives six people with different budgets and one person who is late.",
    why2: "Nothing here was chosen editorially. Every place on the list appeared in at least eleven of the thirty-eight trips, and the order reflects how those trips actually sequenced the days.",
    cloneNote: "Nine places, already in the order the trips ran them. Add dates and it slots into three days.",
    facts: [
      { label: "Sample", value: "38 trips, groups of 4 or more" },
      { label: "Threshold", value: "Appeared in 11+ trips" },
      { label: "Typical length", value: "Three days, two nights" },
      { label: "Median spend", value: "$310 a head, excluding stay" },
    ],
    places: [
      { name: "Russ & Daughters", kind: "Restaurant", where: "Lower East Side · in 29 trips", note: "The most-repeated single entry in the whole sample. Almost always Saturday morning." },
      { name: "The Met", kind: "Museum", where: "Upper East Side · in 24 trips", note: "Groups gave it three hours and split up inside. Pay-what-you-wish for NY state residents." },
      { name: "Brooklyn Bridge walk", kind: "Activity", where: "Dumbo side · in 22 trips", note: "Walked toward Manhattan, not away from it, in nearly every trip." },
      { name: "Cervo’s", kind: "Restaurant", where: "Lower East Side · in 17 trips", note: "The consensus group dinner. Small, so trips with six split into two bookings." },
      { name: "Attaboy", kind: "Bar", where: "Lower East Side · in 14 trips", note: "No menu, no reservations, one hour queue after ten." },
      { name: "Smorgasburg", kind: "Activity", where: "Williamsburg · in 11 trips", note: "Only in trips landing on a weekend, which is most of them." },
      { name: "Katz’s Delicatessen", kind: "Restaurant", where: "Lower East Side · in 19 trips", note: "Nearly always paired with the Met day, and nearly always lunch." },
      { name: "The High Line", kind: "Activity", where: "Chelsea · in 16 trips", note: "Walked north to south, ending at the market, in most trips that included it." },
      { name: "Dante", kind: "Bar", where: "Greenwich Village · in 12 trips", note: "The first-night drink. Big enough to seat a group of six without a booking before eight." },
    ],
  },
  {
    id: "g4",
    type: "Seasonal",
    city: "London, UK",
    title: "Early autumn in London, when the city is briefly at its best",
    blurb: "Late September into October: the tourists have gone, the parks turn, and every restaurant that was impossible in July has a table on Tuesday. What to do with three days of it.",
    creditLabel: "Editorial",
    credit: "Curated by That Friend",
    creditNote: "Assembled by our editors from organizer feedback on autumn London trips. Nothing on this list is a paid placement.",
    why1: "London in August is a queue. London in November is dark by four. The six weeks between are the only time the parks, the galleries and the restaurants are all pleasant at once, and almost nobody plans around them.",
    why2: "This guide is built for that window specifically. Every entry works in the cold and the wet, the walks are short enough for a four o’clock sunset, and the bookings are ones you can still get a week out.",
    cloneNote: "Seven anchors in a new workspace, with the two that need booking flagged.",
    facts: [
      { label: "Window", value: "Late September to late October" },
      { label: "Daylight", value: "Dark by 18:30, then 16:30 after the clocks" },
      { label: "Booking", value: "A week out is usually enough" },
      { label: "Pack", value: "One warm layer, one waterproof" },
    ],
    places: [
      { name: "Hampstead Heath", kind: "Activity", where: "North London · 40 min", note: "The reason to come in October. Up to Parliament Hill for the view, then down through the woods." },
      { name: "St John", kind: "Restaurant", where: "Farringdon · book ahead", note: "Cooking that finally makes sense when it is cold. Bone marrow, one bottle, early sitting." },
      { name: "Sir John Soane’s Museum", kind: "Museum", where: "Holborn · free", note: "Small, strange, and best on a grey afternoon. Free, and the candlelit evenings sell out." },
      { name: "Kew Gardens", kind: "Activity", where: "Richmond · 50 min", note: "Go for the autumn colour and the glasshouses, which are warm when the weather turns." },
      { name: "The Harwood Arms", kind: "Restaurant", where: "Fulham · book ahead", note: "Game season starts now, which is the whole point. The venison scotch egg at the bar if you cannot get a table." },
      { name: "Columbia Road flower market", kind: "Activity", where: "Bethnal Green · Sundays", note: "Sunday only, and genuinely better in autumn when it is less of a crush." },
      { name: "The French House", kind: "Bar", where: "Soho · walk-in", note: "No music, no phones upstairs. Where you end up when it starts raining." },
    ],
  },
  {
    id: "g5",
    type: "Reported sightings",
    city: "Greek Islands",
    title: "Reported sightings: the Cyclades, summer 2026",
    blurb: "Who the press placed where across Athens, Paros and Mykonos — and whether the place holds up in May, when nobody is watching.",
    creditLabel: "Reported, not endorsed",
    credit: "Compiled from published press coverage",
    creditNote: "Every sighting is attributed to the outlet that reported it. Names appear as reporting, not recommendation or endorsement, and nobody listed has any relationship with That Friend. Attributions below are placeholders pending sourcing.",
    sourceLabel: "See the full source list →",
    sourceHref: "#",
    why1: "Celebrity sightings are a reason to look somewhere up, not a reason to go. Paros fills every August with people following a photograph, and half of them end up at a bad table on the water paying four times what it is worth.",
    why2: "So each entry carries two lines: what was reported, and what the place is actually like off-season. Where the honest answer is “not worth it”, we have said so.",
    cloneNote: "Seven places, with the three we would actually keep marked.",
    facts: [
      { label: "Window", value: "June to August 2026" },
      { label: "Islands", value: "Athens, Paros, Mykonos" },
      { label: "Worth going", value: "3 of 7, off-season" },
      { label: "Peak crowd", value: "Mid-July to late August" },
    ],
    places: [
      { name: "Barbarossa", kind: "Restaurant", where: "Naoussa, Paros", keep: true, note: "An American actor was photographed on the terrace in July, per the outlet’s summer diary. Also genuinely good in May, at half the bill." },
      { name: "Hotel Grande Bretagne", kind: "Stay", where: "Syntagma, Athens", note: "The most-reported address in the city. The roof bar is open to non-guests and is the cheapest way to see the Acropolis from it." },
      { name: "Siparos", kind: "Restaurant", where: "Santa Maria, Paros", note: "Two reported sightings across August. Beautiful, expensive, and booked out by hotel concierges all summer." },
      { name: "Scorpios", kind: "Bar", where: "Paraga, Mykonos", note: "Reported repeatedly, and we would skip it. Included because you will see it mentioned everywhere else." },
      { name: "Kolona beach", kind: "Beach", where: "Kythnos · boat access", keep: true, note: "Where the charters anchor. Free public access, which the coverage never mentions." },
      { name: "Nolan", kind: "Restaurant", where: "Syntagma, Athens", keep: true, note: "One sighting, per a local paper. A small Greek-Japanese room that is worth a table on any ordinary Tuesday." },
      { name: "Soso Mykonos", kind: "Bar", where: "Mykonos town", note: "One reported sighting in August, per a paparazzi wire. Ordinary the rest of the year, and priced as though it is not." },
    ],
  },
];

export function guideById(id: string): Guide | undefined {
  return GUIDES.find((g) => g.id === id);
}
