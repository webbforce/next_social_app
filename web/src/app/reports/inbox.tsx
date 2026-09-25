"use client";

import { useMemo, useState, useTransition } from "react";
import { setReportStatus, type ReportRow } from "./actions";

type Filter = "all" | ReportRow["status"];

const FILTERS: { id: Filter; label: string }[] = [
  { id: "open", label: "Open" },
  { id: "actioned", label: "Actioned" },
  { id: "dismissed", label: "Dismissed" },
  { id: "all", label: "All" },
];

const STATUS_STYLE: Record<ReportRow["status"], string> = {
  open: "bg-stone-200 text-ink",
  actioned: "bg-up text-ink",
  dismissed: "bg-stone-200 text-stone-600",
};

export function ReportsInbox({ reports }: { reports: ReportRow[] }) {
  const [filter, setFilter] = useState<Filter>("open");
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const counts = useMemo(() => {
    const tally = { all: reports.length, open: 0, actioned: 0, dismissed: 0 };
    for (const report of reports) tally[report.status] += 1;
    return tally;
  }, [reports]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return reports.filter((report) => {
      if (filter !== "all" && report.status !== filter) return false;
      if (!needle) return true;
      return [report.target_label, report.reason, report.reporter_name].some((value) =>
        value.toLowerCase().includes(needle),
      );
    });
  }, [reports, filter, query]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter reports">
          {FILTERS.map((item) => {
            const selected = filter === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setFilter(item.id)}
                className={`h-10 rounded-full border px-4 text-sm font-medium ${
                  selected ? "border-ink bg-ink text-paper" : "border-stone-300 bg-white"
                }`}
              >
                {item.label}
                <span className={selected ? "text-stone-300" : "text-stone-500"}> {counts[item.id]}</span>
              </button>
            );
          })}
        </div>
        <input
          className="input lg:max-w-xs"
          type="search"
          placeholder="Search reason, person, or plan"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search reports"
        />
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      {reports.length === 0 ? (
        <p className="card text-stone-600">No reports yet.</p>
      ) : visible.length === 0 ? (
        <p className="card text-stone-600">Nothing in this view. Try another filter or clear the search.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((report) => (
            <li key={report.id} className="card flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold">{report.target_label}</p>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[report.status]}`}>
                  {report.status}
                </span>
              </div>
              <p className="flex-1 text-stone-800">{report.reason}</p>
              <p className="text-sm text-stone-500">
                From {report.reporter_name}
                <span className="text-stone-400"> · </span>
                {new Date(report.created_at).toLocaleString("en-GB")}
              </p>
              {report.status === "open" && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className="btn-primary h-10 text-sm"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const result = await setReportStatus(report.id, "actioned");
                        setError(result.error);
                      })
                    }
                  >
                    Actioned
                  </button>
                  <button
                    type="button"
                    className="btn-secondary h-10 text-sm"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const result = await setReportStatus(report.id, "dismissed");
                        setError(result.error);
                      })
                    }
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
