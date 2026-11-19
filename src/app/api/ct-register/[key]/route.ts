import { NextResponse, type NextRequest } from "next/server";
import { insertRecord } from "@/lib/ct-actions";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;
  try {
    const body = await req.json();
    const row = await insertRecord(key, body);
    return NextResponse.json(row);
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
