import express, { Request, Response } from "express";
import nodemailer, { createTransport } from "nodemailer";
import { OAuth2Client } from "google-auth-library";
import axios, { AxiosRequestConfig } from "axios";
import OpenAI from "openai";
import { redisConnection } from "../middlewares/redisMiddlewares";
import { CatchAsyncError } from "../middlewares/catchAsyncError";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_APIKEY,
});

const googleRouter = express.Router();

const oAuthClient = new OAuth2Client({
  clientId: process.env.GOOGLE_CLIENT_ID as string,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
  redirectUri: process.env.GOOGLE_REDIRECT_URI as string,
});

googleRouter.get("/auth/google", (req: Request, res: Response) => {
  const authUrl = oAuthClient.generateAuthUrl({
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/gmail.modify",
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.compose",
    ],
  });
  console.log("authURL: ", authUrl);
  res.redirect(authUrl);
});

let accessTokenForMail: string | undefined;

googleRouter.get(
  "/auth/google/callback",
  CatchAsyncError(async (req: Request, res: Response) => {
    const { code } = req.query;
    console.log("Code: ", code);

    if (!code || typeof code !== "string") {
      return res.status(400).send("Invalid or missing code parameter");
    }

    try {
      const { tokens } = await oAuthClient.getToken(code);
      console.log(tokens);

      const accessToken = tokens.access_token;
      if (!accessToken) {
        throw new Error("Access token is undefined");
      }

      console.log("Access Token: ", accessToken);
      accessTokenForMail = accessToken;
      oAuthClient.setCredentials(tokens);

      // Get user information
      const userInfoResponse = await axios.get(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      const user = userInfoResponse.data;
      console.log(user);

      const userEmail = user.email;
      if (!userEmail) {
        throw new Error("User email is undefined");
      }

      console.log("User Email: ", userEmail);

      // Assuming you have a configured Redis client
      redisConnection.set(userEmail, accessToken, (err) => {
        if (err) {
          console.error("Error setting access token in Redis:", err);
          return res.status(500).send("Failed to store access token");
        }
        console.log("Access token stored in Redis");

        redisConnection.get(userEmail, (err, reply) => {
          if (err) {
            console.error("Error retrieving access token from Redis:", err);
            return res
              .status(500)
              .send("Failed to retrieve access token from Redis");
          }

          console.log("Stored Access Token: ", reply);
          res.send("User authenticated successfully");
        });
      });
    } catch (error) {
      console.error("Error retrieving access token:", (error as Error).message);
      res.status(500).send("Failed to retrieve access token");
    }
  })
);

const sendMail = async (data: { from: string; to: string }): Promise<any> => {
  try {
    const token = accessTokenForMail;
    console.log(token);

    // Create Nodemailer transporter
    const transporter = createTransport({
      service: "gmail",
      port: 465,
      secure: true,
      auth: {
        user: process.env.SMTP_MAIL ?? "",
        pass: process.env.SMTP_PASS ?? "",
      },
    });

    let mailOptions: nodemailer.SendMailOptions = {
      from: data.from,
      to: data.to,
      subject: "Exciting Offer",
      text: "",
      html: "",
    };

    let emailContent =
      "Generate a mail, to mail a user about the offer and comapny in better and impressive way like around 200 words. Also ask for you are intrested or not, or they want some more information and dont mention dear name, instead say dear user.My name is Prity Rastogi and company name is Reach-In Box";

    // Generate email content using OpenAI API
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo-0125",
      temperature: 0.7,
      messages: [
        {
          role: "user",
          content: emailContent,
        },
      ],
    });

    const generatedText = response.choices[0].message.content;

    // Prepare HTML content for the email
    mailOptions.html = `<div style="background-color: #f5f5f5; padding: 20px; border-radius: 10px; text-align: center; font-family: Arial, sans-serif;">
          <h2 style="color: #333;">Exciting Offer from Reach-In Box!</h2>
          <p style="font-size: 16px; color: #666;">Dear valued customer,</p>
          <p style="font-size: 16px; color: #666;">${generatedText}</p>
          <p style="font-size: 16px; color: #666;">Best regards,</p>
          <p style="font-size: 16px; color: #666;"><strong>Anshumohan Acharya</strong><br>Reach-In Box</p>
      </div>`;

    // Send email using Nodemailer transporter
    const output = await transporter.sendMail(mailOptions);
    console.log("Email sent successfully");
    return output;
  } catch (err) {
    console.error("Sending Mail Failed:", err);
    throw new Error("Sending Mail Failed" + err);
  }
};

googleRouter.get(
  "/all-mails/:email",
  CatchAsyncError(async (req: Request, res: Response) => {
    try {
      const url = `https://gmail.googleapis.com/gmail/v1/users/${req.params.email}/messages?maxResults=50`;

      // Retrieve token from Redis
      const token = await redisConnection.get(req.params.email);
      if (!token) {
        return res
          .status(401)
          .send("Token not found. Please login again to get token.");
      }

      // Create config for Axios request
      const config: AxiosRequestConfig = createConfig(url, token);

      // Make request to Gmail API
      const response = await axios(config);

      // Return response data
      res.json(response.data);
    } catch (error: any) {
      console.error("Error fetching emails:", error.message);
      res
        .status(error.response?.status || 500)
        .send(error.message || "Internal Server Error");
    }
  })
);

// Function to create Axios config with authorization headers
const createConfig = (
  url: string,
  accessToken: string
): AxiosRequestConfig => ({
  method: "GET",
  url,
  headers: {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  },
});

export { googleRouter, sendMail };
