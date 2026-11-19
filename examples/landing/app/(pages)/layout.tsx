import { RevealOnScroll } from "@/components/site/reveal";
import { Footer } from "@/components/site/sections";
import { SiteHeader } from "@/components/site/site-header";

export default function PagesLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer />
      <RevealOnScroll />
    </>
  );
}
