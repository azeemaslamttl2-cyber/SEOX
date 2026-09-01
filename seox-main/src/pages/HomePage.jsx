import Hero from "../components/Hero.jsx";
import Brands from "../components/Brands.jsx";
import AuditDemo from "../components/AuditDemo.jsx";
import Stats from "../components/Stats.jsx";
import Features from "../components/Features.jsx";
import Comparison from "../components/Comparison.jsx";
import Workflow from "../components/Workflow.jsx";
import Testimonials from "../components/Testimonials.jsx";
import Pricing from "../components/Pricing.jsx";
import FAQ from "../components/FAQ.jsx";
import CTA from "../components/CTA.jsx";

export default function HomePage() {
  return (
    <>
      <Hero />
      <Brands />
      <AuditDemo />
      <Stats />
      <Features />
      <Comparison />
      <Workflow />
      <Testimonials />
      <Pricing />
      <FAQ />
      <CTA />
    </>
  );
}
