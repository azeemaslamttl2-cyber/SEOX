import { AlertTriangle, AlertCircle, Info, Zap } from "lucide-react";

const map = {
  error: { Icon: AlertTriangle, color: "text-rose-400" },
  warning: { Icon: AlertCircle, color: "text-amber-400" },
  notice: { Icon: Info, color: "text-sky-400" },
};

export default function SeverityIcon({ severity = "notice", fixable, className = "" }) {
  const { Icon, color } = map[severity] || map.notice;
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <Icon className={`h-4 w-4 flex-shrink-0 ${color}`} />
      {fixable && <Zap className="h-3 w-3 text-brand-400" title="Auto-fixable" />}
    </span>
  );
}
