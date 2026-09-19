import type { Metadata } from "next";
import Engine from "@/components/engine";
import "../admin/admin.css";
import "./engine.css";

export const metadata: Metadata = {
  title: "Engine Lab | Gacha Arcade",
  robots: { index: false, follow: false },
};

export default function EnginePage() {
  return <Engine />;
}
