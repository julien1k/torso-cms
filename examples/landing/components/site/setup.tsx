import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Heading, More } from "./sections";
import { Px } from "./wordmark";

const files = [
  {
    name: "next.config.ts",
    note: "Wrap the config you already have. This is the only change to existing code.",
    code: `import { withCMS } from "torso-cms";

const nextConfig = {
  // your existing config
};

export default withCMS(nextConfig);`,
  },
  {
    name: "app/edit/[[...path]]/route.ts",
    tab: "route.ts",
    note: "One new file decides where the editor lives and who may use it.",
    code: `import { createCMS } from "torso-cms/server";

export const { GET, POST } = createCMS({
  // Optional: reuse your own admin login instead of a password.
  // authorize: (request) => isAdmin(request),
});`,
  },
  {
    name: ".env",
    note: "A password for the editor, and where production saves are committed.",
    code: `CMS_PASSWORD=choose-a-long-one

CMS_GITHUB_REPO=owner/name
CMS_GITHUB_BRANCH=main
CMS_GITHUB_TOKEN=github_pat_YOUR_TOKEN_HERE`,
  },
];

export function Setup() {
  return (
    <section id="setup" className="ink">
      <div className="mx-auto grid w-full max-w-6xl px-5 py-24 sm:px-8 sm:py-32 gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
        <div>
          <Heading
            eyebrow="Setup"
            title={
              <>
                Two files and a <Px>password</Px>
              </>
            }
            lead="Install the package, wrap your config and add one route. Then open /edit on your own site."
          />
          <pre data-reveal className="mt-8 overflow-x-auto rounded-xl border bg-black/25 px-4 py-3 font-mono text-sm">
            <code translate="no">
              <span className="select-none text-mark">$ </span>pnpm add github:julien1k/torso-cms
            </code>
          </pre>
          <p data-reveal className="mt-8">
            <More href="/docs">Read the docs</More>
          </p>
        </div>
        <Tabs data-reveal defaultValue={files[0].name} className="min-w-0">
          <TabsList aria-label="Files to add">
            {files.map((file) => (
              <TabsTrigger key={file.name} value={file.name} className="font-mono text-xs">
                {"tab" in file ? file.tab : file.name}
              </TabsTrigger>
            ))}
          </TabsList>
          {files.map((file) => (
            <TabsContent key={file.name} value={file.name}>
              <p translate="no" className="mb-2 font-mono text-xs text-muted-foreground">
                {file.name}
              </p>
              <pre className="overflow-x-auto rounded-2xl border bg-black/30 p-5 font-mono text-[0.8125rem] leading-6 sm:p-6">
                <code translate="no">{file.code}</code>
              </pre>
              <p className="mt-3 text-sm text-muted-foreground">{file.note}</p>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </section>
  );
}
