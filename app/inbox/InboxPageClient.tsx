"use client";

import { useEffect, useState } from "react";
import type { Database } from "@/lib/types/database";
import { createSupabaseClient } from "@/lib/supabase/client";
import { UploadModal } from "@/components/UploadModal";
import { TransactionCard } from "@/components/TransactionCard";

type Transaction = Database["public"]["Tables"]["transactions"]["Row"];

interface InboxPageClientProps {
  initialYear: number;
  initialPendingCount: number;
  initialTransactions: Transaction[];
  userId: string;
}

export function InboxPageClient({
  initialYear,
  initialPendingCount,
  initialTransactions,
  userId,
}: InboxPageClientProps) {
  const supabase = createSupabaseClient();
  const [selectedYear, setSelectedYear] = useState(initialYear);
  const [pendingCount, setPendingCount] = useState(initialPendingCount);
  const [transactions, setTransactions] =
    useState<Transaction[]>(initialTransactions);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Subscribe to real-time updates for inbox count
  useEffect(() => {
    const channel = supabase
      .channel("inbox-updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "transactions",
          filter: `user_id=eq.${userId}`,
        },
        async () => {
          const { count } = await supabase
            .from("transactions")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId)
            .eq("tax_year", selectedYear)
            .eq("status", "pending");
          setPendingCount(count ?? 0);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, userId, selectedYear]);

  // Reload transactions when year changes
  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", userId)
        .eq("tax_year", selectedYear)
        .eq("status", "pending")
        .order("date", { ascending: false })
        .limit(20);
      setTransactions(data ?? []);
      setLoading(false);
    }
    load();
  }, [selectedYear, supabase, userId]);

  function handleYearChange(year: number) {
    setSelectedYear(year);
  }

  async function handleSave(
    id: string,
    update: {
      quick_label?: string;
      business_purpose?: string;
      notes?: string;
      status?: "completed" | "personal";
    }
  ) {
    await supabase
      .from("transactions")
      .update({
        quick_label: update.quick_label,
        business_purpose: update.business_purpose,
        notes: update.notes,
        status: update.status ?? "completed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", userId);

    setTransactions((prev) => prev.filter((t) => t.id !== id));
    setPendingCount((prev) => Math.max(prev - 1, 0));
  }

  async function handleMarkPersonal(id: string) {
    await handleSave(id, { status: "personal" });
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-3xl font-bold text-mono-dark mb-2">Inbox</h1>
          <p className="text-mono-medium text-sm">
            {pendingCount} transactions need review
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-mono-medium">Tax Year:</span>
            <select
              value={selectedYear}
              onChange={(e) => handleYearChange(parseInt(e.target.value, 10))}
              className="bg-white border border-bg-tertiary rounded-md px-3 py-1.5 text-sm"
            >
              <option value={selectedYear}>{selectedYear}</option>
              <option value={selectedYear - 1}>{selectedYear - 1}</option>
              <option value={selectedYear - 2}>{selectedYear - 2}</option>
            </select>
          </div>
          <button
            className="btn-primary text-sm"
            onClick={() => setUploadOpen(true)}
          >
            📤 Upload CSV
          </button>
        </div>
      </div>

      {/* Action items (static for now) */}
      <section className="bg-white rounded-lg shadow-sm p-6 mb-8">
        <h2 className="text-lg font-semibold text-mono-dark mb-4">
          🔔 Action Items (2)
        </h2>
        <div className="space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <p className="font-medium text-mono-dark">
                📧 Verify your email address
              </p>
              <p className="text-sm text-mono-medium mt-1">
                We sent a verification link to your email.
              </p>
            </div>
            <div className="flex gap-2">
              <button className="btn-secondary text-sm px-4 py-2">
                Resend Email
              </button>
              <button className="btn-primary text-sm px-4 py-2">
                Mark as Done
              </button>
            </div>
          </div>

          <div className="flex justify-between items-start">
            <div>
              <p className="font-medium text-mono-dark">
                ⚠️ Complete your business profile
              </p>
              <p className="text-sm text-mono-medium mt-1">
                Add your business name and entity type for accurate tax
                calculations.
              </p>
            </div>
            <button className="btn-primary text-sm px-4 py-2">
              Complete Profile
            </button>
          </div>
        </div>
      </section>

      {/* Transactions list */}
      <section className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-mono-dark">
            Transactions to Review ({pendingCount})
          </h2>
          <div className="flex gap-2 text-sm">
            <button className="btn-secondary px-3 py-1.5">Filters ▼</button>
            <button className="btn-secondary px-3 py-1.5">Sort</button>
          </div>
        </div>

        {loading && (
          <p className="text-sm text-mono-medium">Loading transactions…</p>
        )}

        {!loading && transactions.length === 0 && (
          <p className="text-sm text-mono-medium">
            Once you upload a CSV or connect your data, your transactions will
            appear here in an inbox-style workflow.
          </p>
        )}

        <div className="mt-4 space-y-4">
          {transactions.map((t) => (
            <TransactionCard
              key={t.id}
              transaction={t}
              onSave={async (data) =>
                handleSave(t.id, {
                  quick_label: data.quick_label,
                  business_purpose: data.business_purpose,
                  notes: data.notes,
                  status: "completed",
                })
              }
              onMarkPersonal={async () => handleMarkPersonal(t.id)}
            />
          ))}
        </div>
      </section>

      {uploadOpen && (
        <UploadModal
          onClose={() => setUploadOpen(false)}
          onCompleted={async () => {
            // Reload transactions after import
            const { data } = await supabase
              .from("transactions")
              .select("*")
              .eq("user_id", userId)
              .eq("tax_year", selectedYear)
              .eq("status", "pending")
              .order("date", { ascending: false })
              .limit(20);
            setTransactions(data ?? []);
          }}
        />
      )}
    </div>
  );
}

