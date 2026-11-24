/** Where the site lives. On Vercel this follows the project's production domain. */
export const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3210";

export const repositoryUrl = "https://github.com/julien1k/torso-cms";
export const packageUrl = "https://www.npmjs.com/package/torso-cms";
