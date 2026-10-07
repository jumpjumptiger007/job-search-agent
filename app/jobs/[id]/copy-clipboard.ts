export type CopyResult = "success" | "error";
export type ClipboardWriter = (text: string) => Promise<void>;

export async function tryCopyText(text: string, writeText: ClipboardWriter): Promise<CopyResult> {
  try {
    await writeText(text);
    return "success";
  } catch {
    return "error";
  }
}
