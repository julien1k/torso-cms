import { Hero } from "@/components/site/hero";
import { RevealOnScroll } from "@/components/site/reveal";
import { Questions } from "@/components/site/questions";
import { Closing, Footer, HowItWorks, Limits, Promises, TryIt } from "@/components/site/sections";
import { Setup } from "@/components/site/setup";
import { repositoryUrl, siteUrl } from "@/lib/site";

/** What the site is about, in the form search engines and agents read. Torso is free. */
const structuredData = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Torso",
  alternateName: "torso-cms",
  description:
    "A visual editor for Next.js with no head, no backend and no schema. Click the words on your site and they change in your code.",
  url: siteUrl,
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Node.js 22.12 or newer",
  license: "https://opensource.org/license/mit",
  isAccessibleForFree: true,
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  author: { "@type": "Person", name: "Julien Kollmann", url: "https://github.com/julien1k" },
  sameAs: [repositoryUrl],
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
      />
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
