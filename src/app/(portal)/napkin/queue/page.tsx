import type { Metadata } from "next";
import { NapkinQueuePage } from "@/components/napkin-pages";

export const metadata: Metadata = { title: "Napkin Queue" };
export default function QueuePage() { return <NapkinQueuePage />; }
