import { HelpCircle } from "lucide-react";

export default function Card({ title, hint, total, action, className = "", children }) {
  return (
    <div className={`auditor-card ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <h3 className="auditor-card-title">{title}</h3>
          {hint && <HelpCircle className="auditor-card-hint h-3.5 w-3.5" />}
          {total !== undefined && (
            <span className="auditor-card-total">{total.toLocaleString()}</span>
          )}
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}
