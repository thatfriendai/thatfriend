"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";

/** Converts a "prop: value; prop2: value2" CSS string into a React style object — lets the many dynamically-built style strings below stay close to the original design source instead of being hand-translated one by one. */
function css(str: string): CSSProperties {
  const obj: Record<string, string> = {};
  for (const decl of str.split(";")) {
    const i = decl.indexOf(":");
    if (i === -1) continue;
    const prop = decl.slice(0, i).trim();
    const value = decl.slice(i + 1).trim();
    if (!prop || !value) continue;
    obj[prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
  }
  return obj as CSSProperties;
}

const TODAY = 10; // September 2026, the 1st is a Tuesday
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const dayName = (d: number) => DAY_NAMES[d % 7];

interface Person {
  name: string;
  initials: string;
  color: string;
}

const PEOPLE: Record<string, Person> = {
  maya: { name: "Maya", initials: "MA", color: "#6E5A7A" },
  priya: { name: "Priya", initials: "PR", color: "#A9709A" },
  jonah: { name: "Jonah", initials: "JO", color: "#5E5A6E" },
  you: { name: "You", initials: "YOU", color: "#8A5A7A" },
};

const AVAIL = [
  { key: "maya", window: "19 to 27 Sept" },
  { key: "priya", window: "Any time after the 18th" },
  { key: "jonah", window: "Only the 22nd onwards" },
];

interface Stay {
  id: string;
  name: string;
  kind: "home" | "hotel";
  source: string;
  meta: string;
  perNight: number;
  shares: string;
  sharesNote: string;
  hood: string;
  lat: number;
  lng: number;
  inCity: boolean;
  amenities: string;
  amenitiesNote: string;
  votes: string[];
  mine?: boolean;
}

const STAYS: Stay[] = [
  {
    id: "casa",
    name: "Casa Alfama",
    kind: "home",
    source: "Airbnb",
    meta: "Entire home",
    perNight: 78,
    shares: "3 bedrooms, 2 baths",
    sharesNote: "Everyone in a real bed",
    hood: "Alfama",
    lat: 38.7128,
    lng: -9.13,
    inCity: true,
    amenities: "Kitchen, AC",
    amenitiesNote: "Washer, no pool",
    votes: ["priya", "maya"],
  },
  {
    id: "quinta",
    name: "Quinta near Lagos",
    kind: "home",
    source: "Airbnb",
    meta: "House with pool",
    perNight: 64,
    shares: "4 bedrooms, 2 baths",
    sharesNote: "Pool, but a car each way",
    hood: "Praia da Luz, Algarve",
    lat: 37.087,
    lng: -8.73,
    inCity: false,
    amenities: "Pool, kitchen",
    amenitiesNote: "No AC, no washer",
    votes: ["jonah"],
  },
  {
    id: "baixa",
    name: "Hotel Baixa",
    kind: "hotel",
    source: "Hotel",
    meta: "4 doubles",
    perNight: 95,
    shares: "4 private rooms",
    sharesNote: "No kitchen, breakfast in",
    hood: "Baixa",
    lat: 38.71,
    lng: -9.139,
    inCity: true,
    amenities: "AC, breakfast",
    amenitiesNote: "No kitchen, daily clean",
    votes: [],
  },
];

const EXTRA_STAY: Stay = {
  id: "loft",
  name: "Graça loft",
  kind: "home",
  source: "Booking",
  meta: "Entire home",
  perNight: 71,
  shares: "3 bedrooms, 2 baths",
  sharesNote: "Terrace, steep walk home",
  hood: "Graça",
  lat: 38.7185,
  lng: -9.129,
  inCity: true,
  amenities: "Kitchen, AC",
  amenitiesNote: "Terrace, no washer",
  votes: [],
  mine: true,
};

const CITY_BASE = { lat: 38.7128, lng: -9.13 };

interface GeoPlace {
  name: string;
  source: string;
  lat: number;
  lng: number;
  mine?: boolean;
}

const PLACES: GeoPlace[] = [
  { name: "Cervejaria Ramiro", source: "Maya", lat: 38.7268, lng: -9.1355 },
  { name: "Time Out Market", source: "Priya", lat: 38.7071, lng: -9.1459 },
  { name: "O Frade", source: "WhatsApp", lat: 38.7133, lng: -9.1218 },
];

// coordinates handed to places the visitor types, first one deliberately far out
const MY_COORDS = [
  { lat: 38.6968, lng: -9.206 },
  { lat: 38.7175, lng: -9.149 },
  { lat: 38.716, lng: -9.133 },
  { lat: 38.7015, lng: -9.177 },
];

interface Road {
  w: "major" | "minor";
  name?: string;
  pts: [number, number][];
}

// Street grid, drawn strictly north-south and east-west for a flat overhead view
const ROADS: Road[] = [
  { w: "major", name: "Av. Berna", pts: [[38.7285, -9.162], [38.7285, -9.118]] },
  { w: "major", name: "R. Alexandre Herculano", pts: [[38.7215, -9.17], [38.7215, -9.114]] },
  { w: "major", name: "R. de São Bento", pts: [[38.7148, -9.176], [38.7148, -9.112]] },
  { w: "major", name: "Av. 24 de Julho", pts: [[38.7075, -9.215], [38.7075, -9.106]] },
  { w: "minor", pts: [[38.725, -9.166], [38.725, -9.116]] },
  { w: "minor", pts: [[38.7182, -9.172], [38.7182, -9.113]] },
  { w: "minor", pts: [[38.7115, -9.178], [38.7115, -9.11]] },
  { w: "minor", pts: [[38.7042, -9.21], [38.7042, -9.108]] },
  { w: "minor", pts: [[38.7008, -9.212], [38.7008, -9.15]] },
  { w: "minor", pts: [[38.7128, -9.146], [38.7128, -9.118]] },
  { w: "minor", pts: [[38.7098, -9.145], [38.7098, -9.119]] },
  { w: "minor", pts: [[38.7162, -9.147], [38.7162, -9.117]] },
  { w: "minor", pts: [[38.7196, -9.148], [38.7196, -9.12]] },
  { w: "minor", pts: [[38.7232, -9.15], [38.7232, -9.122]] },
  { w: "minor", pts: [[38.7268, -9.154], [38.7268, -9.124]] },
  { w: "minor", pts: [[38.706, -9.152], [38.706, -9.12]] },
  { w: "major", name: "Av. da Liberdade", pts: [[38.706, -9.145], [38.73, -9.145]] },
  { w: "major", name: "Av. Almirante Reis", pts: [[38.707, -9.133], [38.732, -9.133]] },
  { w: "major", name: "R. da Escola Politécnica", pts: [[38.705, -9.156], [38.73, -9.156]] },
  { w: "major", name: "Av. de Ceuta", pts: [[38.703, -9.17], [38.726, -9.17]] },
  { w: "major", name: "R. da Graça", pts: [[38.709, -9.124], [38.728, -9.124]] },
  { w: "minor", pts: [[38.7075, -9.14], [38.729, -9.14]] },
  { w: "minor", pts: [[38.7078, -9.1372], [38.725, -9.1372]] },
  { w: "minor", pts: [[38.708, -9.13], [38.727, -9.13]] },
  { w: "minor", pts: [[38.7085, -9.1272], [38.724, -9.1272]] },
  { w: "minor", pts: [[38.71, -9.1208], [38.725, -9.1208]] },
  { w: "minor", pts: [[38.7105, -9.118], [38.723, -9.118]] },
  { w: "minor", pts: [[38.7055, -9.149], [38.728, -9.149]] },
  { w: "minor", pts: [[38.705, -9.152], [38.727, -9.152]] },
  { w: "minor", pts: [[38.704, -9.162], [38.725, -9.162]] },
  { w: "minor", pts: [[38.7035, -9.166], [38.724, -9.166]] },
  { w: "minor", pts: [[38.7025, -9.178], [38.72, -9.178]] },
  { w: "minor", pts: [[38.7, -9.19], [38.716, -9.19]] },
  { w: "minor", pts: [[38.6985, -9.202], [38.714, -9.202]] },
  { w: "minor", pts: [[38.699, -9.196], [38.715, -9.196]] },
  { w: "minor", pts: [[38.711, -9.115], [38.722, -9.115]] },
  { w: "major", pts: [[38.732, -9.156], [38.732, -9.1]] },
  { w: "minor", pts: [[38.738, -9.162], [38.738, -9.1]] },
  { w: "minor", pts: [[38.744, -9.16], [38.744, -9.102]] },
  { w: "minor", pts: [[38.718, -9.112], [38.718, -9.08]] },
  { w: "minor", pts: [[38.725, -9.112], [38.725, -9.082]] },
  { w: "minor", pts: [[38.71, -9.112], [38.71, -9.078]] },
  { w: "minor", pts: [[38.73, -9.118], [38.73, -9.084]] },
  { w: "major", pts: [[38.7095, -9.11], [38.738, -9.11]] },
  { w: "minor", pts: [[38.71, -9.102], [38.74, -9.102]] },
  { w: "minor", pts: [[38.712, -9.094], [38.736, -9.094]] },
  { w: "minor", pts: [[38.714, -9.086], [38.733, -9.086]] },
  { w: "minor", pts: [[38.709, -9.116], [38.742, -9.116]] },
  { w: "minor", pts: [[38.73, -9.148], [38.748, -9.148]] },
  { w: "minor", pts: [[38.73, -9.138], [38.746, -9.138]] },
  { w: "minor", pts: [[38.73, -9.128], [38.744, -9.128]] },
  { w: "minor", pts: [[38.713, -9.26], [38.713, -9.2]] },
  { w: "minor", pts: [[38.718, -9.256], [38.718, -9.198]] },
  { w: "minor", pts: [[38.7232, -9.252], [38.7232, -9.196]] },
  { w: "major", pts: [[38.7285, -9.248], [38.7285, -9.16]] },
  { w: "minor", pts: [[38.734, -9.244], [38.734, -9.156]] },
  { w: "minor", pts: [[38.7395, -9.24], [38.7395, -9.162]] },
  { w: "major", pts: [[38.7075, -9.26], [38.7075, -9.214]] },
  { w: "minor", pts: [[38.703, -9.256], [38.703, -9.208]] },
  { w: "major", pts: [[38.7, -9.224], [38.742, -9.224]] },
  { w: "minor", pts: [[38.701, -9.236], [38.74, -9.236]] },
  { w: "minor", pts: [[38.702, -9.248], [38.738, -9.248]] },
  { w: "minor", pts: [[38.699, -9.216], [38.744, -9.216]] },
  { w: "minor", pts: [[38.698, -9.208], [38.746, -9.208]] },
  { w: "minor", pts: [[38.702, -9.258], [38.736, -9.258]] },
];

const rect = (name: string, lat0: number, lat1: number, lng0: number, lng1: number) => ({
  name,
  pts: [[lat1, lng0], [lat1, lng1], [lat0, lng1], [lat0, lng0]] as [number, number][],
});

const PARKS = [
  rect("Eduardo VII", 38.7252, 38.7322, -9.156, -9.1492),
  rect("Monsanto", 38.713, 38.7295, -9.205, -9.1815),
  rect("Estrela", 38.7124, 38.716, -9.1622, -9.1578),
  rect("Belém", 38.6952, 38.6996, -9.2082, -9.1988),
  rect("Campo Grande", 38.756, 38.766, -9.156, -9.148),
];

const HOODS = [
  { name: "Alfama", lat: 38.7139, lng: -9.1268 },
  { name: "Baixa", lat: 38.71, lng: -9.139 },
  { name: "Belém", lat: 38.6975, lng: -9.2035 },
  { name: "Príncipe Real", lat: 38.718, lng: -9.15 },
];

const kmBetween = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const dy = (a.lat - b.lat) * 111;
  const dx = (a.lng - b.lng) * 111 * Math.cos((a.lat * Math.PI) / 180);
  return Math.sqrt(dx * dx + dy * dy);
};

const travelLabel = (km: number) =>
  km < 1.7 ? `${Math.max(4, Math.round(km * 13))} min walk` : `${Math.max(6, Math.round(km * 3.4))} min metro`;

const avatarStyle = (p: Person, size: number) =>
  `width:${size}px;height:${size}px;border-radius:999px;flex:none;display:flex;align-items:center;justify-content:center;font-size:${
    size > 24 ? 11.5 : 9.5
  }px;color:#FFFDF9;background:${p.color};`;

export function HeroDemo({ autoplaySpeed = 1 }: { autoplaySpeed?: number }) {
  const [step, setStep] = useState(1);
  const [start, setStart] = useState<number | null>(null);
  const [end, setEnd] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [vote, setVote] = useState<string | null>(null);
  const [tiebreak, setTiebreak] = useState<"price" | "walk" | null>(null);
  const [extraStay, setExtraStay] = useState(false);
  const [thing, setThing] = useState("");
  const [places, setPlaces] = useState<string[]>([]);
  const [confetti, setConfetti] = useState(false);
  const [activePin, setActivePin] = useState<number | null>(null);

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = (fn: () => void, ms: number) => {
    timersRef.current.push(setTimeout(fn, ms));
  };

  useEffect(() => {
    const up = () => setDragging((d) => (d ? false : d));
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mouseup", up);
      timersRef.current.forEach(clearTimeout);
    };
  }, []);

  function down(d: number) {
    if (start !== null && end === start && d > start) {
      setEnd(d);
      setHover(d);
      setDragging(false);
    } else {
      setStart(d);
      setEnd(d);
      setHover(d);
      setDragging(true);
    }
  }
  function over(d: number) {
    if (dragging && start !== null && d >= start) {
      setEnd(d);
      setHover(d);
    }
  }

  // the range everyone can actually make
  function resolved() {
    let a = start === null ? 19 : start;
    let b = end === null ? 27 : end;
    a = Math.max(a, 22, TODAY);
    b = Math.min(b, 27);
    if (b - a < 2) {
      a = 22;
      b = 27;
    }
    return { start: a, end: b, nights: b - a };
  }

  function runAll(e: React.MouseEvent) {
    e.preventDefault();
    const k = 1 / (autoplaySpeed ?? 1);
    setStart(19);
    setEnd(27);
    setStep(2);
    setConfetti(true);
    later(() => setConfetti(false), 1600 * k);
    later(() => setVote("casa"), 900 * k);
    later(() => setStep(3), 1900 * k);
    later(() => setPlaces(["Descobre, Belém"]), 2500 * k);
    later(() => setStep(4), 3300 * k);
  }

  function reset(e: React.MouseEvent) {
    e.preventDefault();
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setStep(1);
    setStart(null);
    setEnd(null);
    setHover(null);
    setVote(null);
    setTiebreak(null);
    setExtraStay(false);
    setThing("");
    setPlaces([]);
    setConfetti(false);
  }

  const r = resolved();
  const selEnd = end === null ? hover : end;

  const days = [];
  for (let i = 0; i < 35; i++) {
    const d = i < 1 || i > 30 ? null : i;
    if (d === null) {
      days.push({ key: i, label: "", disabled: true, style: css("height:29px;border:none;background:transparent") });
      continue;
    }
    const past = d < TODAY;
    const isEnd = d === start || d === selEnd;
    const inRange = start !== null && selEnd !== null && d > Math.min(start, selEnd) && d < Math.max(start, selEnd);
    let style = "height:29px;border:none;border-radius:7px;font-size:12.5px;padding:0;";
    if (past) style += "background:transparent;color:#C4BCAE;cursor:default;";
    else if (isEnd) style += "background:#8A5A7A;color:#FFFDF9;cursor:pointer;";
    else if (inRange) style += "background:#F3EAF0;color:#2B2825;cursor:pointer;";
    else style += "background:transparent;color:#4A453E;cursor:pointer;";
    days.push({ key: i, label: String(d), disabled: past, d, style: css(style) });
  }

  // What's actually saved so far — the stay comparison ranks options by
  // real distance to these, not a static "best" tag, so it stays honest as
  // places get added in step 3.
  const savedPlaces: GeoPlace[] = PLACES.concat(
    places.map((n, i) => {
      const c = MY_COORDS[i % MY_COORDS.length];
      return { name: n, source: "You", lat: c.lat, lng: c.lng, mine: true };
    })
  );
  const WALKABLE_KM = 1.3; // about 15 minutes on foot
  function reachFrom(st: Stay): { label: string; note: string; prose: string; rank: number } {
    if (!st.inCity) {
      const km = Math.round(Math.min(...savedPlaces.map((p) => kmBetween(st, p))));
      return { label: `${km} km away`, note: "car or train to the city", prose: "", rank: 999 };
    }
    const near = savedPlaces.filter((p) => kmBetween(st, p) <= WALKABLE_KM);
    const mins = (km: number) => Math.max(4, Math.round(km * 13));
    const longest = near.length ? mins(Math.max(...near.map((p) => kmBetween(st, p)))) : null;
    return {
      label: `${near.length} of ${savedPlaces.length} on foot`,
      note: longest ? `longest is ${longest} min` : "metro to all of them",
      prose:
        near.length === savedPlaces.length
          ? `all ${savedPlaces.length} of your places within a ${longest} minute walk`
          : near.length
            ? `${near.length} of your ${savedPlaces.length} places within a ${longest} minute walk`
            : "nothing you saved within walking distance",
      // rank on the walk you would actually resent, not the count
      rank: near.length ? longest! + (savedPlaces.length - near.length) * 30 : 999,
    };
  }

  const options = (extraStay ? STAYS.concat(EXTRA_STAY) : STAYS.slice()).map((o) => ({ ...o, reach: reachFrom(o) }));
  const bestReach = Math.min(...options.map((o) => o.reach.rank));
  const tally = (o: Stay) => o.votes.length + (vote === o.id ? 1 : 0);
  const cheapest = Math.min(...options.map((o) => o.perNight));

  const cellBase = "box-sizing:border-box;flex:1 1 0;min-width:124px;border-bottom:1px solid #EDE8DD;padding:12px 14px;";
  const edge = (i: number) => (i < options.length - 1 || !extraStay ? "border-right:1px solid #EDE8DD;" : "");
  const KIND_TINT = ["#8A5A7A", "#6E5A7A", "#5E5A6E", "#A9709A"];
  const stayCols = options.map((o, i) => {
    const mine = vote === o.id;
    const votes = vote === o.id ? o.votes.concat("you") : o.votes;
    const tint = KIND_TINT[i % KIND_TINT.length];
    return {
      o,
      name: o.name,
      meta: o.meta,
      source: o.source,
      isHome: o.kind === "home",
      isHotel: o.kind === "hotel",
      headStyle: css(cellBase + edge(i) + "border-top:2.5px solid " + tint + ";" + (mine ? "background:#FBF6EC;" : "")),
      thumbStyle: css(
        "height:40px;border-radius:7px;margin-bottom:9px;display:flex;align-items:center;gap:7px;padding:0 9px;background:" +
          (mine ? "#FDF8F1" : "#FCFAF5") +
          ";border:1px solid " +
          (mine ? "#E8DFD0" : "#EDE8DD") +
          ";"
      ),
      sourceStyle: css(`font-family:'DM Mono',monospace;font-size:9.5px;letter-spacing:0.07em;text-transform:uppercase;color:${tint};`),
      voters: votes.map((k) => ({
        initials: PEOPLE[k].initials,
        style: css(avatarStyle(PEOPLE[k], 22) + "margin-right:-6px;border:1.5px solid #FFFDF9;"),
      })),
      voteCellStyle: css("box-sizing:border-box;flex:1 1 0;min-width:124px;padding:12px 14px;" + edge(i) + (mine ? "background:#FBF6EC;" : "")),
      voteBtn: mine ? "Your vote" : "Vote",
      voteBtnStyle: css(
        "width:100%;border-radius:999px;padding:7px;font-size:12.5px;cursor:pointer;transition:border-color 140ms ease;" +
          (mine ? "border:none;background:#8A5A7A;color:#FFFDF9;" : "border:1px solid #E4DED2;background:transparent;color:#4A453E;")
      ),
      onVote: () => {
        setVote(o.id);
        setTiebreak(null);
      },
    };
  });

  const labelStyle = css(
    "box-sizing:border-box;width:112px;flex:none;background:#FCFAF5;border-bottom:1px solid #EDE8DD;border-right:1px solid #EDE8DD;padding:12px;font-family:'DM Mono',monospace;font-size:9.5px;letter-spacing:0.08em;text-transform:uppercase;color:#8C8478;line-height:1.5;"
  );
  const cellsFor = (main: (o: (typeof options)[number]) => string, sub: (o: (typeof options)[number]) => string, isBest: (o: (typeof options)[number]) => boolean) =>
    options.map((o, i) => ({
      key: o.id,
      main: main(o),
      sub: sub(o),
      style: css(cellBase + edge(i) + (vote === o.id ? "background:#FBF6EC;" : "")),
      mainStyle: css("font-size:13.5px;line-height:1.35;min-height:37px;color:" + (isBest(o) ? "#4C6749" : "#1B1917") + ";"),
    }));

  const matrixRows = [
    {
      key: "price",
      label: "Each, per night",
      cells: cellsFor(
        (o) => "$" + o.perNight + (o.perNight === cheapest ? " ↓" : ""),
        (o) => "$" + (o.perNight * r.nights * 4).toLocaleString("en-US") + " total",
        (o) => o.perNight === cheapest
      ),
    },
    { key: "shares", label: "Who shares", cells: cellsFor((o) => o.shares, (o) => o.sharesNote, () => false) },
    {
      key: "hood",
      label: `Near your ${savedPlaces.length} places`,
      cells: cellsFor(
        (o) => o.hood,
        (o) => o.reach.label + " " + o.reach.note,
        (o) => o.inCity && o.reach.rank === bestReach && bestReach < 999
      ),
    },
    { key: "amen", label: "Amenities", cells: cellsFor((o) => o.amenities, (o) => o.amenitiesNote, () => false) },
  ];

  const top = Math.max(...options.map(tally));
  const leaders = options.filter((o) => tally(o) === top);
  const tied = vote !== null && leaders.length > 1 && tiebreak === null;
  const broken =
    leaders.length > 1 && tiebreak !== null
      ? leaders.reduce((a, b) => (tiebreak === "price" ? (b.perNight < a.perNight ? b : a) : b.reach.rank < a.reach.rank ? b : a))
      : null;
  const winner = vote === null ? options[0] : broken || leaders[0];
  const winnerVotes = tally(winner);
  const perPerson = (winner.perNight * r.nights + 430).toLocaleString("en-US");

  // The map (and everything timed from it) centers on the winning stay only
  // when it's actually in Lisbon — the Quinta is a real ~280km away in the
  // Algarve, so a stay like that keeps the saved places timed from the city
  // instead of pretending they're next door.
  const stayAt = winner.inCity ? { lat: winner.lat, lng: winner.lng } : CITY_BASE;
  const mapOriginName = winner.inCity ? winner.name : "Lisbon nights";
  const TINTS = ["#A9709A", "#8FA37A", "#C9A86A", "#8A9BB0", "#C08E7A"];
  const allPlaces = savedPlaces.map((p, i) => {
    const km = kmBetween(stayAt, p);
    return { ...p, km, walk: travelLabel(km), tint: p.mine ? "#8A5A7A" : TINTS[i % TINTS.length] };
  });

  // fit every pin, however far out, into the same frame
  const pts: { lat: number; lng: number }[] = allPlaces.map((p) => ({ lat: p.lat, lng: p.lng })).concat([stayAt]);
  const lats = pts.map((p) => p.lat);
  const lngs = pts.map((p) => p.lng);
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const midLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
  const kx = Math.cos((midLat * Math.PI) / 180);
  const ASPECT = 836 / 268;
  let spanLat = Math.max(Math.max(...lats) - Math.min(...lats), 0.03) * 1.32;
  let spanLng = Math.max(Math.max(...lngs) - Math.min(...lngs), 0.04) * 1.2;
  if ((spanLng * kx) / spanLat < ASPECT) spanLng = (spanLat * ASPECT) / kx;
  else spanLat = (spanLng * kx) / ASPECT;
  const project = (p: { lat: number; lng: number }) => ({
    x: 50 + ((p.lng - midLng) / spanLng) * 100,
    y: 50 - ((p.lat - midLat) / spanLat) * 100,
  });
  const BANK: [{ lat: number; lng: number }, { lat: number; lng: number }] = [
    { lat: 38.6905, lng: -9.22 },
    { lat: 38.7065, lng: -9.09 },
  ];
  const bankLat = (lng: number) => BANK[0].lat + ((lng - BANK[0].lng) * (BANK[1].lat - BANK[0].lat)) / (BANK[1].lng - BANK[0].lng);
  const leftLng = midLng - spanLng / 2;
  const rightLng = midLng + spanLng / 2;
  const bankMeanY = (project({ lat: bankLat(leftLng), lng: leftLng }).y + project({ lat: bankLat(rightLng), lng: rightLng }).y) / 2;
  const lowestPinY = Math.max(...pts.map((p) => project(p).y));
  const bankMidY = Math.min(Math.max(bankMeanY, lowestPinY + 4.5), 92);
  const tejoAt = bankMidY < 97 ? { x: 78, y: Math.max(3, Math.min(bankMidY, 93)) } : null;

  const spanKm = spanLng * 111 * Math.cos((midLat * Math.PI) / 180);
  const scaleKm = spanKm > 9 ? 2 : spanKm > 4 ? 1 : 0.5;
  const scaleWidth = Math.round((scaleKm / spanKm) * 100);
  const heroThing = places[0] || "Cervejaria Ramiro";

  const rowBase = "display:flex;gap:12px;padding:12px 20px;border-bottom:1px solid #EDE8DD;align-items:baseline;";
  const transfer = Math.max(r.start + 2, r.start + r.nights - 2);
  const cityStay = winner.inCity ? winner.name : "the Lisbon base";
  const nearestWalk = Math.max(4, Math.round(Math.min(...allPlaces.map((p) => p.km)) * 13));
  const itinerary = [
    { key: 0, day: dayName(r.start), title: "Land in Lisbon, drop bags at " + cityStay, note: "Everyone is in by 6pm", style: css(rowBase), skip: false },
    {
      key: 1,
      day: dayName(r.start + 1),
      title: heroThing,
      note: (places.length ? "Added by you" : "From Maya") + ". Slotted into the first free evening",
      style: css(rowBase + "background:#FBF6EC;"),
      skip: false,
    },
    {
      key: 2,
      day: dayName(r.start + 2),
      title: "O Frade, then whatever is open",
      note: nearestWalk + " minutes from the door, so nobody books a taxi",
      style: css(rowBase),
      skip: r.start + 2 >= transfer,
    },
    {
      key: 3,
      day: dayName(transfer),
      title: winner.inCity ? "Train to Lagos, two nights on the coast" : "Train to Lagos, check in at " + winner.name,
      note: winner.inCity ? "Jonah gets his surf lesson" : "The pool everyone voted for, and Jonah gets his surf lesson",
      style: css(rowBase),
      skip: false,
    },
  ].filter((i) => !i.skip);

  // one shared label layer: first claim wins, later labels that collide are dropped
  const claimed: { x0: number; x1: number; y0: number; y1: number }[] = [];
  const FW = 818;
  const FH = 268;
  const claim = (cx: number, cy: number, chars: number, rotated: boolean) => {
    const lenPx = chars * 5.7 + 10;
    const thickPx = 14;
    const w = ((rotated ? thickPx : lenPx) / FW) * 100;
    const h = ((rotated ? lenPx : thickPx) / FH) * 100;
    const box = { x0: cx - w / 2, x1: cx + w / 2, y0: cy - h / 2, y1: cy + h / 2 };
    if (claimed.some((c) => box.x0 < c.x1 && box.x1 > c.x0 && box.y0 < c.y1 && box.y1 > c.y0)) return false;
    claimed.push(box);
    return true;
  };

  const parkLabelList = PARKS.map((k) => {
    const xy = k.pts.map((p) => project({ lat: p[0], lng: p[1] }));
    const cx = xy.reduce((s, p) => s + p.x, 0) / xy.length;
    const cy = xy.reduce((s, p) => s + p.y, 0) / xy.length;
    const w = Math.max(...xy.map((p) => p.x)) - Math.min(...xy.map((p) => p.x));
    const show = cx > 6 && cx < 94 && cy > 5 && cy < 95 && w > 7 && claim(cx, cy, k.name.length, false);
    return {
      show,
      name: k.name,
      key: k.name,
      style: css(
        "position:absolute;left:" +
          cx.toFixed(1) +
          "%;top:" +
          cy.toFixed(1) +
          "%;transform:translate(-50%,-50%);font-family:'DM Mono',monospace;font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:#566B45;white-space:nowrap;pointer-events:none;"
      ),
    };
  }).filter((k) => k.show);

  const hoodList = HOODS.map((h) => {
    const xy = project(h);
    const cy = xy.y - (20.8 / FH) * 100;
    const onScreen = xy.x > 3 && xy.x < 88 && xy.y > 4 && xy.y < 94 && claim(xy.x, cy, h.name.length, false);
    return {
      name: h.name,
      key: h.name,
      style: css(
        onScreen
          ? "position:absolute;left:" +
              xy.x.toFixed(1) +
              "%;top:" +
              xy.y.toFixed(1) +
              "%;transform:translate(-50%,-160%);font-family:'DM Mono',monospace;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#6E6449;pointer-events:none;white-space:nowrap;"
          : "display:none;"
      ),
    };
  });

  const roadLabelList = ROADS.filter((rd) => rd.w === "major" && rd.name)
    .map((rd) => {
      const a = project({ lat: rd.pts[0][0], lng: rd.pts[0][1] });
      const b = project({ lat: rd.pts[1][0], lng: rd.pts[1][1] });
      const vertical = Math.abs(b.y - a.y) > Math.abs(b.x - a.x);
      for (const frac of [0.34, 0.55, 0.2, 0.72, 0.86]) {
        let t = frac;
        if (vertical) {
          const yTop = Math.min(a.y, b.y);
          const yBot = Math.max(a.y, b.y);
          if (yBot < 8 || yTop > 92) return { show: false };
          const yVis = Math.max(10, yTop) + (Math.min(88, yBot) - Math.max(10, yTop)) * frac;
          t = (yVis - a.y) / (b.y - a.y || 1);
        } else {
          const xL = Math.min(a.x, b.x);
          const xR = Math.max(a.x, b.x);
          if (xR < 8 || xL > 92) return { show: false };
          const xVis = Math.max(10, xL) + (Math.min(88, xR) - Math.max(10, xL)) * frac;
          t = (xVis - a.x) / (b.x - a.x || 1);
        }
        t = Math.max(0.08, Math.min(0.92, t));
        const x = a.x + (b.x - a.x) * t;
        const y = a.y + (b.y - a.y) * t;
        if (x < 5 || x > 95 || y < 5 || y > 95) continue;
        if (!claim(x, y, rd.name!.length, vertical)) continue;
        return {
          show: true,
          name: rd.name,
          key: rd.name,
          style: css(
            "position:absolute;left:" +
              x.toFixed(1) +
              "%;top:" +
              y.toFixed(1) +
              "%;transform:translate(-50%,-50%)" +
              (vertical ? " rotate(-90deg)" : "") +
              ";font-size:10px;letter-spacing:0.02em;color:#6B6250;white-space:nowrap;pointer-events:none;background:rgba(244,241,232,0.9);padding:0 4px;border-radius:2px;"
          ),
        };
      }
      return { show: false };
    })
    .filter((rd): rd is { show: true; name: string; key: string; style: CSSProperties } => Boolean(rd.show));

  const rangeLabel = start === null ? "Drag to pick" : selEnd === null || selEnd === start ? `${start} Sept` : `${start} to ${selEnd} Sept`;
  const stepLabel = step >= 4 ? "Done in 40 seconds" : `Step ${step} of 3`;

  const confettiPieces = confetti
    ? Array.from({ length: 14 }, (_, i) => ({
        key: i,
        style: css(
          "position:absolute;top:0;left:" +
            (5 + i * 6.8) +
            "%;width:" +
            (i % 3 === 0 ? 5 : 7) +
            "px;height:" +
            (i % 2 ? 9 : 6) +
            "px;border-radius:1px;pointer-events:none;background:" +
            ["#8A5A7A", "#A9709A", "#6E8C6A", "#A98A5A", "#6E5A7A"][i % 5] +
            ";animation:tfFall " +
            (900 + (i % 5) * 190) +
            "ms ease-in " +
            (i % 7) * 70 +
            "ms both;"
        ),
      }))
    : [];

  const pins = [{ name: mapOriginName, lat: stayAt.lat, lng: stayAt.lng, stay: true, tint: "" }]
    .concat(allPlaces.map((p) => ({ ...p, stay: false })))
    .map((p, i) => {
      const xy = project(p);
      const active = activePin === i;
      const flip = xy.x > 62;
      return {
        key: i,
        n: p.stay ? "⌂" : active ? String(i) : "",
        name: p.name,
        showTag: active && !p.stay,
        onEnter: () => setActivePin(i),
        onLeave: () => setActivePin(null),
        wrapStyle: css(
          "position:absolute;left:" +
            xy.x.toFixed(1) +
            "%;top:" +
            xy.y.toFixed(1) +
            "%;transform:translate(-50%,-50%);display:flex;flex-direction:" +
            (flip ? "row-reverse" : "row") +
            ";align-items:center;gap:6px;cursor:default;z-index:" +
            (active ? 5 : p.stay ? 4 : 2) +
            ";"
        ),
        dotStyle: css(
          p.stay
            ? "width:27px;height:27px;border-radius:999px;flex:none;display:flex;align-items:center;justify-content:center;font-size:13px;color:#FFFDF9;background:#2F5D5A;box-shadow:0 1px 5px rgba(27,25,23,0.18);"
            : "width:" +
                (active ? 26 : 13) +
                "px;height:" +
                (active ? 26 : 13) +
                "px;border-radius:999px;flex:none;display:flex;align-items:center;justify-content:center;font-family:'DM Mono',monospace;font-size:11px;color:#FFFDF9;box-shadow:0 1px 4px rgba(27,25,23,0.14);transition:width 130ms ease,height 130ms ease;background:" +
                (p as { tint: string }).tint +
                ";"
        ),
        tagStyle: css(
          "font-size:11.5px;white-space:nowrap;background:#FFFDF9;border:1px solid #E4DED2;border-radius:999px;padding:3px 9px;box-shadow:0 1px 5px rgba(27,25,23,0.1);color:#2B2825;"
        ),
      };
    });

  const scaleBarStyle = (() => {
    const w = Math.min(scaleWidth, 34);
    const pinsXY = pts.map(project);
    const hit = (bottom: number) => pinsXY.some((p) => p.x < w + 6 && p.y > 100 - bottom - 16 && p.y < 100 - bottom + 8);
    const onLand = Math.max(6, 100 - bankMidY + 4);
    const low = hit(onLand);
    const high = hit(78);
    const bottom = !low ? onLand : !high ? 78 : 42;
    return css("position:absolute;left:14px;bottom:" + bottom + "%;width:" + w + "%;display:flex;flex-direction:column;gap:2px;");
  })();

  function addPlace() {
    const v = thing.trim();
    if (v) {
      setPlaces((p) => p.concat(v));
      setThing("");
    }
  }
  function addThing() {
    const v = thing.trim();
    setStep(4);
    if (v) setPlaces((p) => p.concat(v));
    setThing("");
  }

  return (
    <div
      onMouseUp={() => dragging && setDragging(false)}
      style={{
        background: "#FFFDF9",
        border: "1px solid #E4DED2",
        borderRadius: 16,
        boxShadow: "0 14px 40px rgba(27,25,23,0.06)",
        overflow: "hidden",
        userSelect: "none",
      }}
    >
      <div
        style={{
          padding: "14px 20px",
          borderBottom: "1px solid #EDE8DD",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <span
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 11,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "#A19A8E",
          }}
        >
          Lisbon &amp; the Algarve · 4 going
        </span>
        <span style={{ fontSize: 13, color: "#8C8478" }}>{stepLabel}</span>
      </div>

      {step === 1 && (
        <div style={{ padding: "18px 20px 20px" }}>
          <div style={{ fontSize: 15, color: "#2B2825", marginBottom: 4 }}>When could you go?</div>
          <div style={{ fontSize: 13.5, color: "#8C8478", marginBottom: 14 }}>Drag across the days that work for you.</div>

          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 9 }}>
            <span style={{ fontSize: 13.5 }}>September 2026</span>
            <span style={{ fontSize: 13, color: "#8C8478" }}>{rangeLabel}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3, marginBottom: 4 }}>
            {["M", "T", "W", "T", "F", "S", "S"].map((w, i) => (
              <div key={i} style={{ textAlign: "center", fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#A19A8E" }}>
                {w}
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
            {days.map((d) => (
              <button
                key={d.key}
                type="button"
                disabled={d.disabled}
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (d.d !== undefined) down(d.d);
                }}
                onMouseEnter={() => d.d !== undefined && over(d.d)}
                style={d.style}
              >
                {d.label}
              </button>
            ))}
          </div>

          <div style={{ marginTop: 15, paddingTop: 14, borderTop: "1px solid #EDE8DD", display: "grid", gap: 8 }}>
            {AVAIL.map((a) => (
              <div key={a.key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={css(avatarStyle(PEOPLE[a.key], 26))}>{PEOPLE[a.key].initials}</div>
                <span style={{ fontSize: 13.5, color: "#4A453E", flex: 1 }}>{PEOPLE[a.key].name}</span>
                <span style={{ fontSize: 13, color: "#8C8478" }}>{a.window}</span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 15 }}>
            <button
              type="button"
              onClick={() => {
                setStep(2);
                setConfetti(true);
                later(() => setConfetti(false), 1600);
              }}
              style={{ border: "none", background: "#8A5A7A", color: "#FFFDF9", fontSize: 14.5, padding: "11px 22px", borderRadius: 999, cursor: "pointer" }}
            >
              Find what works for everyone
            </button>
            <a
              href="#demo"
              onClick={runAll}
              style={{ fontSize: 13.5, color: "#8C8478", textDecoration: "underline", textUnderlineOffset: 3 }}
            >
              Show me anyway
            </a>
          </div>
        </div>
      )}

      {step > 1 && (
        <div
          style={{
            position: "relative",
            overflow: "hidden",
            padding: "16px 20px",
            background: "#FBF6EC",
            borderBottom: "1px solid #E8DFD0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          {confettiPieces.map((c) => (
            <div key={c.key} style={c.style} />
          ))}
          <div>
            <div
              style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: 10.5,
                letterSpacing: "0.11em",
                textTransform: "uppercase",
                color: "#A19A8E",
                marginBottom: 5,
              }}
            >
              Dates locked
            </div>
            <div style={{ fontSize: 17, color: "#1B1917", marginBottom: 3 }}>
              {r.start} to {r.end} Sept, {r.nights} nights
            </div>
            <div style={{ fontSize: 14, color: "#4C6749" }}>These are the dates that work for all four</div>
          </div>
          <button
            type="button"
            onClick={() => setStep(1)}
            style={{ border: "1px solid #D9D2C4", background: "#FFFDF9", padding: "8px 16px", borderRadius: 999, fontSize: 13.5, color: "#1B1917", cursor: "pointer" }}
          >
            Change dates
          </button>
        </div>
      )}

      {step === 2 && (
        <div style={{ padding: "18px 0 20px", animation: "tfRise 380ms ease-out both" }}>
          <div style={{ padding: "0 20px 14px" }}>
            <div style={{ fontSize: 15, color: "#2B2825", marginBottom: 4 }}>Where do we stay?</div>
            <div style={{ fontSize: 13.5, color: "#8C8478" }}>
              Everything the group added, priced for your {r.nights} nights. Vote, or add one of your own.
            </div>
          </div>

          <div style={{ overflowX: "auto", padding: "0 20px 2px" }}>
            <div style={{ minWidth: "100%", boxSizing: "border-box", border: "1px solid #EDE8DD", borderRadius: 12, overflow: "hidden" }}>
              <div style={{ display: "flex" }}>
                <div
                  style={{
                    boxSizing: "border-box",
                    width: 112,
                    flex: "none",
                    borderBottom: "1px solid #EDE8DD",
                    borderRight: "1px solid #EDE8DD",
                    background: "#FCFAF5",
                  }}
                />
                {stayCols.map((c) => (
                  <div key={c.o.id} style={c.headStyle}>
                    <div style={c.thumbStyle}>
                      {c.isHome && (
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#4A453E" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 10.5 12 3l9 7.5"></path>
                          <path d="M5.5 9.5V20h13V9.5"></path>
                          <path d="M10 20v-5.5h4V20"></path>
                        </svg>
                      )}
                      {c.isHotel && (
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#4A453E" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 18h18"></path>
                          <path d="M5 18V6h9v12"></path>
                          <path d="M14 10h5v8"></path>
                          <path d="M8 9h3"></path>
                          <path d="M8 13h3"></path>
                        </svg>
                      )}
                      <span style={c.sourceStyle}>{c.source}</span>
                    </div>
                    <div style={{ fontSize: 13.5, lineHeight: 1.25, minHeight: 34, marginBottom: 2 }}>{c.name}</div>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "#A19A8E" }}>
                      {c.meta}
                    </div>
                  </div>
                ))}
                {!extraStay && (
                  <div
                    onClick={() => setExtraStay(true)}
                    style={{
                      boxSizing: "border-box",
                      flex: "1 1 0",
                      minWidth: 124,
                      borderBottom: "1px solid #EDE8DD",
                      padding: "12px 14px",
                      borderLeft: "1px dashed #DCD4C4",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "flex-start",
                      gap: 4,
                      background: "#FCFAF5",
                    }}
                  >
                    <div style={{ fontSize: 13.5, color: "#8A5A7A" }}>+ Paste a link</div>
                    <div style={{ fontSize: 11.5, lineHeight: 1.4, color: "#8C8478" }}>Add a place you found</div>
                  </div>
                )}
              </div>

              {matrixRows.map((row) => (
                <div key={row.key} style={{ display: "flex" }}>
                  <div style={labelStyle}>{row.label}</div>
                  {row.cells.map((c) => (
                    <div key={c.key} style={c.style}>
                      <div style={c.mainStyle}>{c.main}</div>
                      <div style={{ fontSize: 11.5, lineHeight: 1.35, color: "#8C8478" }}>{c.sub}</div>
                    </div>
                  ))}
                  {!extraStay && (
                    <div
                      style={{
                        boxSizing: "border-box",
                        flex: "1 1 0",
                        minWidth: 124,
                        padding: "12px 14px",
                        borderBottom: "1px solid #EDE8DD",
                        borderLeft: "1px dashed #DCD4C4",
                        background: "#FCFAF5",
                      }}
                    />
                  )}
                </div>
              ))}

              <div style={{ display: "flex" }}>
                <div
                  style={{
                    boxSizing: "border-box",
                    width: 112,
                    flex: "none",
                    borderRight: "1px solid #EDE8DD",
                    padding: 12,
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 9.5,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "#8C8478",
                    background: "#FCFAF5",
                    lineHeight: 1.6,
                  }}
                >
                  Votes
                  <br />
                  {(vote === null ? 3 : 4) + " of 4 in"}
                </div>
                {stayCols.map((c) => (
                  <div key={c.o.id} style={c.voteCellStyle}>
                    <div style={{ display: "flex", marginBottom: 9, height: 22 }}>
                      {c.voters.map((v, vi) => (
                        <div key={vi} style={v.style}>
                          {v.initials}
                        </div>
                      ))}
                    </div>
                    <button type="button" onClick={c.onVote} style={c.voteBtnStyle}>
                      {c.voteBtn}
                    </button>
                  </div>
                ))}
                {!extraStay && (
                  <div style={{ boxSizing: "border-box", flex: "1 1 0", minWidth: 124, padding: "12px 14px", borderLeft: "1px dashed #DCD4C4", background: "#FCFAF5" }} />
                )}
              </div>
            </div>
          </div>

          <div style={{ padding: "14px 20px 0" }}>
            {tied && (
              <div
                style={{
                  border: "1px solid #E8DFD0",
                  background: "#FBF6EC",
                  borderRadius: 10,
                  padding: "13px 14px",
                  animation: "tfRise 320ms ease-out both",
                }}
              >
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 12 }}>
                  <div style={{ width: 11, height: 11, borderRadius: 3, background: "#A98A5A", flex: "none", marginTop: 4 }} />
                  <div style={{ fontSize: 13, lineHeight: 1.5, color: "#2B2825" }}>
                    {leaders.map((o) => o.name).join(" and ")} are level at {top} each. Pick the axis and That Friend closes it.
                  </div>
                </div>
                <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => setTiebreak("price")}
                    style={{ border: "1px solid #D9D2C4", background: "#FFFDF9", color: "#1B1917", fontSize: 13.5, padding: "9px 16px", borderRadius: 999, cursor: "pointer" }}
                  >
                    Break it on cost
                  </button>
                  <button
                    type="button"
                    onClick={() => setTiebreak("walk")}
                    style={{ border: "1px solid #D9D2C4", background: "#FFFDF9", color: "#1B1917", fontSize: 13.5, padding: "9px 16px", borderRadius: 999, cursor: "pointer" }}
                  >
                    Break it on location
                  </button>
                </div>
              </div>
            )}
            {vote !== null && !tied && (
              <div style={{ animation: "tfRise 320ms ease-out both" }}>
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-start",
                    background: "#FBF6EC",
                    border: "1px solid #E8DFD0",
                    borderRadius: 10,
                    padding: "11px 13px",
                    marginBottom: 14,
                  }}
                >
                  <div style={{ width: 11, height: 11, borderRadius: 3, background: "#8A5A7A", flex: "none", marginTop: 4 }} />
                  <div style={{ fontSize: 13, lineHeight: 1.5, color: "#2B2825" }}>
                    {tiebreak
                      ? `${winner.name} takes it on ${tiebreak === "price" ? "cost" : "location"}. The tie is logged, so nobody relitigates it on Thursday.`
                      : winner.inCity
                        ? `${winner.name} puts ${winner.reach.prose}, so nobody needs a car to get to dinner.`
                        : `${winner.name} is the cheapest bed, but it is ${winner.reach.label} from the places you saved, so your Lisbon nights get planned separately.`}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    style={{ border: "none", background: "#8A5A7A", color: "#FFFDF9", fontSize: 14.5, padding: "11px 22px", borderRadius: 999, cursor: "pointer" }}
                  >
                    Lock in {winner.name}
                  </button>
                  <span style={{ fontSize: 13, color: "#8C8478" }}>
                    {winnerVotes} of 4, about ${perPerson} each for the trip
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {step > 2 && (
        <div
          style={{
            padding: "13px 20px",
            borderBottom: "1px solid #EDE8DD",
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: 10.5,
                letterSpacing: "0.11em",
                textTransform: "uppercase",
                color: "#A19A8E",
                marginBottom: 4,
              }}
            >
              Bed decided
            </div>
            <div style={{ fontSize: 15.5, color: "#1B1917" }}>{winner.name}</div>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <span style={{ fontSize: 13, color: "#8C8478" }}>{winnerVotes} of 4 voted</span>
            <button
              type="button"
              onClick={() => setStep(2)}
              style={{ border: "1px solid #D9D2C4", background: "#FFFDF9", padding: "7px 15px", borderRadius: 999, fontSize: 13, color: "#1B1917", cursor: "pointer" }}
            >
              Change vote
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div style={{ padding: "18px 20px 20px", animation: "tfRise 380ms ease-out both" }}>
          <div style={{ fontSize: 15, color: "#2B2825", marginBottom: 4 }}>The places you want to eat</div>
          <div style={{ fontSize: 13.5, color: "#8C8478", marginBottom: 13 }}>
            Saved from the links your group sent. Hover a pin to see which is which, and add your own.
          </div>

          <div
            style={{
              position: "relative",
              height: 268,
              borderRadius: 11,
              border: "1px solid #E4DED2",
              overflow: "hidden",
              background: "#F4F1E8",
              marginBottom: 12,
            }}
          >
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", shapeRendering: "geometricPrecision" }}>
              <polygon points={["0," + bankMidY.toFixed(2), "100," + bankMidY.toFixed(2), "100,200", "0,200"].join(" ")} fill="#D5E1DE" />
              {PARKS.map((k, ki) => {
                const xy = k.pts.map((p) => project({ lat: p[0], lng: p[1] })).map((p) => ({ x: p.x, y: Math.min(p.y, bankMidY) })); // never spill into the water
                const inFrame =
                  Math.min(...xy.map((p) => p.x)) < 100 &&
                  Math.max(...xy.map((p) => p.x)) > 0 &&
                  Math.min(...xy.map((p) => p.y)) < 100 &&
                  Math.max(...xy.map((p) => p.y)) > 0 &&
                  Math.min(...xy.map((p) => p.x)) > -14 &&
                  Math.min(...xy.map((p) => p.y)) > -14 &&
                  Math.max(...xy.map((p) => p.y)) - Math.min(...xy.map((p) => p.y)) > 1.5;
                if (!inFrame) return null;
                return <polygon key={ki} points={xy.map((p) => p.x.toFixed(2) + "," + p.y.toFixed(2)).join(" ")} fill="#DCE4CE" />;
              })}
              {ROADS.filter((rd) => rd.w === "minor").map((rd, ri) => (
                <polyline
                  key={ri}
                  points={rd.pts.map((p) => {
                    const xy = project({ lat: p[0], lng: p[1] });
                    return xy.x.toFixed(2) + "," + xy.y.toFixed(2);
                  }).join(" ")}
                  fill="none"
                  stroke="#E9E0CB"
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                  strokeLinecap="round"
                />
              ))}
              {ROADS.filter((rd) => rd.w === "major").map((rd, ri) => (
                <polyline
                  key={ri}
                  points={rd.pts.map((p) => {
                    const xy = project({ lat: p[0], lng: p[1] });
                    return xy.x.toFixed(2) + "," + xy.y.toFixed(2);
                  }).join(" ")}
                  fill="none"
                  stroke="#DCD1B6"
                  strokeWidth="7"
                  vectorEffect="non-scaling-stroke"
                  strokeLinecap="round"
                />
              ))}
              {ROADS.filter((rd) => rd.w === "major").map((rd, ri) => (
                <polyline
                  key={ri}
                  points={rd.pts.map((p) => {
                    const xy = project({ lat: p[0], lng: p[1] });
                    return xy.x.toFixed(2) + "," + xy.y.toFixed(2);
                  }).join(" ")}
                  fill="none"
                  stroke="#F7F1E2"
                  strokeWidth="4.5"
                  vectorEffect="non-scaling-stroke"
                  strokeLinecap="round"
                />
              ))}
            </svg>
            {tejoAt && (
              <div
                style={css(
                  "position:absolute;left:" +
                    tejoAt.x +
                    "%;top:" +
                    Math.min(95, tejoAt.y + 5).toFixed(1) +
                    "%;font-family:'DM Mono',monospace;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#46645D;pointer-events:none;"
                )}
              >
                Rio Tejo
              </div>
            )}
            {parkLabelList.map((k) => (
              <div key={k.key} style={k.style}>
                {k.name}
              </div>
            ))}
            {roadLabelList.map((rd) => (
              <div key={rd.key} style={rd.style}>
                {rd.name}
              </div>
            ))}
            {hoodList.map((h) => (
              <div key={h.key} style={h.style}>
                {h.name}
              </div>
            ))}
            {pins.map((p) => (
              <div key={p.key} onMouseEnter={p.onEnter} onMouseLeave={p.onLeave} style={p.wrapStyle}>
                <div style={p.dotStyle}>{p.n}</div>
                {p.showTag && <div style={p.tagStyle}>{p.name}</div>}
              </div>
            ))}
            <div
              style={{
                position: "absolute",
                right: 12,
                top: 11,
                display: "flex",
                alignItems: "center",
                gap: 7,
                background: "rgba(255,253,249,0.92)",
                border: "1px solid #E4DED2",
                borderRadius: 999,
                padding: "4px 10px 4px 6px",
              }}
            >
              <div
                style={{
                  width: 17,
                  height: 17,
                  borderRadius: 999,
                  background: "#2F5D5A",
                  color: "#FFFDF9",
                  fontSize: 9.5,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flex: "none",
                }}
              >
                ⌂
              </div>
              <span style={{ fontSize: 11, color: "#4A453E", whiteSpace: "nowrap" }}>{mapOriginName}</span>
            </div>
            <div style={scaleBarStyle}>
              <div style={{ height: 3, background: "rgba(255,253,249,0.7)", border: "1px solid #B6AE9C", borderRadius: 2 }} />
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.08em", color: "#8C8478", alignSelf: "center" }}>
                {scaleKm < 1 ? "500 m" : `${scaleKm} km`}
              </span>
            </div>
          </div>

          <div style={{ display: "grid", gap: 7, marginBottom: 13 }}>
            {allPlaces.map((p, i) => (
              <div
                key={i}
                onMouseEnter={() => setActivePin(i + 1)}
                onMouseLeave={() => setActivePin(null)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 11px",
                  borderRadius: 9,
                  cursor: "default",
                  transition: "border-color 140ms ease, background 140ms ease",
                  border: "1px solid " + (activePin === i + 1 ? "#8A5A7A" : p.mine ? "#E1CBD9" : "#EDE8DD"),
                  background: activePin === i + 1 || p.mine ? "#FBF6EC" : "#FFFDF9",
                }}
              >
                <span style={{ width: 11, height: 11, borderRadius: 999, flex: "none", background: p.tint }} />
                <span style={{ fontSize: 13.5, color: "#1B1917", flex: 1, minWidth: 0 }}>{p.name}</span>
                <span style={{ fontSize: 12.5, color: "#8C8478", whiteSpace: "nowrap" }}>{p.source === "WhatsApp" ? "From the group chat" : `Added by ${p.source}`}</span>
                <span style={{ fontSize: 12.5, color: "#4A453E" }}>{p.walk}</span>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 9, marginBottom: 13 }}>
            <input
              value={thing}
              onChange={(e) => setThing(e.target.value)}
              placeholder="Add a restaurant anywhere in Lisbon"
              style={{ flex: 1, minWidth: 0, border: "1px solid #E4DED2", background: "#FFFDF9", borderRadius: 9, padding: "11px 12px", fontSize: 14.5, color: "#1B1917", outline: "none" }}
            />
            <button
              type="button"
              onClick={addPlace}
              style={{ border: "1px solid #E4DED2", background: "#FFFDF9", color: "#1B1917", fontSize: 14.5, padding: "11px 18px", borderRadius: 9, cursor: "pointer", whiteSpace: "nowrap" }}
            >
              Add
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
            <button
              type="button"
              onClick={addThing}
              style={{ border: "none", background: "#8A5A7A", color: "#FFFDF9", fontSize: 14.5, padding: "11px 22px", borderRadius: 999, cursor: "pointer" }}
            >
              Put them on the plan
            </button>
            <span style={{ fontSize: 13, color: "#8C8478" }}>
              {winner.inCity
                ? `${allPlaces.length} places, timed from ${winner.name}`
                : `${allPlaces.length} places on the Lisbon nights. Your coast nights at ${winner.name} are planned separately.`}
            </span>
          </div>
        </div>
      )}

      {step === 4 && (
        <div style={{ animation: "tfRise 400ms ease-out both" }}>
          <div style={{ padding: "16px 20px 6px" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10.5, letterSpacing: "0.11em", textTransform: "uppercase", color: "#A19A8E" }}>Itinerary</div>
          </div>
          {itinerary.map((i) => (
            <div key={i.key} style={i.style}>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11.5, color: "#A19A8E", width: 34, flex: "none" }}>{i.day}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, color: "#1B1917" }}>{i.title}</div>
                <div style={{ fontSize: 13, color: "#8C8478", marginTop: 2 }}>{i.note}</div>
              </div>
            </div>
          ))}
          <div style={{ padding: "16px 20px", background: "#FBF6EC", borderTop: "1px solid #E8DFD0" }}>
            <div style={{ fontSize: 14, color: "#2B2825", marginBottom: 12 }}>
              Dates locked, bed decided, and every place you saved is on the map.
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
              <Link
                href="/planner/trips/new"
                style={{ border: "none", background: "#1B1917", color: "#F7F4EE", fontSize: 14.5, padding: "11px 22px", borderRadius: 999, cursor: "pointer", textDecoration: "none" }}
              >
                Start planning
              </Link>
              <a href="#demo" onClick={reset} style={{ fontSize: 13.5, color: "#8C8478", textDecoration: "underline", textUnderlineOffset: 3 }}>
                Try it again
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
