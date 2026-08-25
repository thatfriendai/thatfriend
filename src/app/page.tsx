import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SiteNav } from "@/components/SiteNav";
import { TripPreviewCard } from "@/components/TripPreviewCard";

const steps = [
  {
    n: "01",
    title: "Everyone answers once",
    body: "What they can spend on flights, a bed and food, the pace they want, and the one thing they'd rather not compromise on.",
  },
  {
    n: "02",
    title: "The plan gets proposed",
    body: 'Instead of another "thoughts?", you get a decision card: two real options, what each costs, who it suits.',
  },
  {
    n: "03",
    title: "It all lands on the map",
    body: "Notes, links and saved lists pin themselves to a day, so you can see the flow of the trip.",
  },
];

const nudgeCards = [
  {
    label: "SENT TO THE GROUP · TUESDAY",
    body: "Flights to Lisbon are up $60 since Friday. Four of you have booked. Jonah and Priya, this is the last week the group is on the same flight.",
  },
  {
    label: "NUDGED PRIVATELY",
    body: "Sam, you owe Maya $140 for the villa deposit. Want me to send her your half now?",
  },
  {
    label: "DECISION CLOSED",
    body: "Five of six have picked the split week. Lagos nights are on the map, and I moved Sunday dinner to the coast.",
  },
];

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/trips");

  return (
    <div className="flex flex-1 flex-col bg-cream">
      <SiteNav />

      <section className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-12 px-6 py-12 sm:px-10 lg:grid-cols-2 lg:py-20">
        <div className="flex flex-col gap-6">
          <p className="text-xs font-semibold tracking-[0.14em] text-muted uppercase">
            Group travel, decided
          </p>
          <h1 className="font-display text-5xl leading-[1.05] text-ink sm:text-6xl">
            Six people,
            <br />
            one trip that <em className="text-accent-light italic">actually</em>
            <br />
            happens.
          </h1>
          <p className="max-w-md text-base leading-relaxed text-ink/75">
            Everyone drops their budget, dates and non-negotiables. That
            Friend reads the room, proposes the decision, and keeps the plan,
            the notes and the map in one place.
          </p>

          <form
            action="/signup"
            className="flex max-w-md flex-col gap-3 sm:flex-row"
          >
            <input
              type="text"
              name="tripName"
              placeholder="Name your trip: &lsquo;Lisbon&rsquo;"
              className="flex-1 rounded-full border border-border bg-card px-5 py-3 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-full bg-accent px-6 py-3 text-sm font-medium text-cream hover:bg-ink"
            >
              Start planning
            </button>
          </form>
          <p className="text-xs text-muted">
            Free for groups up to 8. No app to download.
          </p>
        </div>

        <div className="flex justify-center lg:justify-end">
          <TripPreviewCard />
        </div>
      </section>

      <section id="how-it-works" className="mx-auto w-full max-w-6xl px-6 py-16 sm:px-10">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-3">
          {steps.map((step) => (
            <div key={step.n} className="flex flex-col gap-3">
              <p className="text-xs font-semibold tracking-[0.14em] text-accent">
                {step.n}
              </p>
              <h3 className="font-display text-xl text-ink">{step.title}</h3>
              <p className="text-sm leading-relaxed text-ink/70">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="workspace" className="bg-dark px-6 py-20 sm:px-10">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-12 lg:grid-cols-2">
          <div className="flex flex-col gap-5">
            <h2 className="font-display text-3xl leading-tight text-cream sm:text-4xl">
              No more asking your friend to send that list again.
            </h2>
            <p className="text-sm leading-relaxed text-dark-muted">
              Recommendations, notes, links and saved places all live in the
              same document — so That Friend can build the itinerary out of
              them instead of you scrolling back through six months of
              messages.
            </p>
            <ul className="flex flex-col gap-2 text-sm text-dark-muted">
              <li>&mdash; Notes and links, with previews</li>
              <li>&mdash; Saved lists and bookings in one column</li>
              <li>&mdash; Day-by-day itinerary rail beside a live map</li>
            </ul>
          </div>
          <div className="flex aspect-[4/3] items-center justify-center rounded-2xl border border-white/10 bg-white/5 bg-[linear-gradient(45deg,transparent_48%,oklch(1_0_0/0.06)_50%,transparent_52%)] bg-[length:16px_16px]">
            <p className="text-xs tracking-wide text-dark-muted">
              screenshot &middot; itinerary rail + map
            </p>
          </div>
        </div>
      </section>

      <section id="nudging" className="mx-auto w-full max-w-6xl px-6 py-20 sm:px-10">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
          <div className="flex flex-col gap-5">
            <p className="text-xs font-semibold tracking-[0.14em] text-muted uppercase">
              Nobody has to be the nag
            </p>
            <h2 className="font-display text-3xl leading-tight text-ink sm:text-4xl">
              That Friend does the chasing, so you don&rsquo;t have to.
            </h2>
            <p className="text-sm leading-relaxed text-ink/70">
              Someone always ends up asking three times about dates,
              deposits and who still owes for the car. That job moves here.
              It follows up on open decisions, reminds people what they said
              they&rsquo;d book, and closes the loop when everyone has
              answered.
            </p>
            <p className="text-sm leading-relaxed text-ink/70">
              You stay the friend who&rsquo;s excited about the trip.
            </p>
          </div>
          <div className="flex flex-col gap-4">
            {nudgeCards.map((card) => (
              <div
                key={card.label}
                className="rounded-2xl border border-border bg-card p-5 shadow-sm"
              >
                <p className="text-[11px] font-semibold tracking-[0.1em] text-accent uppercase">
                  {card.label}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-ink/85">
                  {card.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-3xl px-6 py-20 text-center sm:px-10">
        <blockquote className="font-display text-2xl leading-snug text-ink sm:text-3xl">
          &ldquo;I&rsquo;m always the one who plans it. This is the first
          year I didn&rsquo;t have to be.&rdquo;
        </blockquote>
        <p className="mt-4 text-xs font-semibold tracking-[0.14em] text-muted uppercase">
          Every group has one &middot; That Friend
        </p>
      </section>

      <footer className="border-t border-border px-6 py-8 sm:px-10">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 text-sm text-muted sm:flex-row">
          <span className="font-display lowercase text-ink">that friend</span>
          <div className="flex gap-6">
            <Link href="#how-it-works" className="hover:text-ink">
              How it works
            </Link>
            <Link href="#workspace" className="hover:text-ink">
              Workspace
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
