/**
 * Primary sidebar nav and mobile tab bar (Home, Accounts, Rules).
 * Preferences and per-user pages live in the desktop sidebar and the mobile menu sheet.
 */
export type SidebarNavItem = {
  href: string;
  label: string;
  icon: string;
  external?: boolean;
  trailingIcon?: string;
};

export const SIDEBAR_MAIN_NAV: readonly SidebarNavItem[] = [
  { href: "/dashboard", label: "Home", icon: "home" },
  { href: "/data-sources", label: "Accounts", icon: "database" },
  { href: "/rules", label: "Rules", icon: "rule" },
] as const;

export const SIDEBAR_BOTTOM_NAV: readonly SidebarNavItem[] = [
  { href: "/preferences/org", label: "Preferences", icon: "tune" },
] as const;

export const SIDEBAR_EXTERNAL_NAV: readonly SidebarNavItem[] = [
  {
    href: "https://expense-terminal-staging.vercel.app/",
    label: "Old Site",
    icon: "public",
    external: true,
    trailingIcon: "arrow_outward",
  },
] as const;
