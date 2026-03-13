"use client";

import Image from "next/image";
import Link from "next/link";

interface AuthLayoutProps {
  children: React.ReactNode;
  isLoading?: boolean;
}

export function AuthLayout({ children, isLoading = false }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen">
      {/* Left half — high-res background image */}
      <div className="hidden lg:block lg:w-1/2 fixed left-0 top-0 h-screen overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src="/auth-sidebar-bg-v2.png"
            alt=""
            fill
            className="object-cover object-center"
            priority
            quality={100}
            sizes="50vw"
          />
        </div>
        <div className="absolute inset-0 flex items-end p-12">
          <div className="text-white drop-shadow-[0_4px_10px_rgba(0,0,0,0.55)]">
            <p className="font-display text-2xl md:text-3xl leading-snug mb-3 font-medium">
              Track every deduction.<br />
              File with confidence.
            </p>
            <p className="text-sm md:text-base">
              AI-powered expense tracking for small businesses
            </p>
          </div>
        </div>
      </div>

      {/* Right half — form area */}
      <div
        className="auth-shell flex-1 flex flex-col min-h-screen overflow-y-auto lg:ml-[50%] min-w-0"
        style={{ backgroundColor: "#FFFFFF" }}
      >
        <div className="flex-1 flex flex-col items-center justify-center px-6 sm:px-12 py-12 pb-28">
          {/* Logo / loader spinner */}
          {isLoading && (
            <div className="mb-8">
              <svg
                className="w-12 h-12 text-mono-light animate-spin-slow"
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

          {/* XT logo — link to home (larger for visibility) */}
          <Link href="/" className="mb-6 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-accent-sage/50 rounded">
            <Image
              src="/xt-logo-v2.png"
              alt="XT"
              width={160}
              height={64}
              className="h-16 w-auto object-contain"
              priority
            />
          </Link>

          {/* Form content — no header on login/signup */}
          <div className="w-full max-w-[420px] min-w-0 mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
