"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** What a coding agent needs to add the editor to someone's project. */
const prompt = `Add Torso, a click-to-edit visual editor, to this Next.js App Router project. Its npm package is called torso-cms.

1. Install the package: pnpm add torso-cms
2. In next.config.ts, import { withCMS } from "torso-cms" and wrap the exported config: export default withCMS(nextConfig). Keep every existing option.
3. Create app/edit/[[...path]]/route.ts containing:
   import { createCMS } from "torso-cms/server";
   export const { GET, POST } = createCMS();
4. Add .torso to .gitignore.
5. Add CMS_PASSWORD, CMS_GITHUB_REPO, CMS_GITHUB_BRANCH and CMS_GITHUB_TOKEN to .env.example with empty values, and tell me which of them I need to set. Do not invent values.
6. Do not change any component. Start the dev server and confirm that /edit loads the site with the editor toolbar.`;

export function CopyPrompt({ className }: { className?: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const icon = "col-start-1 row-start-1 size-4 transition-[opacity,scale,filter] duration-200 ease-(--ease-out)";
  const hidden = "scale-50 opacity-0 blur-[2px]";

  return (
    <Button variant="inverse" size="lg" onClick={copy} className={cn("min-w-44", className)}>
      <span className="grid" aria-hidden="true">
        <CopyIcon className={cn(icon, copied && hidden)} />
        <CheckIcon className={cn(icon, !copied && hidden)} />
      </span>
      <span aria-live="polite">{copied ? "Copied" : "Copy prompt"}</span>
    </Button>
  );
}
