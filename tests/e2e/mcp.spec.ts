import { test, expect } from "@playwright/test";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import path from "node:path";

interface JsonRpcResponse {
  id: number;
  result?: {
    isError?: boolean;
    content?: { type: string; text?: string }[];
  };
}

/**
 * The MCP server talks JSON-RPC over stdio, not HTTP — Playwright's
 * request/page fixtures don't apply, so this spawns it directly and speaks
 * the protocol by hand, mirroring api.spec.ts's REST coverage for the same
 * underlying lib/services/* functions.
 */
class McpClient {
  private child: ChildProcessWithoutNullStreams;
  private buffer = "";
  private pending = new Map<number, (msg: JsonRpcResponse) => void>();
  private nextId = 1;

  constructor() {
    this.child = spawn("npx", ["tsx", "mcp/server.ts"], {
      cwd: path.resolve(__dirname, "../.."),
      stdio: ["pipe", "pipe", "pipe"],
      shell: process.platform === "win32",
    });

    this.child.stdout.on("data", (chunk: Buffer) => {
      this.buffer += chunk.toString();
      const lines = this.buffer.split("\n");
      this.buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        const msg = JSON.parse(line);
        if (msg.id !== undefined) this.pending.get(msg.id)?.(msg);
      }
    });
  }

  private send(id: number, method: string, params: unknown) {
    this.child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  }

  private request(method: string, params: unknown): Promise<JsonRpcResponse> {
    const id = this.nextId++;
    return new Promise((resolve) => {
      this.pending.set(id, resolve);
      this.send(id, method, params);
    });
  }

  async initialize() {
    await this.request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "test-client", version: "0.0.1" },
    });
  }

  async callTool(name: string, args: Record<string, unknown>) {
    const response = await this.request("tools/call", { name, arguments: args });
    const isError = Boolean(response.result?.isError);
    const text = response.result?.content?.[0]?.text ?? "";
    // Error results are a plain human-readable message, not JSON — only
    // success results are serialized as JSON (see ok()/fail() in mcp/server.ts).
    return { isError, data: !isError && text ? JSON.parse(text) : undefined, raw: text };
  }

  close() {
    this.child.kill();
  }
}

test.describe("KPI MCP server", () => {
  let client: McpClient;

  test.beforeEach(async () => {
    client = new McpClient();
    await client.initialize();
  });

  test.afterEach(() => {
    client.close();
  });

  test("full lifecycle: create KPI, add field, activate, log/delete a case, delete KPI", async () => {
    const name = `MCP Test KPI ${Date.now()}`;

    const created = await client.callTool("create_kpi", {
      name,
      objective: "Verify the MCP server end to end.",
      measurementType: "COUNT",
      targetValue: 3,
    });
    expect(created.isError).toBe(false);
    expect(created.data.status).toBe("DRAFT");

    const tooEarly = await client.callTool("activate_kpi", { kpiId: created.data.id });
    expect(tooEarly.isError).toBe(true);

    const field = await client.callTool("add_kpi_field", {
      kpiId: created.data.id,
      label: "Project Name",
      fieldType: "TEXT",
      isRequired: true,
    });
    expect(field.isError).toBe(false);
    expect(field.data.fieldKey).toBe("project_name");

    const activated = await client.callTool("activate_kpi", { kpiId: created.data.id });
    expect(activated.isError).toBe(false);
    expect(activated.data.status).toBe("ACTIVE");

    const entry = await client.callTool("add_kpi_case", {
      kpiId: created.data.id,
      entryDate: "2026-03-01",
      fields: { project_name: "MCP Smoke Test" },
    });
    expect(entry.isError).toBe(false);
    expect(entry.data.fields.project_name).toBe("MCP Smoke Test");

    const detail = await client.callTool("get_kpi", { kpiId: created.data.id });
    expect(detail.data.summary.displayValue).toBe("1 / 3");

    const deleteTooEarly = await client.callTool("delete_kpi", { kpiId: created.data.id });
    expect(deleteTooEarly.isError).toBe(true);

    const deletedCase = await client.callTool("delete_kpi_case", {
      kpiId: created.data.id,
      entryId: entry.data.id,
    });
    expect(deletedCase.isError).toBe(false);

    const deletedKpi = await client.callTool("delete_kpi", { kpiId: created.data.id });
    expect(deletedKpi.isError).toBe(false);

    const afterDelete = await client.callTool("get_kpi", { kpiId: created.data.id });
    expect(afterDelete.isError).toBe(true);
  });

  test("returns an error for a duplicate KPI name", async () => {
    const name = `MCP Duplicate Test ${Date.now()}`;
    const payload = { name, objective: "x", measurementType: "COUNT", targetValue: 1 };

    const first = await client.callTool("create_kpi", payload);
    expect(first.isError).toBe(false);

    const second = await client.callTool("create_kpi", payload);
    expect(second.isError).toBe(true);

    await client.callTool("delete_kpi", { kpiId: first.data.id });
  });
});
