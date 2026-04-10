import React from "react";
import type { Metadata } from "next";

type BaseJsonLdProps = {
  children: object;
};

function JsonLd({ children }: BaseJsonLdProps) {
  return (
    <script type="application/ld+json" suppressHydrationWarning>
      {JSON.stringify(children)}
    </script>
  );
}

type OrganizationJsonLdProps = {
  name: string;
  url: string;
  logoUrl?: string;
  description: string;
};

export function OrganizationJsonLd({ name, url, logoUrl, description }: OrganizationJsonLdProps) {
  const data = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name,
    url,
    logo: logoUrl,
    description,
  };

  return <JsonLd>{data}</JsonLd>;
}

type SoftwareApplicationJsonLdProps = {
  name: string;
  url: string;
  operatingSystem?: string;
  applicationCategory?: string;
  description: string;
  offers?: {
    price: string;
    priceCurrency: string;
  };
};

export function SoftwareApplicationJsonLd({
  name,
  url,
  operatingSystem = "Web",
  applicationCategory = "FinancialApplication",
  description,
  offers,
}: SoftwareApplicationJsonLdProps) {
  const data: any = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name,
    url,
    operatingSystem,
    applicationCategory,
    description,
  };

  if (offers) {
    data.offers = {
      "@type": "Offer",
      price: offers.price,
      priceCurrency: offers.priceCurrency,
    };
  }

  return <JsonLd>{data}</JsonLd>;
}

type FaqItem = {
  question: string;
  answer: string;
};

type FaqJsonLdProps = {
  items: FaqItem[];
};

export function FaqJsonLd({ items }: FaqJsonLdProps) {
  if (!items.length) return null;

  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  return <JsonLd>{data}</JsonLd>;
}

export const baseMarketingMetadata: Metadata = {
  title: "ExpenseTerminal — AI-powered expense tracking for self‑employed tax deductions",
  description:
    "ExpenseTerminal helps self-employed professionals and small businesses track expenses, categorize transactions, and maximize tax deductions with AI-powered workflows.",
  openGraph: {
    title: "ExpenseTerminal — AI-powered expense tracking for self‑employed tax deductions",
    description:
      "Streamlined expense review and tax deduction software for self-employed professionals and small businesses.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ExpenseTerminal — AI-powered expense tracking for self‑employed tax deductions",
    description:
      "Streamlined expense review and tax deduction software for self-employed professionals and small businesses.",
  },
};

