import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { HeroDemo } from "@/components/marketing/HeroDemo";

export const metadata: Metadata = {
  title: "That Friend | Plan the group trip that actually happens",
  description:
    "Plan group trips without the 200-message thread. Pick dates, compare stays, and plan what to do, all in one place.",
};

const forGroups = [
  {
    title: "Bachelorette weekends",
    body: "Costs are visible from the start, so nobody gets priced out.",
  },
  {
    title: "Reunion trips",
    body: "Friends in four cities answer what they can, and the plan still lands.",
  },
  {
    title: "Birthday trips",
    body: "The birthday person gets a say without having to run logistics.",
  },
  {
    title: "Family and multi-household",
    body: "Days get built around nap schedules instead of clashing with them.",
  },
  {
    title: "Remote work week",
    body: "Work hours built in, so the trip plans around standups instead of skipping them.",
  },
  {
    title: "And the one you never took",
    body: "The trip you've talked about for three years never got booked. This is the year.",
  },
];

const tripPhotos = [
  { city: "Athens", src: "/marketing/trips/athens.jpg" },
  { city: "Costa Smeralda", src: "/marketing/trips/costa-smeralda.jpg" },
  { city: "NYC", src: "/marketing/trips/nyc.jpg" },
  { city: "Santa Teresa Gallura", src: "/marketing/trips/santa-teresa-gallura.jpg" },
];

// A signed-in visitor is redirected away from here in middleware
// (src/lib/supabase/middleware.ts) before this ever renders — no auth
// check here means this page has nothing dynamic left in it and can be
// served as static, cached HTML for the (overwhelming majority) logged-out
// case instead of doing a fresh server render on every visit.
export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-canvas">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-16 max-w-[1180px] items-center gap-6.5 px-6 sm:px-8">
          <span className="flex-none text-[23px] font-display text-ink">&ldquo;that friend&rdquo;</span>
          <nav className="hidden min-w-0 flex-1 justify-end gap-5.5 text-[14.5px] text-body sm:flex">
            <a href="#demo" className="hover:text-accent">
              How it works
            </a>
            <a href="#trips" className="hover:text-accent">
              Our trips
            </a>
            <a href="#for" className="hover:text-accent">
              Who it&rsquo;s for
            </a>
          </nav>
          <div className="flex-1 sm:hidden" />
          <Link
            href="/planner/trips/new"
            className="flex-none rounded-full bg-[#8A5A7A] px-6.5 py-3 text-[16px] text-[#FFFDF9] hover:bg-[#7A4A6A]"
          >
            Start planning
          </Link>
        </div>
      </header>

      <div className="bg-canvas">
        <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-8.5 px-6 py-14 pb-21 sm:px-8">
          <div>
            <p className="mb-4 font-mono text-[15px] font-medium tracking-[0.12em] text-accent uppercase">
              For the trip that&rsquo;s been &ldquo;a maybe&rdquo; since forever.
            </p>
            <h1 className="mb-5 max-w-[16em] text-[clamp(52px,8vw,96px)] leading-[0.96] font-display tracking-tight text-ink text-pretty">
              One place to plan your group trip.
            </h1>
            <p className="mb-7.5 max-w-[34em] text-[clamp(19px,1.9vw,22px)] leading-[1.45] text-ink-soft text-pretty">
              No chasing dates. No 200-message thread. No lost itinerary.
            </p>
            <Link
              href="/planner/trips/new"
              className="inline-block rounded-full bg-[#8A5A7A] px-11 py-5 text-[20px] font-medium text-[#FFFDF9] hover:bg-[#7A4A6A]"
            >
              Start planning
            </Link>
          </div>

          <div className="flex flex-col gap-4.5 border-t border-border pt-7.5">
            <p className="font-mono text-[15px] font-medium tracking-[0.12em] text-accent uppercase">
              Try the demo
            </p>
            <h2 className="max-w-[16em] text-[clamp(30px,3.4vw,42px)] leading-[1.08] font-display tracking-tight text-ink text-pretty">
              Plan a whole trip in three decisions.
            </h2>
            <p className="max-w-[34em] text-[19px] leading-[1.55] text-body text-pretty">
              That Friend puts dates, stays, and plans in one place, so the trip finally makes it out of the chat.
            </p>
          </div>

          <HeroDemo />
        </div>
      </div>

      <section id="trips" className="border-t border-border px-6 py-16 sm:px-10">
        <div className="mx-auto w-full max-w-[1180px]">
          <p className="mb-3.5 font-mono text-[15px] font-medium tracking-[0.12em] text-accent uppercase">
            From our trips
          </p>
          <h2 className="mb-7 max-w-[16em] text-[clamp(30px,3.4vw,42px)] leading-[1.08] font-display tracking-tight text-ink text-pretty">
            Trips that made it out of the chat.
          </h2>
          <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
            {tripPhotos.map((t) => (
              <figure key={t.city} className="m-0 flex flex-col gap-3">
                <div className="relative aspect-[3/4] w-full overflow-hidden rounded-[14px]">
                  <Image
                    src={t.src}
                    alt={t.city}
                    fill
                    sizes="(min-width: 640px) 25vw, 50vw"
                    className="object-cover"
                  />
                </div>
                <figcaption className="font-display text-[24px] leading-[1.15] tracking-tight text-ink">
                  {t.city}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section id="for" className="border-t border-border px-6 py-24 sm:px-10">
        <div className="mx-auto w-full max-w-3xl">
          <p className="mb-4 font-mono text-[15px] font-medium tracking-[0.12em] text-accent uppercase">
            Who it&rsquo;s for
          </p>
          <h2 className="mb-4.5 max-w-[22em] text-[clamp(30px,3.4vw,42px)] leading-[1.08] font-display tracking-tight text-ink text-pretty">
            The trips with more than two people in them.
          </h2>
          <p className="mb-8.5 max-w-xl text-[17px] leading-relaxed text-body text-pretty">
            Two people can plan in a text thread. Five can&rsquo;t. Different
            budgets, different weeks off, different ideas of a good time,
            and a plan that usually dies before anyone books.
          </p>
          <div className="mb-9 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2">
            {forGroups.map((g) => (
              <div key={g.title} className="bg-card p-5.5 pb-6">
                <h3 className="mb-2 text-[18px] font-medium text-ink">{g.title}</h3>
                <p className="text-[16px] leading-relaxed text-body text-pretty">{g.body}</p>
              </div>
            ))}
          </div>
          <Link href="/planner/trips/new" className="inline-block rounded-full bg-[#8A5A7A] px-11 py-5 text-[20px] font-medium text-[#FFFDF9] hover:bg-[#7A4A6A]">
            Start planning
          </Link>
        </div>
      </section>

      <section className="border-t border-border bg-card px-6 py-24 text-center sm:px-10">
        <div className="mx-auto w-full max-w-3xl">
          <p className="mb-3.5 text-[clamp(26px,3.2vw,34px)] leading-[1.2] font-display text-ink text-balance">
            &ldquo;We&rsquo;ve talked about this trip for three years.
            We&rsquo;re actually going in June.&rdquo;
          </p>
          <p className="mb-7.5 font-mono text-[11px] tracking-[0.12em] text-[#8A5A7A] uppercase">
            Every group has one &middot; that friend
          </p>
          <Link
            href="/planner/trips/new"
            className="inline-block rounded-full bg-[#33253C] px-10.5 py-4.5 font-display text-[25px] text-[#FBF6EC] hover:bg-[#48334F]"
          >
            Start planning your group trip
          </Link>
        </div>
      </section>

      <footer className="border-t border-border px-6 py-10 sm:px-10">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 text-[13.5px] text-muted sm:flex-row">
          <span className="text-lg font-display text-ink">&ldquo;that friend&rdquo;</span>
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-accent">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-accent">
              Terms
            </Link>
            <a
              href="https://substack.com/@thatfriendapp"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-accent"
            >
              Substack
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
