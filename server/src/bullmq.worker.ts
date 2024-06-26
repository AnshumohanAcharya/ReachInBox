import { Job, Queue, Worker } from "bullmq";
import { redisConnection } from "./middlewares/redisMiddlewares";
import axios from "axios";
import { OpenAI } from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_APIKEY });

interface NewMailData {
  from: string;
  to: string;
  id: string;
}

interface MailData {
  from: string;
  to: string;
  subject: string;
  textContent: string;
  snippet: string;
  label: "Interested" | "Not Interested" | "More Information";
}

let reply = true;

const sendMail = async (data: MailData): Promise<void> => {
  try {
    const token = await redisConnection.get(data.from);
    if (!token) throw new Error("Failed to retrieve token");

    let mailContent = {
      from: data.from,
      to: data.to,
      subject: "Thank You !",
      text: "Greeting of the day !",
      html: "",
    };

    let response;
    if (!reply) {
      response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo-0125",
        temperature: 0.7,
        messages: [
          {
            role: "user",
            content: `If the email mentions they are interested, your reply should ask them if they are willing to attend a demo call by suggesting a time. Write a small text on the above request in around 200 words and thank them.`,
          },
        ],
      });
    }

    switch (data.label) {
      case "Interested":
        mailContent.html = `
                <div style="background-color: #f0f0f0; padding: 20px; border-radius: 10px; text-align: center;">
                    <p>${
                      reply
                        ? `Thank you for expressing interest in our company. We are looking forward to connecting with you. Have a great day!`
                        : `${response?.choices[0]?.message.content}`
                    }</p>
                </div>`;
        mailContent.subject = `${data.label}`;
        break;
      case "Not Interested":
        mailContent.html = `
                <div style="background-color: #f0f0f0; padding: 25px; border-radius: 20px; text-align: center;">
                    <p>${
                      reply
                        ? `Thank you for your time. Could you please provide us with some feedback.`
                        : `${response?.choices[0]?.message.content}`
                    }</p>   
                </div>`;
        mailContent.subject = `${data.label}`;
        break;
      case "More Information":
        mailContent.html = `
                <div style="background-color: #f0f0f0; padding: 20px; border-radius: 10px; text-align: center;">
                    <p>${
                      reply
                        ? `Thank you for expressing interest in our company. We are looking forward to connecting with you and providing you with more information. Have a great day!`
                        : `${response?.choices[0]?.message.content}`
                    }</p>
                </div>`;
        mailContent.subject = `${data.label}`;
        break;
      default:
        throw new Error("Invalid label");
    }

    const emailBody = [
      "Content-type: text/html;charset=iso-8859-1",
      "MIME-Version: 1.0",
      `From: ${data.from}`,
      `To: ${data.to}`,
      `Subject: ${mailContent.subject}`,
      `${mailContent.text}`,
      `${mailContent.html}`,
    ].join("\n");

    console.log(emailBody);

    const sendResponse = await axios.post(
      `https://gmail.googleapis.com/gmail/v1/users/${data.from}/messages/send`,
      { raw: Buffer.from(emailBody).toString("base64") },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );

    let labelID: string;
    switch (data.label) {
      case "Interested":
        labelID = "Label_1";
        break;
      case "Not Interested":
        labelID = "Label_2";
        break;
      case "More Information":
        labelID = "Label_3";
        break;
      default:
        throw new Error("Invalid label");
    }

    const labelURL = `https://gmail.googleapis.com/gmail/v1/users/${data.from}/messages/${sendResponse.data.id}/modify`;
    const labelConfig = {
      addLabelIds: [labelID],
    };

    await axios.post(labelURL, labelConfig, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    console.log("Email sent successfully");
  } catch (err: any) {
    console.error("Sending Mail Failed", err);
    throw new Error("Sending Mail Failed: " + err.message);
  }
};

const parseMail = async (newData: NewMailData): Promise<any> => {
  try {
    const { from, to , id} = newData;
    const token = await redisConnection.get(from);
    if (!token) throw new Error("Failed to retrieve token");

    console.log("TO:============= ",to);
    console.log("TOKEN:=============== ",token);

    const msgResponse = await axios.get(
      `https://gmail.googleapis.com/gmail/v1/users/${from}/messages/${id}`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const msg = msgResponse.data;
    const payload = msg.payload;
    const headers = payload.headers;
    const subject = headers.find(
      (header: any) => header.name === "Subject"
    )?.value;
    let textContent = "";

    if (payload.parts) {
      const text = payload.parts.find(
        (el: any) => el.mimeType === "text/plain"
      );
      if (text) {
        textContent = Buffer.from(text.body.data, "base64").toString("utf-8");
      }
    } else {
      textContent = Buffer.from(payload.body.data, "base64").toString("utf-8");
    }

    let snippet = msg.snippet;
    let emailContext = `${subject} ${snippet} ${textContent}`;
    let emailUpdatedText = emailContext.slice(0, 5000);

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo-0125",
      temperature: 0.7,
      messages: [
        {
          role: "user",
          content: `Based on the text, give a one-word answer, and categorize the text based on the content and assign a label from the given options - Interested, Not Interested, More information. Text is: ${emailUpdatedText}`,
        },
      ],
    });

    const aiAns = response.choices[0]?.message.content;
    if (!aiAns) {
      throw new Error("AI response is null or undefined");
    }
    console.log(aiAns);

    let label: "Interested" | "Not Interested" | "More Information";
    if (aiAns.includes("Interested")) {
      label = "Interested";
    } else if (aiAns.includes("Not Interested")) {
      label = "Not Interested";
    } else {
      label = "More Information";
    }

    const data: MailData = {
      from,
      to,
      subject,
      textContent,
      snippet,
      label,
    };

    console.log(data);
    const mailData = await sendMail(data);
    return mailData;
  } catch (err) {
    console.error("Failed", err);
    return -1;
  }
};


// Function to send email in queue
export async function sendEmailInQueue(emailData: {
  from: string;
  to: string;
  id: string;
  data: string;
}) {
  const emailQueue = new Queue("email-queue", { connection: redisConnection });
  await emailQueue.add("process-email", emailData);
}

// Define the worker to process emails
const worker = new Worker(
  "email-queue",
  async (job) => {
    const { from, to, id , data } = job.data;
    parseMail(job.data);
    console.log(`Processing email from ${from} to ${to} with id ${id}`);
  },
  { connection: redisConnection }
);

worker.on("completed", (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on("failed", (job: any, err: any) => {
  console.error(`Job ${job.id} failed with error ${err.message}`);
});

const sendOutlookEmailInQueue = (
  data: NewMailData,
  jobID: string
): Promise<any> =>
  new Promise(async (resolve, reject) => {
    try {
      let msg = await parseMail(data);
      if (msg) {
        console.log(`Job ${jobID} completed and sent to ${data.to}`);
      }
      resolve(msg);
    } catch (err) {
      reject(err);
    }
  })
    .then((res) => console.log(res))
    .catch((err) => console.error(err));

const outlookWorker = new Worker(
  "outlook-email-queue",
  async (job: Job) => {
    try {
      let { from, to, id } = job.data;
      let jobId = job.id;
      console.log(job.data);
      console.log(`Job ${jobId} is started`);
      setTimeout(async () => {
        console.log(job.id?.toString() || "undefined-job-id");
        await sendOutlookEmailInQueue(
          job.data,
          job.id?.toString() || "undefined-job-id"
        );
      }, 3000);
      console.log("Job in Progress");
    } catch (err) {
      console.error("Outlook worker job failed", err);
    }
  },
  { connection: redisConnection }
);
