/**
 * Serialización CSV segura:
 *  - Escapa comillas, separadores y saltos de línea (RFC 4180).
 *  - Neutraliza la inyección de fórmulas (CSV injection): un valor que empieza
 *    por = + - @, tabulador o retorno de carro se prefija con un apóstrofo
 *    para que las hojas de cálculo lo traten como texto.
 *  - Añade BOM UTF-8 para que Excel detecte bien los acentos.
 */
export type CsvSeparator = "," | ";";

const FORMULA_START = /^[=+\-@\t\r]/;

export function escapeCsvCell(value: unknown, separator: CsvSeparator = ","): string {
  if (value === undefined || value === null) return "";
  let text = typeof value === "string" ? value : String(value);
  if (typeof value === "string" && FORMULA_START.test(text)) text = `'${text}`;
  const mustQuote = text.includes('"') || text.includes(separator) || text.includes("\n") || text.includes("\r") || /^\s|\s$/.test(text);
  return mustQuote ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: readonly string[], rows: readonly (readonly unknown[])[], separator: CsvSeparator = ","): string {
  const lines = [header, ...rows].map((row) => row.map((cell) => escapeCsvCell(cell, separator)).join(separator));
  return `﻿${lines.join("\r\n")}\r\n`;
}
