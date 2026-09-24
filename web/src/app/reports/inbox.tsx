"use client";

import { useState, useTransition } from "react";
import { setReportStatus, type ReportRow } from "./actions";

export function ReportsInbox({ reports }: { reports: ReportRow[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (reports.length === 0) {
    return <p className="card text-stone-600">No reports yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {reports.map((report) => (
        <li key={report.id} className="card flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium">{report.target_label}</span>
            <span className="text-stone-500">{report.status}</span>
          </div>
          <p>{report.reason}</p>
          <p className="text-sm text-stone-500">
            From {report.reporter_name} · {new Date(report.created_at).toLocaleString("en-GB")}
          </p>
          {report.status === "open" && (
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-primary h-10 flex-1 text-sm"
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
                className="btn-secondary h-10 flex-1 text-sm"
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
          {error && <p className="text-sm text-red-700">{error}</p>}
        </li>
      ))}
    </ul>
  );
}
