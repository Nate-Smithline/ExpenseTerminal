"use client";

import Image from "next/image";
import Link from "next/link";

interface AuthLayoutProps {
  children: React.ReactNode;
  isLoading?: boolean;
  /** Override default `max-w-[420px]` for wider flows (e.g. signup wizard). */
  contentClassName?: string;
  /** When false, hides the XT mark above the form (e.g. signup). */
  showLogo?: boolean;
}

const AUTH_SIDEBAR_IMAGE = "/auth-sidebar-green-hills.png";

export function AuthLayout({
  children,
  isLoading = false,
  contentClassName,
  showLogo = true,
}: AuthLayoutProps) {
  const contentTopSpacer = isLoading || showLogo ? "mt-4" : "mt-0";

  return (
    <div className="flex min-h-screen">
      <div className="hidden lg:block lg:w-1/2 fixed left-0 top-0 h-screen overflow-hidden bg-black">
        <div className="absolute inset-0" aria-hidden>
          <Image
            src={AUTH_SIDEBAR_IMAGE}
            alt=""
            fill
            className="object-cover object-center"
            priority
            quality={95}
            sizes="50vw"
          />
        </div>
      </div>

      <div
        className="auth-shell flex-1 flex flex-col min-h-screen overflow-y-auto lg:ml-[50%] min-w-0"
        style={{ backgroundColor: "#FFFFFF" }}
      >
        <div className="flex-1 flex flex-col items-center justify-center px-6 sm:px-12 py-12 pb-28">
          {isLoading && (
            <div className="mb-8">
              <svg
                className="w-12 h-12 text-brand-dark-gray animate-spin-slow"
                viewBox="0 0 50 50"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                {Array.from({ length: 12 }).map((_, i) => {
                  const angle = i * 30;
                  const opacity = 0.15 + (i / 12) * 0.85;
                  const x1 = 25 + 14 * Math.cos((angle * Math.PI) / 180);
                  const y1 = 25 + 14 * Math.sin((angle * Math.PI) / 180);
                  const x2 = 25 + 20 * Math.cos((angle * Math.PI) / 180);
                  const y2 = 25 + 20 * Math.sin((angle * Math.PI) / 180);
                  return (
                    <line
                      key={i}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      opacity={opacity}
                    />
                  );
                })}
              </svg>
            </div>
          )}

          {showLogo && !isLoading && (
            <Link
              href="/"
              className="mb-4 flex shrink-0 items-center justify-center rounded-[var(--radius-lg)] focus:outline-none focus:ring-2 focus:ring-brand-blue/40"
            >
              <Image
                src="/xt-logo-brand.png"
                alt="XT"
                width={72}
                height={52}
                className="h-8 w-auto object-contain"
                priority
              />
            </Link>
          )}

          <div className={`w-full min-w-0 ${contentTopSpacer} ${contentClassName ?? "max-w-[420px]"}`}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
