import { Clock } from "lucide-react";

export function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <div className="placeholder-page">
      <Clock size={48} strokeWidth={1} style={{ color: "#94a3b8" }} />
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}
