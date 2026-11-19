import { Hero } from "@/components/site/hero";
import { RevealOnScroll } from "@/components/site/reveal";
import { Questions } from "@/components/site/questions";
import { Closing, Footer, HowItWorks, Limits, Promises, TryIt } from "@/components/site/sections";
import { Setup } from "@/components/site/setup";

export default function Home() {
  return (
    <>
      <main id="main">
        <Hero />
        <TryIt />
        <HowItWorks />
        <Promises />
        <Setup />
        <Limits />
        <Questions />
        <Closing />
      </main>
      <Footer />
      <RevealOnScroll />
    </>
  );
}
