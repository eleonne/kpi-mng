import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "@/lib/errors";

export {
  serializeFieldDefinition,
  serializeEntry,
  serializeKpiListItem,
  serializeKpiDetail,
} from "@/lib/serializers";

/** Maps a thrown error to a consistent `{ error, fieldErrors? }` JSON response. */
export function errorResponse(err: unknown): NextResponse {
  if (err instanceof AppError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: "Validation failed", fieldErrors: err.flatten().fieldErrors },
      { status: 400 },
    );
  }
  console.error(err);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
