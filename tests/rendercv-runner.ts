import fs from "node:fs";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import type { RenderCVRunner } from "../lib/integrations/rendercv";

export async function fakeRenderCV(): Promise<RenderCVRunner> {
  const pdf = await PDFDocument.create();
  pdf.addPage([595, 842]);
  const bytes = await pdf.save();
  return (argv) => {
    const output = path.join(path.dirname(argv[1]), argv[argv.indexOf("--output-folder") + 1]);
    fs.mkdirSync(output, { recursive: true });
    fs.writeFileSync(path.join(output, "resume.pdf"), bytes);
  };
}
