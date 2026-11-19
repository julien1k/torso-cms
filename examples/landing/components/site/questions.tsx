import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Heading } from "./sections";
import { Px } from "./wordmark";

const questions = [
  {
    question: "What exactly can be edited?",
    answer:
      "Text written in your components, string props such as a title, text and numbers held in constant arrays and objects, strings in your translation files, Markdown and MDX content, and link URLs. That covers most of a hand-built marketing page.",
  },
  {
    question: "How does it know where a piece of text came from?",
    answer:
      "At build time each element with static text gets a short id. A manifest written during the build maps every id to a file and position, and the editor uses it to find the line to change.",
  },
  {
    question: "What happens after I press Save in production?",
    answer:
      "The change is committed to your branch in a single commit, and your host rebuilds. Until the new build is live, the editor keeps showing your saved text so nothing looks lost. If you would rather review first, pull-request mode collects saves in one pull request and nothing goes live until it is merged.",
  },
  {
    question: "Can an editor break the site?",
    answer:
      "Editors can only replace the contents of existing strings. They cannot add elements, and characters that mean something in JSX are escaped before the file is written.",
  },
  {
    question: "Does it work with Turbopack and webpack?",
    answer: "Yes. It is tested with Next.js 16 on both, using the App Router.",
  },
];

export function Questions() {
  return (
    <section id="questions" className="border-t">
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-5 py-24 sm:px-8 sm:py-32 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
        <Heading eyebrow="Questions" title={
            <>
              Things people ask <Px>first</Px>
            </>
          } className="lg:[&_h2]:text-5xl" />
        <Accordion data-reveal defaultValue={[questions[0].question]}>
          {questions.map((item) => (
            <AccordionItem key={item.question} value={item.question}>
              <AccordionTrigger>{item.question}</AccordionTrigger>
              <AccordionContent className="text-pretty leading-7 text-muted-foreground">
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
