import { test, expect } from "@playwright/test";

test.describe("KPI REST API", () => {
  test("full lifecycle: create KPI, add field, activate, log/update/delete a case, delete KPI", async ({
    request,
  }) => {
    const name = `API Test KPI ${Date.now()}`;

    const create = await request.post("/api/kpis", {
      data: { name, objective: "Verify the API end to end.", measurementType: "COUNT", targetValue: 3 },
    });
    expect(create.status()).toBe(201);
    const kpi = await create.json();
    expect(kpi.status).toBe("DRAFT");
    expect(kpi.summary.displayValue).toBe("0 / 3");

    // Can't activate yet — no fields.
    const activateTooEarly = await request.post(`/api/kpis/${kpi.id}/activate`);
    expect(activateTooEarly.status()).toBe(422);

    const addField = await request.post(`/api/kpis/${kpi.id}/fields`, {
      data: { label: "Project Name", fieldType: "TEXT", isRequired: true },
    });
    expect(addField.status()).toBe(201);
    const field = await addField.json();
    expect(field.fieldKey).toBe("project_name");

    const activate = await request.post(`/api/kpis/${kpi.id}/activate`);
    expect(activate.status()).toBe(200);
    expect((await activate.json()).status).toBe("ACTIVE");

    const addEntry = await request.post(`/api/kpis/${kpi.id}/entries`, {
      data: { entryDate: "2026-01-15", fields: { project_name: "Invoice Automation" } },
    });
    expect(addEntry.status()).toBe(201);
    const entry = await addEntry.json();
    expect(entry.fields.project_name).toBe("Invoice Automation");
    expect(entry.countsTowardTarget).toBe(true);

    const detail = await request.get(`/api/kpis/${kpi.id}`);
    expect((await detail.json()).summary.displayValue).toBe("1 / 3");

    const updateEntry = await request.patch(`/api/kpis/${kpi.id}/entries/${entry.id}`, {
      data: { fields: { project_name: "Invoice Automation v2" } },
    });
    expect(updateEntry.status()).toBe(200);
    expect((await updateEntry.json()).fields.project_name).toBe("Invoice Automation v2");

    // Can't delete the KPI while it has a case logged.
    const deleteTooEarly = await request.delete(`/api/kpis/${kpi.id}`);
    expect(deleteTooEarly.status()).toBe(409);

    const deleteEntry = await request.delete(`/api/kpis/${kpi.id}/entries/${entry.id}`);
    expect(deleteEntry.status()).toBe(200);

    const deleteKpi = await request.delete(`/api/kpis/${kpi.id}`);
    expect(deleteKpi.status()).toBe(200);

    const getAfterDelete = await request.get(`/api/kpis/${kpi.id}`);
    expect(getAfterDelete.status()).toBe(404);
  });

  test("returns 400 with fieldErrors for an invalid KPI payload", async ({ request }) => {
    const res = await request.post("/api/kpis", { data: { name: "" } });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.fieldErrors).toBeTruthy();
  });

  test("returns 409 for a duplicate KPI name", async ({ request }) => {
    const name = `Duplicate Test KPI ${Date.now()}`;
    const payload = { name, objective: "x", measurementType: "COUNT", targetValue: 1 };

    const first = await request.post("/api/kpis", { data: payload });
    expect(first.status()).toBe(201);

    const second = await request.post("/api/kpis", { data: payload });
    expect(second.status()).toBe(409);

    // cleanup
    const { id } = await first.json();
    await request.delete(`/api/kpis/${id}`);
  });
});
