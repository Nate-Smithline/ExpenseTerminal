import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Welcome | XT",
  openGraph: { title: "Welcome | XT" },
  twitter: { title: "Welcome | XT" },
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
