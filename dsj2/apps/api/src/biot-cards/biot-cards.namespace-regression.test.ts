import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";

function findWorkspaceRoot(startDir: string) {
  let currentDir = resolve(startDir);

  while (true) {
    if (
      existsSync(resolve(currentDir, "scripts/generate_biot_card.py")) &&
      existsSync(resolve(currentDir, "apps/api/package.json"))
    ) {
      return currentDir;
    }

    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      throw new Error("Could not locate the dsj2 workspace root.");
    }

    currentDir = parentDir;
  }
}

const workspaceRoot = findWorkspaceRoot(process.cwd());
const pythonCommand = process.env.PYTHON_BIN?.trim() || "python3";

const pythonProbe = spawnSync(pythonCommand, ["--version"], {
  cwd: workspaceRoot,
  encoding: "utf8",
});

const pythonSkipReason =
  pythonProbe.error || pythonProbe.status !== 0
    ? "python3 is required for BIOT document pipeline regression checks"
    : false;

function runPython(script: string) {
  const result = spawnSync(pythonCommand, ["-c", script], {
    cwd: workspaceRoot,
    encoding: "utf8",
  });

  if (result.error) {
    throw result.error;
  }

  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
}

function pythonEnvWithoutIoEncoding() {
  const env = { ...process.env };
  delete env.PYTHONIOENCODING;
  delete env.PYTHONUTF8;
  return env;
}

test(
  "BIOT card CLI reads Unicode JSON stdin as UTF-8 without PYTHONIOENCODING",
  { skip: pythonSkipReason },
  () => {
    const workingDirectory = mkdtempSync(join(tmpdir(), "dsj-biot-utf8-"));
    const outputPath = resolve(workingDirectory, "biot-card.docx");

    try {
      const payload = {
        fields: {
          Берілді: "Әлихан Қасымов",
          В_том_что_он: "прошел проверку знаний по безопасности и охране труда",
          ГОД: "2026",
          День_месяц: "05 июня",
          Должность: "Инженер по безопасности",
          Жұмыс__орны_: "ЖШС «Құрылыс Сервис»",
          Лауазымы: "Қауіпсіздік инженері",
          Место_работы__: "ТОО «Строй Сервис»",
          Номер_серии: "DSJ",
          Номер_удостоверения: "000123",
          Протокол_: "№ 7 от 05.06.2026",
          ФИО: "Әлихан Қасымов",
        },
        fieldStyleOverrides: {
          ФИО: {
            fontSize: 22,
          },
        },
        photo: null,
        textReplacements: [],
      };

      const result = spawnSync(
        pythonCommand,
        [
          "scripts/generate_biot_card.py",
          "docs/experimental/biot/biot-card-template.docx",
          outputPath,
        ],
        {
          cwd: workspaceRoot,
          encoding: "utf8",
          env: pythonEnvWithoutIoEncoding(),
          input: Buffer.from(JSON.stringify(payload), "utf8"),
        },
      );

      if (result.error) {
        throw result.error;
      }

      assert.equal(result.status, 0, result.stderr || result.stdout);
      assert.equal(existsSync(outputPath), true);
      assert.ok(statSync(outputPath).size > 0);
    } finally {
      rmSync(workingDirectory, { recursive: true, force: true });
    }
  },
);

test(
  "reserved auto-generated namespace prefixes no longer crash registration",
  { skip: pythonSkipReason },
  () => {
    const output = runPython(`
from pathlib import Path
from xml.etree import ElementTree as ET
import json
import sys

sys.path.insert(0, str(Path("scripts").resolve()))
import generate_biot_card as card

xml_bytes = b'<?xml version="1.0" encoding="utf-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:ns0="urn:test-auto"><w:body><ns0:marker /></w:body></w:document>'
namespaces = card.collect_namespaces(xml_bytes)
card.register_namespaces(namespaces)
root = ET.fromstring(xml_bytes)
roundtrip = ET.tostring(root, encoding="unicode")
print(json.dumps({
    "reservedPrefixes": [prefix for prefix in namespaces if prefix.startswith("ns")],
    "roundtrip": roundtrip,
}))
`);

    const parsed = JSON.parse(output) as {
      reservedPrefixes: string[];
      roundtrip: string;
    };

    assert.deepEqual(parsed.reservedPrefixes, ["ns0"]);
    assert.match(parsed.roundtrip, /xmlns:ns\d+="urn:test-auto"/);
    assert.match(parsed.roundtrip, /<ns\d+:marker/);
  },
);

test(
  "repo card and protocol templates still render and preview successfully",
  { skip: pythonSkipReason },
  () => {
    const output = runPython(`
from pathlib import Path
from zipfile import ZipFile
from io import BytesIO
from xml.etree import ElementTree as ET
import base64
import json
import tempfile
import sys

sys.path.insert(0, str(Path("scripts").resolve()))
import generate_biot_card as card
import generate_biot_mail_merge_bundle as bundle

templates = {
    "BIOT_CARD": Path("docs/experimental/biot/biot-card-template.docx"),
    "BIOT_PROTOCOL": Path("docs/experimental/biot/biot-protocol-template.docx"),
    "PTM_CARD": Path("docs/experimental/ptm/ptm-card-template.docx"),
    "PTM_PROTOCOL": Path("docs/experimental/ptm/ptm-protocol-template.docx"),
    "PB_CARD": Path("docs/experimental/pb/pb-card-template.docx"),
    "PB_PROTOCOL": Path("docs/experimental/pb/pb-protocol-template.docx"),
    "PS_CARD": Path("docs/experimental/ps/ps-card-template.docx"),
    "PS_PROTOCOL": Path("docs/experimental/ps/ps-protocol-template.docx"),
}
photo_slots = {
    "PTM_CARD": {
        "mode": "floating_rect",
        "shapeId": "DSJPhotoSlotPTM",
        "style": "position:absolute;margin-left:215.4pt;margin-top:123.75pt;width:51pt;height:67.5pt;z-index:251689984;visibility:visible;mso-wrap-style:square;mso-width-percent:0;mso-height-percent:0;mso-wrap-distance-left:9pt;mso-wrap-distance-top:0;mso-wrap-distance-right:9pt;mso-wrap-distance-bottom:0;mso-position-horizontal:absolute;mso-position-horizontal-relative:text;mso-position-vertical:absolute;mso-position-vertical-relative:page;mso-width-relative:page;mso-height-relative:page;v-text-anchor:top",
    },
    "PB_CARD": {
        "mode": "floating_rect",
        "shapeId": "DSJPhotoSlotPB",
        "style": "position:absolute;margin-left:-2.1pt;margin-top:121.5pt;width:59.8pt;height:79.65pt;z-index:251709952;visibility:visible;mso-wrap-style:square;mso-width-percent:0;mso-height-percent:0;mso-wrap-distance-left:9pt;mso-wrap-distance-top:0;mso-wrap-distance-right:9pt;mso-wrap-distance-bottom:0;mso-position-horizontal:absolute;mso-position-horizontal-relative:text;mso-position-vertical:absolute;mso-position-vertical-relative:page;mso-width-relative:page;mso-height-relative:page;v-text-anchor:top",
    },
    "PS_CARD": {
        "mode": "floating_rect",
        "shapeId": "DSJPhotoSlotPS",
        "style": "position:absolute;margin-left:8pt;margin-top:108pt;width:56pt;height:74pt;z-index:251709952;visibility:visible;mso-wrap-style:square;mso-width-percent:0;mso-height-percent:0;mso-wrap-distance-left:9pt;mso-wrap-distance-top:0;mso-wrap-distance-right:9pt;mso-wrap-distance-bottom:0;mso-position-horizontal:absolute;mso-position-horizontal-relative:text;mso-position-vertical:absolute;mso-position-vertical-relative:page;mso-width-relative:page;mso-height-relative:page;v-text-anchor:top",
    },
}
png_data_url = "data:image/png;base64," + base64.b64encode(b"png-bytes").decode("ascii")

def extract_fields(path: Path) -> dict[str, str]:
    with ZipFile(path) as archive:
        xml_bytes = archive.read("word/document.xml")
    root = ET.fromstring(xml_bytes)
    fields = set()
    for instr in root.findall(f".//{card.W}instrText"):
        name = card.extract_merge_field_name(card.normalize_instr_text(instr.text))
        if name:
            fields.add(name)
    return {name: f"[{name}]" for name in fields}

results = []
for name, path in templates.items():
    fields = extract_fields(path)
    photo = None
    if name in photo_slots:
        photo = {
            "dataUrl": png_data_url,
            "fileName": "photo.png",
            "slot": photo_slots[name],
        }
    bundle.render_filled_docx_bytes(path, fields, photo, [], {})
    with tempfile.TemporaryDirectory() as tmpdir:
        output_path = Path(tmpdir) / "preview.docx"
        rows = [
            {
                "fields": fields,
                "photo": photo,
                "textReplacements": [],
                "fieldStyleOverrides": {},
            },
            {
                "fields": fields,
                "photo": photo,
                "textReplacements": [],
                "fieldStyleOverrides": {},
            },
        ]
        bundle.build_preview_document(path, output_path, rows)
    results.append(name)

print(json.dumps(results))
`);

    const parsed = JSON.parse(output) as string[];
    assert.deepEqual(parsed.sort(), [
      "BIOT_CARD",
      "BIOT_PROTOCOL",
      "PB_CARD",
      "PB_PROTOCOL",
      "PS_CARD",
      "PS_PROTOCOL",
      "PTM_CARD",
      "PTM_PROTOCOL",
    ]);
  },
);
