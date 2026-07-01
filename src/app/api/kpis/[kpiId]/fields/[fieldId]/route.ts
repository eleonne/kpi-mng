import { NextRequest, NextResponse } from "next/server";
import { errorResponse, serializeFieldDefinition } from "@/lib/api-utils";
import {
  deactivateFieldDefinitionRecord,
  deleteFieldDefinitionRecord,
} from "@/lib/services/field-definition-service";
import { AppError } from "@/lib/errors";

/**
 * PATCH /api/kpis/:kpiId/fields/:fieldId — the only supported patch is
 * `{ "isActive": false }` (deactivate). Field type, key, and other
 * attributes are immutable once created — see docs/business-rules.md §2.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ kpiId: string; fieldId: string }> },
) {
  try {
    const { kpiId, fieldId } = await params;
    const body = await request.json();

    if (body.isActive !== false) {
      throw new AppError('Only { "isActive": false } is supported — fields cannot be reactivated or otherwise edited.', 400);
    }

    const field = await deactivateFieldDefinitionRecord(kpiId, fieldId);
    return NextResponse.json(serializeFieldDefinition(field));
  } catch (err) {
    return errorResponse(err);
  }
}

/** DELETE /api/kpis/:kpiId/fields/:fieldId — only if no case has a value for it (else 409; deactivate instead). */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ kpiId: string; fieldId: string }> },
) {
  try {
    const { kpiId, fieldId } = await params;
    await deleteFieldDefinitionRecord(kpiId, fieldId);
    return NextResponse.json({ success: true });
  } catch (err) {
    return errorResponse(err);
  }
}
