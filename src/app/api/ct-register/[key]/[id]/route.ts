import { NextResponse, type NextRequest } from "next/server";
import { updateRecord, softDeleteRecord } from "@/lib/ct-actions";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ key: string; id: string }> },
) {
  const { key, id } = await params;
  try {
    const body = await req.json();
    const row = await updateRecord(key, id, body);
    return NextResponse.json(row);
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ key: string; id: string }> },
) {
  const { key, id } = await params;
  try {
    const row = await softDeleteRecord(key, id);
    return NextResponse.json(row);
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
