"use client";
import { redirect } from "next/navigation";

// /home/settings redirects to /home/settings/billing (the only subpage)
export default function SettingsPage() {
  redirect("/home/settings/billing");
}
