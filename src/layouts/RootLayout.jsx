import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import Navbar from "../components/Navbar.jsx";
import Footer from "../components/Footer.jsx";
import RouteOutlet from "../components/RouteOutlet.jsx";

export default function RootLayout({ children }) {
  const { pathname, hash } = useLocation();

  // On route change scroll to top, unless there's a hash (anchor) — then scroll to it.
  useEffect(() => {
    if (hash) {
      const el = document.querySelector(hash);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
    }
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname, hash]);

  return (
    <div className="landing relative min-h-[100dvh] overflow-x-clip">
      {/* Background gradients */}
      <div class="auth-atmosphere pointer-events-none absolute inset-0">
        <div class="auth-grid"></div>
      </div>

      <Navbar />
      <main>
        {children || <RouteOutlet />}
      </main>
      <Footer />
    </div>
  );
}
