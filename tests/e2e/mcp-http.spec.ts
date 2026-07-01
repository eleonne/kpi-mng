import { test, expect, type APIRequestContext } from "@playwright/test";

/**
 * Covers the Streamable HTTP MCP transport (src/app/api/mcp/route.ts) — same
 * tool definitions as tests/e2e/mcp.spec.ts (stdio), different transport.
 * The MCP spec requires this exact Accept header; the server 406s otherwise.
 */
const MCP_HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json, text/event-stream",
};

async function callTool(request: APIRequestContext, name: string, args: Record<string, unknown>) {
  const res = await request.post("/api/mcp", {
    headers: MCP_HEADERS,
    data: { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } },
  });
  const body = await res.json();
  const isError = Boolean(body.result?.isError);
  const text = body.result?.content?.[0]?.text ?? "";
  return { isError, data: !isError && text ? JSON.parse(text) : undefined, raw: text };
}

test.describe("KPI MCP server (Streamable HTTP)", () => {
  test("rejects requests missing the required Accept header", async ({ request }) => {
    const res = await request.post("/api/mcp", {
      headers: { "Content-Type": "application/json" },
      data: { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "list_kpis", arguments: {} } },
    });
    expect(res.status()).toBe(406);
  });

  test("full lifecycle: create KPI, add field, activate, log a case, delete", async ({ request }) => {
    const name = `MCP HTTP Test KPI ${Date.now()}`;

    const created = await callTool(request, "create_kpi", {
      name,
      objective: "Verify the Streamable HTTP MCP transport end to end.",
      measurementType: "COUNT",
      targetValue: 3,
    });
    expect(created.isError).toBe(false);
    expect(created.data.status).toBe("DRAFT");

    const field = await callTool(request, "add_kpi_field", {
      kpiId: created.data.id,
      label: "Project Name",
      fieldType: "TEXT",
      isRequired: true,
    });
    expect(field.isError).toBe(false);
    expect(field.data.fieldKey).toBe("project_name");

    const activated = await callTool(request, "activate_kpi", { kpiId: created.data.id });
    expect(activated.isError).toBe(false);
    expect(activated.data.status).toBe("ACTIVE");

    const entry = await callTool(request, "add_kpi_case", {
      kpiId: created.data.id,
      entryDate: "2026-03-01",
      fields: { project_name: "HTTP Smoke Test" },
    });
    expect(entry.isError).toBe(false);

    const detail = await callTool(request, "get_kpi", { kpiId: created.data.id });
    expect(detail.data.summary.displayValue).toBe("1 / 3");

    await callTool(request, "delete_kpi_case", { kpiId: created.data.id, entryId: entry.data.id });
    const deleted = await callTool(request, "delete_kpi", { kpiId: created.data.id });
    expect(deleted.isError).toBe(false);

    const afterDelete = await callTool(request, "get_kpi", { kpiId: created.data.id });
    expect(afterDelete.isError).toBe(true);
  });
});
