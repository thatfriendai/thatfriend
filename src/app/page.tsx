import Link from "next/link";
import { redirect } from "next/navigation";
import { getPlannerUser } from "@/lib/planner/session";
import { SiteNav } from "@/components/SiteNav";
import { HeroDemo } from "@/components/marketing/HeroDemo";

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
  if (plannerUser) redirect("/planner/home");

  return (
    <div className="flex flex-1 flex-col bg-canvas">
      <SiteNav />

      <section className="mx-auto flex w-full max-w-[900px] flex-col gap-7.5 px-6 py-13.5 pb-19 sm:px-8">
        <div>
          <p className="mb-3.5 text-[14.5px] text-muted">
            For the trip that&rsquo;s been &ldquo;a maybe&rdquo; since forever.
          </p>
          <h1 className="mb-5 text-[40px] leading-[1.02] font-display tracking-tight text-ink text-balance sm:text-[60px]">
            The group trip that makes it out of the chat.
          </h1>
          <p className="max-w-[30em] text-[18.5px] leading-relaxed text-body text-pretty">
            Everyone&rsquo;s dates, budget, and one must-do go in. A real plan
            comes out. No 200-message group chat.
          </p>
        </div>

        <HeroDemo />
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
