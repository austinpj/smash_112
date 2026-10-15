"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const LINKS = [
  ["/", "Home"],
  ["/workouts", "Workouts"],
  ["/progress", "Progress"],
  ["/food", "Food"],
  ["/exercises", "Exercises"],
  ["/profile", "Profile"],
];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  if (pathname.startsWith("/login")) return null;

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <nav className="top">
      <div className="inner">
        <span className="brand">Smash</span>
        {LINKS.map(([href, label]) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link key={href} href={href} className={"link" + (active ? " active" : "")}>
              {label}
            </Link>
          );
        })}
        <span className="spacer" />
        <button className="btn secondary sm" onClick={signOut}>Sign out</button>
      </div>
    </nav>
  );
}
