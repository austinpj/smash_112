import "./globals.css";
import { Plus_Jakarta_Sans } from "next/font/google";
import Nav from "@/components/Nav";

const font = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font",
  display: "swap",
});

export const metadata = {
  title: "Smash",
  description: "Lift. Log. Level up. Track workouts, food and progress.",
};

// Every page shows per-user data, so render on request rather than at build time.
export const dynamic = "force-dynamic";

export const viewport = { width: "device-width", initialScale: 1, themeColor: "#07080c" };

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={font.variable}>
      <body>
        <Nav />
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
