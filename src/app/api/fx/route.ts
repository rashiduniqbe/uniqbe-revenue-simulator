export const runtime = "edge";

import { NextResponse } from "next/server";
import { readFxSnapshot } from "../../../fx/store";

export async function GET(): Promise<Response> {
  const snapshot = await readFxSnapshot();
  return NextResponse.json(snapshot);
}
