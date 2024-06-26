import express, { Request, Response } from "express";
import { redisConnection } from "../middlewares/redisMiddlewares";
import { Queue } from "bullmq";
import { CatchAsyncError } from "../middlewares/catchAsyncError";

const mailRouter = express.Router();

const sendMailQueue = new Queue("email-queue", { connection: redisConnection });

async function init(body: { from: string; to: string; id: string }) {
  try {
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
  } catch (error: any) {
    console.error("Error adding job to queue:", error.message);
    throw error; // Propagate the error up
  }
}

mailRouter.post(
  "/send/:id",
  CatchAsyncError(async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { from, to } = req.body;
      await init({ from, to, id });
      res.send("Mail processing has been queued.");
    } catch (error: any) {
      console.error("Error in sending mail:", error.message);
      res.status(500).send("Error processing mail");
    }
  })
);

export default mailRouter;
