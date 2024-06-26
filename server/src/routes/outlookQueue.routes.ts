import express, { Request, Response } from "express";
import { Queue } from "bullmq";
import { redisConnection } from "../middlewares/redisMiddlewares";

const outlookmailRouter = express.Router();

const sendMailQueue = new Queue("outlook-email-queue", {
  connection: redisConnection,
});

export async function init(body: { from: string; to: string; id: string }) {
  const res = await sendMailQueue.add(
    "Email to selected user",
    {
      from: body.from,
      to: body.to,
      id: body.id,
    },
    { removeOnComplete: true }
  );
  console.log("Job added to queue", res.id);
}

outlookmailRouter.post("/sendMail/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { from, to } = req.body;
    await init({ from, to, id });
    res.send("Mail processing has been queued.");
  } catch (error: any) {
    console.error("Error in sending mail", error.message);
    res.status(500).send("Error in sending mail");
  }
});

export { outlookmailRouter };
