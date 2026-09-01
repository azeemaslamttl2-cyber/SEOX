import { motion, useInView, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect, useRef } from "react";
import { TrendingUp, Users, Globe, Award } from "lucide-react";

const stats = [
  { icon: Users, label: "Active Marketers", value: 18500, suffix: "+", color: "text-brand-300" },
  { icon: Globe, label: "Sites Audited", value: 4200000, suffix: "+", color: "text-emerald-300" },
  { icon: TrendingUp, label: "Avg Traffic Lift", value: 312, suffix: "%", color: "text-teal-300" },
  { icon: Award, label: "Industry Awards", value: 27, suffix: "", color: "text-cyan-300" },
];

function formatNumber(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return Math.round(n).toString();
}

function Counter({ to }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const motionValue = useMotionValue(0);
  const display = useTransform(motionValue, (v) => formatNumber(v));

  useEffect(() => {
    if (inView) {
      const controls = animate(motionValue, to, { duration: 2, ease: "easeOut" });
      return controls.stop;
    }
  }, [inView, to, motionValue]);

  return (
    <motion.span ref={ref}>
      <motion.span>{display}</motion.span>
    </motion.span>
  );
}

export default function Stats() {
  return (
    <section className="py-16 sm:py-20">
      <div className="container-px">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="feature-card text-center">
                <Icon className={`mx-auto mb-3 h-7 w-7 ${s.color}`} />
                <div className="font-display text-3xl font-bold sm:text-4xl">
                  <Counter to={s.value} />
                  {s.suffix}
                </div>
                <div className="mt-1 text-sm text-white/50">{s.label}</div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
