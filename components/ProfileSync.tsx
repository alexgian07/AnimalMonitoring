"use client";
import { useEffect } from "react";

export default function ProfileSync() {
  useEffect(() => {
    fetch("/api/profile/sync", { method: "POST" }).catch(() => {});
  }, []);
  return null;
}
