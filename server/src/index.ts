import express, { Request, Response } from "express";
import cors from "cors";
import "dotenv/config";
import session from "express-session";
import { googleRouter } from "./routes/googleAuth.routes";
import messageRouter from "./routes/message.routes";
import mailRouter from "./routes/mail.routes";
import { outlookRouter } from "./routes/outlookAuth.routes";
import { outlookMailRouter } from "./routes/sendMailOutlook.routes";
import { outlookmailRouter } from "./routes/outlookQueue.routes";

const app = express();

app.use(
  session({
    secret: "any_secret_key",
    resave: false,
    saveUninitialized: false,
  })
); // for using session

app.use(express.json()); // for parsing application/json
app.use(cors()); // for enabling CORS
app.use(express.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

app.get("/health", (req: Request, res: Response) => {
  res.json({ message: "Health OK!" });
}); // for checking health of the server

app.use("/", googleRouter); // for using googleRouter
app.use("/api/mail", messageRouter); // for using messageRouter
app.use("/mail", mailRouter); // for using mailRouter
app.use("/outlook", outlookRouter); // for using outlookRouter
app.use("/outlookmail", outlookMailRouter); // for using outlookMailRouter
app.use("/outlook-mail", outlookmailRouter); // for using outlookmailRouter

app.listen(8000, () => {
  console.log("Server is running on port 8000");
});
