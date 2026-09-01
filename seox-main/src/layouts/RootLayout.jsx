import { Outlet, useLocation } from "react-router-dom";
import { useEffect } from "react";
import Navbar from "../components/Navbar.jsx";
import Footer from "../components/Footer.jsx";

export default function RootLayout() {
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
    <div className="relative min-h-screen overflow-x-clip bg-ink-900 text-white">
      {/* Background gradients */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-40 left-1/2 h-[600px] w-[1100px] -translate-x-1/2 rounded-full bg-brand-500/20 blur-[140px]" />
        <div className="absolute top-[40%] -left-40 h-[500px] w-[500px] rounded-full bg-amber-500/10 blur-[140px]" />
        <div className="absolute top-[80%] right-0 h-[500px] w-[500px] rounded-full bg-orange-600/10 blur-[140px]" />
      </div>

      <Navbar />
      <main>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
