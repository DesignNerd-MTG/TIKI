import { NextResponse } from "next/server";
import { getIdentityAndProfile } from "@/lib/auth";
import { searchShowCities } from "@/lib/show-city-catalog";

export async function GET(request: Request) {
  const { identity, profile } = await getIdentityAndProfile();
  if (!identity || !profile?.active) return NextResponse.json({ error: "Sign in to search cities." }, { status: 401 });
  return NextResponse.json({ cities: searchShowCities(new URL(request.url).searchParams.get("q") ?? "") }, { headers: { "Cache-Control": "private, max-age=300" } });
}
