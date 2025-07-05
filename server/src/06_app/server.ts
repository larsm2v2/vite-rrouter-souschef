import { app } from "../05_frameworks/index";
import { ensureDatabaseInitialized } from "./database";

export async function startServer() {
  await ensureDatabaseInitialized();

  const PORT = process.env.PORT || 8000;
  app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
  });
}
