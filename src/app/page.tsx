import Link from "next/link";
import { redirect } from "next/navigation";
import { getPlannerUser } from "@/lib/planner/session";
import { SiteNav } from "@/components/SiteNav";
import { TripPreviewCard } from "@/components/TripPreviewCard";

const steps = [
  {
    n: "01",
    title: "Everyone answers once",
    body: "What they can spend on flights, a bed, and food. The pace they want, and the one thing they'd rather not compromise on.",
  },
  {
    n: "02",
    title: "The plan gets proposed",
    body: 'Instead of another "thoughts?", you get a decision card: two real options, what each costs, who it suits.',
  },
  {
    n: "03",
    title: "It all lands on the map",
    body: "Notes, links, restaurant recs, and saved spots live in one place, so you can see the flow of the trip at a glance.",
  },
];

const whatsappExample = {
  incoming:
    "“someone told me to go to o frade in lisbon, small place, book ahead”",
  reply:
    "Added O Frade to Day 2, evening. It takes reservations 30 days out. Want me to put it to the group?",
};

const nudgeCards = [
  {
    label: "Sent to the group · Tuesday",
    body: "Flights to Lisbon are up $60 since Friday. Four of you have booked. Jonah and Priya, this is the last week the group is on the same flight.",
  },
  {
    label: "Nudged privately",
    body: "Sam, you owe Maya $140 for the villa deposit. Want me to send her your half now?",
  },
  {
    label: "Decision closed",
    body: "Five of six picked the split week. Lagos nights are on the map, and I moved Sunday dinner to the coast.",
  },
];

const forGroups = [
  {
    title: "Bachelorette weekends",
    body: "Eight people, one bride, six different budgets. Costs are visible from the start, so nobody gets priced out or stuck footing the bill.",
  },
  {
    title: "Reunion trips",
    body: "College friends now live in four different cities. Everyone answers what they can, and the plan still lands close enough to work for the group.",
  },
  {
    title: "Birthday trips",
    body: "One person's celebration, everyone else's spending. The birthday person gets say on the things that matter and doesn't have to run logistics.",
  },
  {
    title: "Family and multi-household",
    body: "Two families, different nap schedules, one house. Days get built around the constraints instead of clashing under them.",
  },
  {
    title: "Remote work week",
    body: "One destination, real work hours built in. That Friend blocks out who's got a 9am standup and who needs a quiet morning, and plans the actual trip around it, not instead of it.",
  },
  {
    title: "And the one you never took",
    body: "The trip you've talked about for three years never got submitted. This is the year That Friend is ready for it.",
    highlight: true,
  },
];

export default async function Home() {
  const plannerUser = await getPlannerUser();
  if (plannerUser) redirect("/planner/trips");

  return (
    <div className="flex flex-1 flex-col bg-cream">
      <SiteNav />

      <section className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-16 px-6 py-16 sm:px-10 lg:grid-cols-[1.05fr_1fr] lg:py-24">
        <div>
          <p className="mb-7 font-mono text-[11px] tracking-[0.14em] text-muted uppercase">
            The group trip that actually happens.
          </p>
          <h1 className="mb-6 text-6xl leading-[1.02] font-display tracking-tight text-ink text-balance sm:text-7xl">
            Six people, one trip that <em className="text-accent not-italic italic">actually</em> happens.
          </h1>
          <p className="mb-9 max-w-lg text-lg leading-relaxed text-body text-pretty">
            Everyone drops their budget, dates, and non-negotiables. That
            Friend reads the room, proposes the decision, and keeps the plan,
            notes, and map in one place, so your group trip planning
            doesn&rsquo;t live in 200 unread texts.
          </p>

          <form
            action="/planner/trips/new"
            className="mb-5 flex max-w-md items-center gap-3"
          >
            <input
              type="text"
              name="name"
              placeholder="Name your trip: &ldquo;Lisbon&rdquo;"
              className="max-w-[340px] flex-1 rounded-full border border-input-border bg-card px-5 py-3.5 text-[15px] text-ink outline-none focus:border-ink"
            />
            <button
              type="submit"
              className="rounded-full bg-accent px-7 py-4 text-[15px] whitespace-nowrap text-card hover:bg-ink"
            >
              Start planning
            </button>
          </form>
          <p className="text-[13px] text-muted">
            Free for groups up to 6. No app to download.
          </p>
        </div>

        <div className="flex justify-center lg:justify-end">
          <TripPreviewCard />
        </div>
      </section>

      <section id="how" className="border-t border-border px-6 py-20 sm:px-10">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-12 sm:grid-cols-3 sm:gap-14">
          {steps.map((step) => (
            <div key={step.n} className="flex flex-col gap-3.5">
              <p className="font-mono text-[11px] tracking-[0.14em] text-accent">
                {step.n}
              </p>
              <h3 className="text-3xl leading-tight font-display text-ink">
                {step.title}
              </h3>
              <p className="text-base leading-relaxed text-body text-pretty">
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section id="workspace" className="bg-dark px-6 py-24 text-cream sm:px-10">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-16 lg:grid-cols-[1fr_1.15fr]">
          <div>
            <h2 className="mb-5 text-5xl leading-[1.06] font-display tracking-tight text-cream">
              No more asking your friend to send that list again.
            </h2>
            <p className="mb-8 max-w-md text-lg leading-relaxed text-dark-body text-pretty">
              Recommendations, links, and saved places all live in the same
              trip plan, so That Friend can build the itinerary out of them
              instead of you scrolling back through six months of messages.
            </p>
            <ul className="flex flex-col gap-3 text-[15.5px] text-[#E8E2D6]">
              <li className="flex items-baseline gap-3">
                <span className="font-mono text-xs text-accent">&rarr;</span>
                Notes and links, with previews
              </li>
              <li className="flex items-baseline gap-3">
                <span className="font-mono text-xs text-accent">&rarr;</span>
                Saved lists and bookings in one spot
              </li>
              <li className="flex items-baseline gap-3">
                <span className="font-mono text-xs text-accent">&rarr;</span>
                Day-by-day itinerary alongside a live map
              </li>
            </ul>
          </div>
          <div className="flex h-[400px] items-center justify-center rounded-2xl border border-dark-border bg-[repeating-linear-gradient(135deg,#222020_0_9px,#1B1917_9px_18px)]">
            <p className="rounded-md border border-dark-border px-3.5 py-2 font-mono text-[11.5px] tracking-wide text-muted">
              screenshot &middot; itinerary rail + map
            </p>
          </div>
        </div>
      </section>

      <section id="nudge" className="border-t border-border px-6 py-24 sm:px-10">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-16 lg:grid-cols-2">
          <div>
            <p className="mb-6 font-mono text-[11.5px] tracking-[0.14em] text-muted uppercase">
              Nobody has to be the nag
            </p>
            <h2 className="mb-5 text-5xl leading-[1.06] font-display tracking-tight text-ink text-balance">
              That Friend does the chasing, so you don&rsquo;t have to.
            </h2>
            <p className="mb-5 max-w-lg text-lg leading-relaxed text-body text-pretty">
              Someone always ends up asking three times about dates,
              deposits, and who still owes for the car. That Friend follows
              up on open decisions, reminds people what they said
              they&rsquo;d do, and closes the loop when everyone has
              answered.
            </p>
            <p className="mb-5 max-w-lg text-lg leading-relaxed text-body text-pretty">
              You stay the friend who&rsquo;s excited about the trip.
            </p>
            <p className="max-w-lg text-lg leading-relaxed text-body text-pretty">
              It works over WhatsApp too. Save the That Friend number,
              forward a coworker&rsquo;s message, and it lands back in the
              app the same way, so the nudges reach everyone whether or not
              they have the app open.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <div className="rounded-2xl border border-[#DCE6E3] bg-[#F2F7F5] p-5">
              <div className="mb-2.5 flex items-center gap-2.5">
                <span className="h-[18px] w-[18px] rounded-full bg-[#4F7A6B]" />
                <p className="font-mono text-[10.5px] tracking-[0.12em] text-[#6B7F78] uppercase">
                  WhatsApp &middot; you &rarr; that friend
                </p>
              </div>
              <p className="mb-3 text-[15.5px] leading-relaxed text-ink-soft">
                {whatsappExample.incoming}
              </p>
              <p className="border-t border-dashed border-[#CBD9D4] pt-2.5 text-[14.5px] leading-relaxed text-body">
                {whatsappExample.reply}
              </p>
            </div>
            {nudgeCards.map((card) => (
              <div
                key={card.label}
                className="rounded-2xl border border-warm-border bg-warm-bg p-5"
              >
                <p className="mb-2.5 font-mono text-[10.5px] tracking-[0.12em] text-muted uppercase">
                  {card.label}
                </p>
                <p className="text-[15.5px] leading-relaxed text-ink-soft">
                  {card.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="for" className="border-t border-border px-6 py-24 sm:px-10">
        <div className="mx-auto w-full max-w-6xl">
          <div className="mb-14 grid grid-cols-1 items-start gap-16 lg:grid-cols-[1fr_1.35fr]">
            <div>
              <p className="mb-6 font-mono text-[11.5px] tracking-[0.14em] text-muted uppercase">
                Who it&rsquo;s for
              </p>
              <h2 className="text-[46px] leading-[1.07] font-display tracking-tight text-ink">
                The trips with more than two people in them.
              </h2>
            </div>
            <p className="max-w-xl text-lg leading-relaxed text-body text-pretty">
              Two people can plan in a text thread. Five can&rsquo;t. That
              Friend is built for the trips where everyone has a different
              budget, a different week off and a different idea of a good
              time, and where the plan usually dies before anyone books.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-3">
            {forGroups.map((g) => (
              <div
                key={g.title}
                className={`p-7 pb-8 ${g.highlight ? "bg-warm-bg" : "bg-card"}`}
              >
                <h3 className="mb-2.5 text-[27px] leading-tight font-display text-ink">
                  {g.title}
                </h3>
                <p className="text-[15.5px] leading-relaxed text-body">
                  {g.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-3xl px-6 py-24 text-center sm:px-10">
        <p className="text-4xl leading-snug font-display text-ink text-balance">
          &ldquo;We&rsquo;ve talked about this trip for three years.
          We&rsquo;re actually going in June.&rdquo;
        </p>
        <p className="mt-6 font-mono text-[11.5px] tracking-[0.12em] text-muted uppercase">
          Every group has one &middot; that friend
        </p>
      </section>

      <footer className="border-t border-border px-6 py-10 sm:px-10">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 text-[13.5px] text-muted sm:flex-row">
          <span className="text-lg font-display text-ink">&ldquo;that friend&rdquo;</span>
          <div className="flex gap-6">
            <Link href="#how" className="hover:text-accent">
              How it works
            </Link>
            <Link href="#workspace" className="hover:text-accent">
              Workspace
            </Link>
            <Link href="#for" className="hover:text-accent">
              About
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
