import express from "express";
import cors from "cors";
import helmet from "helmet";
import session from "express-session";
import passport from "../auth/passport";
import { sessionConfig } from "../auth/sessions";
import routes from "./routes";

const app = express();

app.set("trust proxy", 1);
app.use(helmet());
app.use(
  cors({
    origin: [process.env.CLIENT_URL, "http://localhost:5173"].filter(
      (url): url is string => typeof url === "string"
    ),
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session(sessionConfig));
app.use(passport.initialize());
app.use(passport.session());
app.use(routes);

export default app;
