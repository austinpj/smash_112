"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const I = {
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  dumbbell: <path d="M6 7v10M3 9.5v5M18 7v10M21 9.5v5M6 12h12" />,
  chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  food: <path d="M7 3v8a2 2 0 0 1-4 0V3M5 11v10M17 3c-2 0-3 3-3 6s1 4 3 4v8" />,
  list: <path d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01" />,
  user: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-8 9a8 8 0 0 1 16 0" />,
  drop: <path d="M12 2.7S5 10.3 5 15a7 7 0 0 0 14 0c0-4.7-7-12.3-7-12.3z" />,
};

// [link, label, icon, short label for the phone tab bar]
const LINKS = [
  ["/", "Home", "home", "Home"],
  ["/workouts", "Workouts", "dumbbell", "Gym"],
  ["/progress", "Progress", "chart", "Progress"],
  ["/food", "Food", "food", "Food"],
  ["/water", "Water", "drop", "Water"],
  ["/exercises", "Exercises", "list", "Library"],
  ["/profile", "Profile", "user", "Me"],
];

function Icon({ name }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {I[name]}
    </svg>
  );
}

// A row of tabs with a highlight that slides to whichever tab is active
function Tabs({ className, pathname }) {
  const wrap = useRef(null);
  const [style, setStyle] = useState({ opacity: 0 });

  const activeIndex = LINKS.findIndex(([href]) => (href === "/" ? pathname === "/" : pathname.startsWith(href)));

  const measure = useCallback(() => {
    const el = wrap.current?.querySelectorAll(".tab")[activeIndex];
    if (!el) return setStyle({ opacity: 0 });
    setStyle({ width: el.offsetWidth, transform: `translateX(${el.offsetLeft}px)`, opacity: 1 });
  }, [activeIndex]);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  return (
    <div className={className} ref={wrap}>
      <span className="tab-indicator" style={style} />
      {LINKS.map(([href, label, icon, short], i) => (
        <Link key={href} href={href} className={"tab" + (i === activeIndex ? " active" : "")}>
          <Icon name={icon} />
          <span>{className === "bottom-tabs" ? short : label}</span>
        </Link>
      ))}
    </div>
  );
}

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (pathname.startsWith("/login")) return null;

  return (
    <>
      <nav className="top">
        <div className="inner">
          <Link href="/" className="brand">
            <span className="brand-mark">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
                <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
              </svg>
            </span>
            Smash
          </Link>
          <Tabs className="tabs" pathname={pathname} />
          <span className="spacer" />
          <button className="btn secondary sm" onClick={signOut}>Sign out</button>
        </div>
      </nav>
      <Tabs className="bottom-tabs" pathname={pathname} />
    </>
  );
}
