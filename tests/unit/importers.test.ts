import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { defaultLimits } from "@/config/limits";
import { parseCsv } from "@/importers/csv";
import { jsonDepth } from "@/importers/json";
import { importFiles } from "@/importers/pipeline";
import { crc32, listZipEntries, extractZipEntry } from "@/importers/zip";
import { igFollowers, igFollowing, syntheticNames, textFile, tiktokUserData, usernames } from "../helpers";

const run = (platform: "instagram" | "tiktok", ...files: ReturnType<typeof textFile>[]) => importFiles({ platform, files });

describe("Instagram", () => {
  it("lee followers_1.json y following.json (formato con title)", async () => {
    const out = await run("instagram", textFile("followers_1.json", igFollowers(["ana", "bruno"])), textFile("following.json", igFollowing(["bruno", "elena"])));
    expect(out.errors).toEqual([]);
    expect(out.canCompare).toBe(true);
    expect(usernames(out.followers!.entries)).toEqual(["ana", "bruno"]);
    expect(usernames(out.following!.entries)).toEqual(["bruno", "elena"]);
    expect(out.following!.entries[0]!.since).toBeDefined();
  });

  it("lee el formato clásico con value", async () => {
    const out = await run("instagram", textFile("followers_1.json", igFollowers(["a"])), textFile("following.json", igFollowing(["a"], "value")));
    expect(out.canCompare).toBe(true);
    expect(out.following!.entries[0]!.username).toBe("a");
  });

  it("deduce el usuario desde el enlace si faltan value y title", async () => {
    const following = JSON.stringify({ relationships_following: [{ title: "", string_list_data: [{ href: "https://www.instagram.com/_u/zoe", timestamp: 1 }] }] });
    const out = await run("instagram", textFile("followers_1.json", igFollowers([])), textFile("following.json", following));
    expect(out.following!.entries.map((e) => e.username)).toEqual(["zoe"]);
  });

  it("fusiona followers_1 y followers_2 y detecta partes ausentes", async () => {
    const ok = await run(
      "instagram",
      textFile("followers_1.json", igFollowers(["a", "b"])),
      textFile("followers_2.json", igFollowers(["c"])),
      textFile("following.json", igFollowing(["a"])),
    );
    expect(ok.followers!.entries).toHaveLength(3);
    expect(ok.incomplete).toBe(false);

    const gap = await run("instagram", textFile("followers_1.json", igFollowers(["a"])), textFile("followers_3.json", igFollowers(["c"])), textFile("following.json", igFollowing(["a"])));
    expect(gap.incomplete).toBe(true);
    expect(gap.followers!.warnings.some((w) => w.code === "missing_parts")).toBe(true);
  });

  it("detecta un archivo con nombre de seguidores pero contenido de seguidos", async () => {
    const out = await run("instagram", textFile("followers_1.json", igFollowing(["a"])), textFile("following.json", igFollowing(["b"])));
    expect(out.followers).toBeUndefined();
    expect(out.errors.some((e) => e.code === "missing_followers")).toBe(true);
    expect(out.following!.warnings.some((w) => w.code === "kind_name_mismatch")).toBe(true);
  });

  it("exige ambas listas", async () => {
    const out = await run("instagram", textFile("followers_1.json", igFollowers(["a"])));
    expect(out.canCompare).toBe(false);
    expect(out.errors.map((e) => e.code)).toContain("missing_following");
  });

  it("rechaza la exportación en HTML con un mensaje claro", async () => {
    const out = await run("instagram", textFile("followers_1.html", "<html><body>ana</body></html>"));
    expect(out.errors[0]!.code).toBe("html_export");
  });

  it("rechaza un JSON de TikTok en la sección de Instagram", async () => {
    const out = await run("instagram", textFile("user_data_tiktok.json", tiktokUserData(["a"], ["b"])));
    expect(out.errors[0]!.code).toBe("wrong_platform");
  });

  it("ignora otros archivos de relaciones (amigos cercanos)", async () => {
    const out = await run(
      "instagram",
      textFile("close_friends.json", JSON.stringify({ relationships_close_friends: [] })),
      textFile("followers_1.json", igFollowers(["a"])),
      textFile("following.json", igFollowing(["a"])),
    );
    expect(out.files.some((f) => f.status === "ignored")).toBe(true);
    expect(out.canCompare).toBe(true);
  });

  it("estructura sin usuarios reconocibles", async () => {
    const out = await run("instagram", textFile("following.json", JSON.stringify({ relationships_following: [{ foo: 1 }] })));
    expect(out.errors[0]!.code).toBe("missing_username_field");
  });
});

describe("TikTok", () => {
  it("lee user_data con la estructura clásica", async () => {
    const out = await run("tiktok", textFile("user_data_tiktok.json", tiktokUserData(["Ana_1", "b"], ["b", "c"])));
    expect(out.canCompare).toBe(true);
    expect(usernames(out.followers!.entries)).toEqual(["Ana_1", "b"]);
    expect(out.followers!.entries[0]!.since).toBe("2026-01-02T10:00:00.000Z");
  });

  it("lee la estructura reorganizada («Your Activity»)", async () => {
    const out = await run("tiktok", textFile("user_data.json", tiktokUserData(["a"], ["a", "b"], "recent")));
    expect(out.canCompare).toBe(true);
    expect(out.following!.entries).toHaveLength(2);
  });

  it("acepta listas vacías (null) como válidas", async () => {
    const data = JSON.stringify({ Activity: { "Follower List": { FansList: null }, "Following List": { Following: [{ UserName: "x" }] } } });
    const out = await run("tiktok", textFile("user_data.json", data));
    expect(out.canCompare).toBe(true);
    expect(out.followers!.entries).toHaveLength(0);
  });

  it("lee los TXT Follower.txt y Following.txt", async () => {
    const out = await run(
      "tiktok",
      textFile("Follower.txt", "Date: 2026-01-01 10:00:00\nUsername: ana\n\nDate: 2026-01-02 10:00:00\nUsername: bruno\n"),
      textFile("Following.txt", "Date: 2026-01-01 10:00:00\nUsername: bruno\n"),
    );
    expect(out.canCompare).toBe(true);
    expect(out.followers!.entries).toHaveLength(2);
  });

  it("explica cuando la exportación no incluye las listas", async () => {
    const out = await run("tiktok", textFile("user_data.json", JSON.stringify({ Activity: { "Like List": { ItemFavoriteList: [] } } })));
    expect(out.errors[0]!.code).toBe("no_lists_in_export");
  });

  it("rechaza un archivo de Instagram en la sección de TikTok", async () => {
    const out = await run("tiktok", textFile("followers_1.json", igFollowers(["a"])));
    expect(out.errors[0]!.code).toBe("wrong_platform");
  });
});

describe("errores de archivo", () => {
  it("archivo vacío", async () => {
    const out = await run("instagram", textFile("following.json", ""));
    expect(out.errors[0]!.code).toBe("file_empty");
  });

  it("JSON inválido o truncado", async () => {
    const out = await run("instagram", textFile("following.json", '{"relationships_following": [ {"title": "a"'));
    expect(out.errors[0]!.code).toBe("invalid_json");
  });

  it("estructura demasiado profunda", async () => {
    const deep = "[".repeat(200) + "]".repeat(200);
    const out = await run("instagram", textFile("following.json", deep));
    expect(out.errors[0]!.code).toBe("json_too_deep");
  });

  it("formato no compatible", async () => {
    const out = await run("instagram", textFile("foto.png", new Uint8Array([1, 2, 3])));
    expect(out.errors[0]!.code).toBe("unsupported_format");
  });

  it("archivo demasiado grande", async () => {
    const out = await importFiles({
      platform: "instagram",
      files: [textFile("following.json", igFollowing(["a"]))],
      limits: { ...defaultLimits, maxFileBytes: 10 },
    });
    expect(out.errors[0]!.code).toBe("file_too_large");
  });

  it("demasiados registros", async () => {
    const out = await importFiles({
      platform: "instagram",
      files: [textFile("followers_1.json", igFollowers(syntheticNames("u", 20))), textFile("following.json", igFollowing(["a"]))],
      limits: { ...defaultLimits, maxRecords: 10 },
    });
    expect(out.errors.some((e) => e.code === "too_many_records")).toBe(true);
    expect(out.canCompare).toBe(false);
  });

  it("sin archivos", async () => {
    const out = await importFiles({ platform: "tiktok", files: [] });
    expect(out.errors[0]!.code).toBe("no_files");
  });

  it("un archivo con errores bloquea la comparación aunque haya listas válidas", async () => {
    const out = await run("instagram", textFile("followers_1.json", igFollowers(["a"])), textFile("following.json", igFollowing(["a"])), textFile("followers_2.json", "{roto"));
    expect(out.canCompare).toBe(false);
  });
});

describe("CSV genérico", () => {
  it("analiza CSV con comillas, separadores y saltos de línea", () => {
    const rows = parseCsv('username,display_name\nana,"García, Ana"\nbea,"Dice ""hola""\nadiós"\n', "x.csv");
    expect(rows).toEqual([
      ["username", "display_name"],
      ["ana", "García, Ana"],
      ["bea", 'Dice "hola"\nadiós'],
    ]);
  });

  it("detecta punto y coma como separador", () => {
    expect(parseCsv("usuario;nombre\nana;Ana\n", "x.csv")).toEqual([["usuario", "nombre"], ["ana", "Ana"]]);
  });

  it("rechaza comillas sin cerrar", async () => {
    const out = await run("instagram", textFile("seguidores.csv", 'username\n"ana\n'));
    expect(out.errors[0]!.code).toBe("malformed_csv");
  });

  it("usa la columna list para separar seguidores y seguidos", async () => {
    const out = await run("instagram", textFile("lista.csv", "username,list\nana,followers\nbruno,following\nbruno,followers\n"));
    expect(out.canCompare).toBe(true);
    expect(usernames(out.followers!.entries)).toEqual(["ana", "bruno"]);
  });

  it("deduce el tipo por el nombre del archivo o pide elegirlo", async () => {
    const named = await run("tiktok", textFile("seguidores.csv", "username\nana\n"), textFile("seguidos.csv", "username\nana\n"));
    expect(named.canCompare).toBe(true);

    const unnamed = await run("tiktok", textFile("lista-a.csv", "username\nana\n"), textFile("lista-b.csv", "username\nbea\n"));
    expect(unnamed.unresolvedFiles).toEqual(["lista-a.csv", "lista-b.csv"]);
    expect(unnamed.canCompare).toBe(false);

    const resolved = await importFiles({
      platform: "tiktok",
      files: [textFile("lista-a.csv", "username\nana\n"), textFile("lista-b.csv", "username\nbea\n")],
      kindOverrides: { "lista-a.csv": "followers", "lista-b.csv": "following" },
    });
    expect(resolved.canCompare).toBe(true);
  });

  it("rechaza datos de otra plataforma según la columna platform", async () => {
    const out = await run("instagram", textFile("seguidores.csv", "username,platform\nana,tiktok\n"));
    expect(out.errors[0]!.code).toBe("wrong_platform");
  });

  it("sin columna de usuario y con varias columnas", async () => {
    const out = await run("instagram", textFile("seguidores.csv", "foo,bar\n1,2\n"));
    expect(out.errors[0]!.code).toBe("missing_username_field");
  });

  it("rechaza un CSV de resultados como si fuera una lista", async () => {
    const out = await run("instagram", textFile("resultados.csv", "platform,category,username\ninstagram,mutualFollows,ana\n"));
    expect(out.errors[0]!.code).toBe("unknown_structure");
  });
});

describe("ZIP", () => {
  const followers = igFollowers(["ana", "bruno"]);
  const following = igFollowing(["bruno"]);

  it("extrae solo los ficheros necesarios de una exportación de Instagram", async () => {
    const zip = zipSync({
      "connections/followers_and_following/followers_1.json": strToU8(followers),
      "connections/followers_and_following/following.json": strToU8(following),
      "your_instagram_activity/likes/liked_posts.json": strToU8("{}"),
      "media/photo.jpg": new Uint8Array(1000),
    });
    const out = await run("instagram", textFile("instagram-export.zip", zip));
    expect(out.errors).toEqual([]);
    expect(out.canCompare).toBe(true);
    expect(out.followers!.sourceFiles[0]).toContain("followers_1.json");
  });

  it("usa la fecha de la entrada del ZIP como fecha de los datos", async () => {
    const mtime = new Date(2026, 2, 1, 12, 0, 0);
    const zip = zipSync({ "followers_1.json": [strToU8(followers), { mtime }], "following.json": [strToU8(following), { mtime }] });
    const out = await run("instagram", textFile("e.zip", zip));
    expect(out.followers!.fileDate).toBe(mtime.toISOString());
  });

  it("detecta un ZIP de la otra plataforma", async () => {
    const zip = zipSync({ "user_data_tiktok.json": strToU8(tiktokUserData(["a"], ["b"])) });
    const out = await run("instagram", textFile("tiktok.zip", zip));
    expect(out.errors[0]!.code).toBe("wrong_platform");
  });

  it("ZIP sin las listas", async () => {
    const zip = zipSync({ "otra/cosa.json": strToU8("{}") });
    const out = await run("instagram", textFile("e.zip", zip));
    expect(out.errors[0]!.code).toBe("zip_no_relevant_files");
  });

  it("ZIP dañado", async () => {
    const out = await run("instagram", textFile("e.zip", new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4, 5])));
    expect(out.errors[0]!.code).toBe("zip_invalid");
  });

  it("rechaza entradas que superan el límite descomprimido (zip bomb)", async () => {
    const zip = zipSync({ "followers_1.json": new Uint8Array(5_000_000) }, { level: 9 });
    const blob = new Blob([zip as BlobPart]);
    const [entry] = await listZipEntries(blob);
    await expect(extractZipEntry(blob, entry!, 1_000_000)).rejects.toMatchObject({ code: "zip_entry_too_large" });
  });

  it("detecta corrupción por CRC", async () => {
    const zip = zipSync({ "following.json": strToU8(following) }, { level: 0 });
    const blob = new Blob([zip as BlobPart]);
    const [entry] = await listZipEntries(blob);
    const tampered = new Uint8Array(zip);
    const at = entry!.localHeaderOffset + 30 + "following.json".length + 2;
    tampered[at] = tampered[at]! ^ 0xff;
    await expect(extractZipEntry(new Blob([tampered as BlobPart]), entry!, 1e9)).rejects.toMatchObject({ code: "zip_corrupt_entry" });
  });

  it("crc32 coincide con el valor de referencia", () => {
    expect(crc32(strToU8("123456789"))).toBe(0xcbf43926);
  });
});

describe("utilidades", () => {
  it("jsonDepth ignora corchetes dentro de cadenas", () => {
    expect(jsonDepth('{"a":"[[[[["}')).toBe(1);
    expect(jsonDepth('[[{"a":[1]}]]')).toBe(4);
  });

  it("procesa miles de registros", async () => {
    const names = syntheticNames("user", 20_000);
    const out = await run("instagram", textFile("followers_1.json", igFollowers(names)), textFile("following.json", igFollowing(names.slice(0, 10_000))));
    expect(out.followers!.entries).toHaveLength(20_000);
    expect(out.following!.entries).toHaveLength(10_000);
  });
});
