// Site-wide singletons (identity, contact, social, navigation).
// The editable data lives in site.json so the CMS can update it without code changes.
import siteData from "./site.json";

export interface NavItem {
  label: string;
  href: string;
}

export interface SiteConfig {
  name: string;
  shortName: string;
  pi: string;
  institution: string;
  university: string;
  url: string;
  description: string;
  email: string;
  phone: string;
  address: string[];
  mapQuery: string;
  social: {
    scholar?: string;
    twitter?: string;
    github?: string;
  };
  nav: NavItem[];
}

export const site: SiteConfig = siteData;