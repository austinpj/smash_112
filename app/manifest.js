// Tells phones how to install Smash as an app (name, icon, colours, full-screen).
export default function manifest() {
  return {
    name: "Smash",
    short_name: "Smash",
    description: "Lift. Log. Level up. Track workouts, food and progress.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#07080c",
    theme_color: "#07080c",
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
