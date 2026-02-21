"use client";

import Link from "next/link";
import Image from "next/image";

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
            src="/auth-panel-bg.png"
            alt=""
            fill
            className="object-cover object-center"
            priority
            quality={100}
            unoptimized
            sizes="50vw"
          />
        </div>
        <div className="absolute inset-0 flex items-end p-12">
          <div>
            <p className="text-mono-dark font-display text-2xl md:text-3xl leading-snug mb-3 font-medium">
              Track every deduction.<br />
              File with confidence.
            </p>
            <p className="text-white text-sm md:text-base">
              AI-powered expense tracking for small businesses
            </p>
          </div>
        </div>
      </div>

      {/* Right half — form area */}
      <div className="flex-1 flex flex-col bg-bg-secondary min-h-screen overflow-y-auto lg:ml-[50%]">
        <div className="flex-1 flex flex-col items-center justify-center px-6 sm:px-12 py-12">
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

          {/* App name — link to landing */}
          <h1 className="font-display text-2xl text-mono-dark mb-1 tracking-tight">
            <Link href="/" className="hover:opacity-80 transition-opacity">
              ExpenseTerminal
            </Link>
          </h1>

          {/* Form content */}
          <div className="w-full max-w-[420px] mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
