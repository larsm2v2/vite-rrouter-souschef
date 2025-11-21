export async function extractTextWithTesseract(file: File): Promise<string> {
  // Lazy-load tesseract.js to keep bundle small
  try {
    // dynamic import
    const Tesseract = await import("tesseract.js");
    const worker = await Tesseract.createWorker({
      logger: (m: { status: string; progress: number }) =>
        console.debug("tesseract", m),
    });
    await worker.load();
    await worker.loadLanguage("eng");
    await worker.initialize("eng");
    const { data } = await worker.recognize(file);
    await worker.terminate();
    return data?.text || "";
  } catch (err) {
    console.warn("Tesseract import/recognize failed:", err);
    throw err;
  }
}
