import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatWeight(kg: number | null) {
  if (kg === null) return "—";
  return `${kg.toFixed(2)} kg`;
}

export function formatTemp(c: number | null) {
  if (c === null) return "—";
  return `${c.toFixed(1)} °C`;
}

export function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
