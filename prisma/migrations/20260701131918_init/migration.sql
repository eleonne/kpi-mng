-- CreateTable
CREATE TABLE "Kpi" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "theme" TEXT,
    "objective" TEXT NOT NULL,
    "owner" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "measurementType" TEXT NOT NULL,
    "targetValue" REAL NOT NULL,
    "targetUnit" TEXT,
    "targetPeriodLabel" TEXT,
    "measurementFormulaText" TEXT,
    "qualificationCriteria" TEXT,
    "populationSize" INTEGER,
    "primaryFieldKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" TEXT
);

-- CreateTable
CREATE TABLE "KpiFieldDefinition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kpiId" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "fieldType" TEXT NOT NULL,
    "options" TEXT,
    "helpText" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "KpiFieldDefinition_kpiId_fkey" FOREIGN KEY ("kpiId") REFERENCES "Kpi" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KpiEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kpiId" TEXT NOT NULL,
    "entryDate" DATETIME NOT NULL,
    "countsTowardTarget" BOOLEAN NOT NULL DEFAULT true,
    "evidenceSource" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" TEXT,
    CONSTRAINT "KpiEntry_kpiId_fkey" FOREIGN KEY ("kpiId") REFERENCES "Kpi" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KpiEntryFieldValue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entryId" TEXT NOT NULL,
    "fieldDefinitionId" TEXT NOT NULL,
    "valueText" TEXT,
    "valueNumber" REAL,
    "valueDate" DATETIME,
    "valueBoolean" BOOLEAN,
    "valueJson" TEXT,
    CONSTRAINT "KpiEntryFieldValue_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "KpiEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "KpiEntryFieldValue_fieldDefinitionId_fkey" FOREIGN KEY ("fieldDefinitionId") REFERENCES "KpiFieldDefinition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Kpi_name_key" ON "Kpi"("name");

-- CreateIndex
CREATE UNIQUE INDEX "KpiFieldDefinition_kpiId_fieldKey_key" ON "KpiFieldDefinition"("kpiId", "fieldKey");

-- CreateIndex
CREATE UNIQUE INDEX "KpiEntryFieldValue_entryId_fieldDefinitionId_key" ON "KpiEntryFieldValue"("entryId", "fieldDefinitionId");
