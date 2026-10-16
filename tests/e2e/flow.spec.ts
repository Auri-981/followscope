import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Pruebas de extremo a extremo con datos sintéticos (public/samples).
 * Recorren el flujo real: abrir la app, elegir plataforma, importar archivos,
 * analizar, filtrar, exportar, guardar y consultar el historial.
 */
const samples = path.resolve(__dirname, "../../public/samples");

async function importInstagramSamples(page: Page) {
  await page.goto("/");
  await page.getByRole("link", { name: "Analizar Instagram" }).click();
  await expect(page).toHaveURL(/\/instagram$/);
  await page.getByPlaceholder("tu_usuario").fill("mi.cuenta");
  // La importación debe ejecutarse en un Web Worker (fuera del hilo principal).
  const worker = page.waitForEvent("worker");
  await page.getByTestId("file-input").setInputFiles([path.join(samples, "instagram/followers_1.json"), path.join(samples, "instagram/following.json")]);
  await worker;
  await expect(page.getByTestId("detected-followers")).toHaveText("64");
  await expect(page.getByTestId("detected-following")).toHaveText("62");
}

test("Instagram: importar, analizar, filtrar y exportar", async ({ page }) => {
  await importInstagramSamples(page);
  const analyze = page.getByTestId("analyze-button");
  await expect(analyze).toBeEnabled();
  await analyze.click();

  await expect(page).toHaveURL(/\/analysis\?id=/);
  await expect(page.getByRole("heading", { name: "@mi.cuenta" })).toBeVisible();
  await expect(page.getByTestId("stat-followers")).toHaveText("64");
  await expect(page.getByTestId("stat-following")).toHaveText("62");
  await expect(page.getByTestId("stat-mutual")).toHaveText("44");
  await expect(page.getByTestId("stat-notback")).toHaveText("18");
  await expect(page.getByTestId("tab-followsYouOnly")).toContainText("20");
  await expect(page.getByTestId("completeness")).toHaveText("Comparación completa");

  // Filtrar la categoría activa (no te siguen de vuelta).
  const search = page.getByRole("searchbox", { name: /Buscar en No te siguen/ });
  await search.fill("leo");
  await expect(page.getByTestId("match-count")).toHaveText("3 de 18 cuentas coinciden");

  // Exportar solo lo filtrado en CSV.
  await page.getByTestId("open-export").click();
  await page.getByText("Categoría actual con los filtros aplicados").click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("confirm-export").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^followscope-instagram-mi\.cuenta-.*-no-te-siguen-filtrado\.csv$/);
  const csv = readFileSync((await download.path())!, "utf8").replace(/^﻿/, "");
  const lines = csv.trim().split(/\r?\n/);
  expect(lines[0]).toBe("platform,category,category_label,username,display_name,profile_url,follower_since,following_since");
  expect(lines).toHaveLength(4);
  expect(lines.slice(1).every((l) => l.includes("leo."))).toBe(true);

  // Limpiar filtros y cambiar de categoría.
  await page.getByRole("button", { name: "Limpiar" }).click();
  await expect(page.getByTestId("match-count")).toHaveText("18 cuentas");
  await page.getByTestId("tab-mutualFollows").click();
  await expect(page.getByRole("searchbox", { name: /Buscar en Seguimiento mutuo/ })).toBeVisible();
});

test("Instagram: exportación JSON completa y guardado en el historial", async ({ page }) => {
  await importInstagramSamples(page);
  await page.getByTestId("analyze-button").click();
  await expect(page).toHaveURL(/\/analysis\?id=/);

  await page.getByTestId("open-export").click();
  await page.getByText("JSON", { exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("confirm-export").click();
  const json = JSON.parse(readFileSync((await (await downloadPromise).path())!, "utf8"));
  expect(json.format).toBe("followscope.results");
  expect(json.counts).toEqual({ followers: 64, following: 62, mutual: 44, notFollowingBack: 18, followsYouOnly: 20 });

  await page.getByRole("button", { name: "Guardar en este dispositivo" }).click();
  await expect(page.getByText("Este análisis no está guardado")).toBeHidden();
  await page.goto("/history");
  await expect(page.getByText("@mi.cuenta")).toBeVisible();
  await page.getByRole("link", { name: "Abrir" }).first().click();
  await expect(page.getByTestId("stat-mutual")).toHaveText("44");
});

test("errores comprensibles: archivo de otra plataforma y lista incompleta", async ({ page }) => {
  await page.goto("/instagram");
  await page.getByPlaceholder("tu_usuario").fill("mi.cuenta");
  await page.getByTestId("file-input").setInputFiles(path.join(samples, "tiktok/user_data_tiktok.json"));
  await expect(page.getByRole("alert").getByText(/parece una exportación de TikTok/)).toBeVisible();
  await expect(page.getByTestId("analyze-button")).toBeDisabled();

  await page.getByRole("button", { name: "Empezar de nuevo" }).click();
  await page.getByTestId("file-input").setInputFiles(path.join(samples, "instagram/followers_1.json"));
  await expect(page.getByRole("alert").getByText(/Falta la lista de seguidos/)).toBeVisible();
  await expect(page.getByTestId("analyze-button")).toBeDisabled();
});

test("TikTok: datos de demostración claramente marcados", async ({ page }) => {
  await page.goto("/tiktok");
  await page.getByRole("button", { name: "Probar con datos de demostración" }).click();
  await expect(page.getByTestId("detected-followers")).toHaveText("64");
  await expect(page.getByText("Datos de demostración").first()).toBeVisible();
  await page.getByTestId("analyze-button").click();
  await expect(page).toHaveURL(/\/analysis\?id=/);
  await expect(page.getByText("Datos de demostración").first()).toBeVisible();
  await expect(page.getByTestId("stat-notback")).toHaveText("18");
});

test("CSV genérico: el usuario indica el tipo de cada lista", async ({ page }, testInfo) => {
  const dir = testInfo.outputPath();
  const { mkdirSync, writeFileSync } = await import("node:fs");
  mkdirSync(dir, { recursive: true });
  const a = path.join(dir, "lista-a.csv");
  const b = path.join(dir, "lista-b.csv");
  writeFileSync(a, "username\nana\nbruno\ncarlos\ndiego\n");
  writeFileSync(b, "username\n@bruno\n@carlos\n@elena\n");

  await page.goto("/tiktok");
  await page.getByPlaceholder("tu_usuario").fill("yo");
  await page.getByTestId("file-input").setInputFiles([a, b]);
  await expect(page.getByTestId("analyze-button")).toBeDisabled();
  await page.getByLabel("Tipo de lista de lista-a.csv").selectOption("followers");
  await page.getByLabel("Tipo de lista de lista-b.csv").selectOption("following");
  await expect(page.getByTestId("detected-followers")).toHaveText("4");
  await page.getByTestId("analyze-button").click();
  await expect(page.getByTestId("stat-mutual")).toHaveText("2");
  await expect(page.getByTestId("stat-notback")).toHaveText("1");
  await expect(page.getByTestId("tab-followsYouOnly")).toContainText("2");
});

test("sin desbordamiento horizontal en las pantallas principales", async ({ page }) => {
  for (const route of ["/", "/instagram", "/tiktok", "/history", "/settings", "/privacy"]) {
    await page.goto(route);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, route).toBeLessThanOrEqual(0);
  }
});
