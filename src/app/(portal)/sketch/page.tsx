import type { Metadata } from "next";
import { SketchPad } from "@/components/sketch-pad";
import { PageHeader } from "@/components/ui";
import { requireActiveProfile } from "@/lib/auth";
export const metadata:Metadata={title:"Sketch"};
export default async function SketchPage(){await requireActiveProfile();return <div className="page-stack sketch-page"><PageHeader eyebrow="Quick field tool" title="T.I.K.I. Sketch" description="Draw with one Sharpie-like stroke, erase, undo, clear, and save a black-background PNG to this device."/><SketchPad/></div>}
