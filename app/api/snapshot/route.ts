import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const items = await prisma.netWorthSnapshot.findMany({ orderBy: { date: "asc" }, take: 90 });
  return NextResponse.json(items);
}

export async function POST(req: Request) {
  const body = await req.json();
  const item = await prisma.netWorthSnapshot.create({ data: body });
  return NextResponse.json(item, { status: 201 });
}
