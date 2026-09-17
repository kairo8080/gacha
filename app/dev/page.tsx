import type { Metadata } from "next";
import Arcade from "@/components/arcade";
import DevInspector from "@/components/dev-inspector";
import "./dev.css";

export const metadata: Metadata = {
  title: "Gacha Arcade — UI map",
  robots: { index: false, follow: false },
};

export default function DevPage() {
  return (
    <DevInspector>
      <Arcade />
    </DevInspector>
  );
}
