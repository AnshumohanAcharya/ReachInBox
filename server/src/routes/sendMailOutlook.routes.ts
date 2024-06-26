import express, { Request, Response } from "express";
import { redisConnection } from "../middlewares/redisMiddlewares";
import axios, { AxiosRequestConfig } from "axios";
import nodemailer from "nodemailer";
import { OpenAI } from "openai";
import { CatchAsyncError } from "../middlewares/catchAsyncError";
const outlookMailRouter = express.Router();

const openai = new OpenAI({ apiKey: process.env.OPENAI_APIKEY });

const createConfig = (
  url: string,
  accessToken: string | null
): AxiosRequestConfig => ({
  method: "GET",
  url,
  headers: {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  },
});

interface MailData {
  label: string;
  to: string;
}

outlookMailRouter.get("/list/:email", async (req: Request, res: Response) => {
  try {
    const { email } = req.params;
    const accessToken = await redisConnection.get(email);
    if (!accessToken) {
      return res.status(401).json({ error: "Access token not found." });
    }
    const response = await axios.get(
      "https://graph.microsoft.com/v1.0/me/messages",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const mails = response.data;
    res.status(200).json(mails);
  } catch (error) {
    console.error("Error fetching emails:", error);
    res.status(500).json({ error: "Failed to fetch emails." });
  }
});

outlookMailRouter.get(
  "/read/:email/:msgID",
  CatchAsyncError(async (req: Request, res: Response) => {
    try {
      const URL = `https://graph.microsoft.com/v1.0/me/messages/${req.params.msgID}`;
      const token = await redisConnection.get(req.params.email);
      const config = createConfig(URL, token);
      const response = await axios(config);
      const mails = response.data;
      res.send(mails);
    } catch (err) {
      console.error("Error reading email:", err);
      res.status(500).json({ error: "Failed to read email." });
    }
  })
);

const transporter = nodemailer.createTransport({
  service: "gmail",
  port: 465,
  secure: true,
  auth: {
    user: process.env.SMTP_MAIL,
    pass: process.env.SMTP_PASS,
  },
});

outlookMailRouter.post(
  "/send-email/:email",
  CatchAsyncError(async (req: Request, res: Response) => {
    try {
      const accessToken = await redisConnection.get(req.params.email);
      if (!accessToken) {
        return res.status(401).send("Access token not found in session.");
      }

      const emailData: MailData = req.body;
      const emailContent = await generateEmailContent(emailData.label);
      console.log(emailContent);

      const mailOptions = {
        from: "anshumohanacharya19@gmail.com",
        to: emailData.to,
        subject: `User is ${emailData.label}`,
        text: emailContent,
      };

      transporter.sendMail(mailOptions, async (error, info) => {
        if (error) {
          console.error("Error sending email:", error);
          return res.status(500).send("Error sending email.");
        }
        console.log("Email sent successfully");
        res.status(200).send("Email sent successfully");

        const replyContent = await generateReplyContent(emailData.label);
        console.log("Generated reply content:", replyContent);

        // Send the reply content as an email
        const replyOptions = {
          from: "anshumohanacharya19@gmail.com",
          to: emailData.to,
          subject: `Follow-up: ${emailData.label}`,
          text: replyContent,
        };

        transporter.sendMail(replyOptions, (replyError, replyInfo) => {
          if (replyError) {
            console.error("Error sending reply email:", replyError);
            return res.status(500).send("Error sending reply email.");
          }
          console.log("Reply email sent successfully");
          res.status(200).send("Email and reply sent successfully");
        });
      });
    } catch (error) {
      console.error("Error sending email:", error);
      res.status(500).send("Error sending email.");
    }
  })
);

async function generateEmailContent(label: string): Promise<string> {
  let prompt: string;
  switch (label) {
    case "Interested":
      prompt =
        "User is interested. Please draft an email thanking them for their interest and suggesting a suitable time for a briefing call. Give output around 100 words";
      break;
    case "Not Interested":
      prompt =
        "User is not interested. Please draft an email thanking them for their time and asking for feedback and suggestions. Give output around 100 words";
      break;
    case "More Information":
      prompt =
        "User needs more information. Please draft an email expressing gratitude for their interest and asking for specific information they are looking for. Give output around 100 words";
      break;
    default:
      prompt = "";
  }

  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo-0125",
    temperature: 0.7,
    messages: [{ role: "user", content: prompt }],
  });

  return response.choices[0].message.content ?? "No reply";
}

async function generateReplyContent(label: string): Promise<string> {
  let prompt: string;
  switch (label) {
    case "Interested":
      prompt =
        "Thank you for expressing interest! We appreciate your enthusiasm. Could you please provide us with your availability for a brief call to discuss further?";
      break;
    case "Not Interested":
      prompt =
        "Thank you for considering our offer. We respect your decision. If you have any feedback or suggestions for improvement, we'd love to hear from you.";
      break;
    case "More Information":
      prompt =
        "We understand you need more information. Thank you for reaching out. Could you please specify the details you're looking for so we can assist you better?";
      break;
    default:
      prompt = "";
  }

  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo-0125",
    temperature: 0.7,
    messages: [{ role: "user", content: prompt }],
  });

  return response.choices[0].message.content ?? "No reply";
}

export { outlookMailRouter };
