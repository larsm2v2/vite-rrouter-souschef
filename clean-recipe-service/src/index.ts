import express from "express";
import cors from "cors";
import routes from "./routes";

const app = express();
app.use(cors());
app.use(express.json());
app.use(routes);

const PORT = process.env.PORT || 6000;
app.listen(PORT, () => {
  console.log(`Clean Recipe Service running on port ${PORT}`);
});
