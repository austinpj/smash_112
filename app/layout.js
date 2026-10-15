import "./globals.css";
import { Plus_Jakarta_Sans } from "next/font/google";
import Nav from "@/components/Nav";
import AppPopups from "@/components/AppPopups";
import InstallApp from "@/components/InstallApp";
import AppLock from "@/components/AppLock";

const font = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font",
  display: "swap",
});

export const metadata = {
  title: "Smash",
  description: "Lift. Log. Level up. Track workouts, food and progress.",
  applicationName: "Smash",
  appleWebApp: { capable: true, title: "Smash", statusBarStyle: "black" },
  icons: { icon: "/pwa-icon/192", apple: "/pwa-icon/180" },
};

export const viewport = { width: "device-width", initialScale: 1, themeColor: "#07080c" };

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={font.variable}>
      <body>
        <Nav />
        <main className="container">{children}</main>
        <AppPopups />
        <InstallApp />
        <AppLock />
      </body>
    </html>
  );
}
