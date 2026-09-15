import Link from "next/link";
import { redirect } from "next/navigation";
import { getPlannerUser } from "@/lib/planner/session";
import { HeroDemo } from "@/components/marketing/HeroDemo";

const forGroups = [
  {
    title: "Bachelorette weekends",
    body: "Eight people, one bride, six different budgets. Costs are visible from the start, so nobody gets priced out or stuck footing the bill.",
    accent: "#8A5A7A",
  },
  {
    title: "Reunion trips",
    body: "College friends now live in four different cities. Everyone answers what they can, and the plan still lands close enough to work for the group.",
    accent: "#6E5A7A",
  },
  {
    title: "Birthday trips",
    body: "One person's celebration, everyone else's spending. The birthday person gets say on the things that matter and doesn't have to run logistics.",
    accent: "#A9709A",
    titleColor: "#7A5A6E",
  },
  {
    title: "Family and multi-household",
    body: "Two families, different nap schedules, one house. Days get built around the constraints instead of clashing under them.",
    accent: "#7A5A6E",
  },
  {
    title: "Remote work week",
    body: "One destination, real work hours built in. That Friend blocks out who's got a 9am standup and who needs a quiet morning, and plans the actual trip around it, not instead of it.",
    accent: "#5E5A6E",
  },
  {
    title: "And the one you never took",
    body: "The trip you've talked about for three years never got submitted. This is the year That Friend is ready for it.",
    accent: "#9A7A8E",
    titleColor: "#7A5A6E",
  },
];

export default async function Home() {
  const plannerUser = await getPlannerUser();
  if (plannerUser) redirect("/planner/home");

  return (
    <div className="flex flex-1 flex-col bg-canvas">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-16 max-w-[1180px] items-center gap-6.5 px-6 sm:px-8">
          <span className="flex-none text-[23px] font-display text-ink">&ldquo;that friend&rdquo;</span>
          <nav className="hidden min-w-0 flex-1 justify-end gap-5.5 text-[14.5px] text-body sm:flex">
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

      <div className="bg-[#33253C]">
        <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-8.5 px-6 py-14 pb-21 sm:px-8">
          <div>
            <p className="mb-4 font-display text-[clamp(21px,2.1vw,26px)] leading-[1.25] text-[#D8AEC8] italic">
              For the trip that&rsquo;s been &ldquo;a maybe&rdquo; since forever.
            </p>
            <h1 className="mb-5 text-[clamp(40px,4.6vw,60px)] leading-[1.02] font-display tracking-tight text-[#FBF6EC] text-balance">
              One platform for every group travel need.
            </h1>
            <p className="max-w-[32em] text-[18.5px] leading-relaxed text-[#E0D2DC] text-pretty">
              If you travel in groups, you know it&rsquo;s almost impossible to
              coordinate everything across 947362 messages. That Friend
              streamlines the process, so the trip can finally make it out of
              the chat.
            </p>
          </div>

          <HeroDemo />
        </div>
      </div>

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
              Two people can plan in a text thread. Five can&rsquo;t. Different
              budgets, different weeks off, different ideas of a good time,
              and a plan that usually dies before anyone books.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-3">
            {forGroups.map((g) => (
              <div
                key={g.title}
                className="border-t-2 bg-card p-7 pb-8"
                style={{ borderTopColor: g.accent }}
              >
                <h3
                  className="mb-2.5 text-[27px] leading-tight font-display"
                  style={{ color: g.titleColor ?? g.accent }}
                >
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
            <Link href="#for" className="hover:text-accent">
              Who it&rsquo;s for
            </Link>
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
