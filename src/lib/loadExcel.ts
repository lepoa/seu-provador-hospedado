import type ExcelJS from "exceljs";

let excelPromise: Promise<typeof ExcelJS> | null = null;

export async function loadExcelJS(): Promise<typeof ExcelJS> {
  if (!excelPromise) {
    excelPromise = import("exceljs").then((module) => (module.default ?? module) as typeof ExcelJS);
  }
  return excelPromise;
}
