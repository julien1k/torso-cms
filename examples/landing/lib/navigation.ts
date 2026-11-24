/** The site's pages, shared by the hero, the header on inner pages, and the footer. */
export const pages = [
  { label: "How it works", href: "/how-it-works" },
  { label: "Demos", href: "/demos" },
  { label: "Docs", href: "/docs" },
];

/** Linked from the footer and from the limits section, not from the main navigation. */
export const statusPage = { label: "Status and limits", href: "/status" };

/** Who is behind the site and how it treats visitors. Linked from the footer. */
export const aboutPages = [
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
  { label: "Privacy", href: "/privacy" },
  { label: "Impressum", href: "/impressum" },
];

/** Every page of the site, for the sitemap and for the Markdown version of each page. */
export const allPages = [{ label: "Home", href: "/" }, ...pages, statusPage, ...aboutPages];
