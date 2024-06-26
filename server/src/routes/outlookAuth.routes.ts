import express, { Request, Response } from "express";
import axios from "axios";
import dotenv from "dotenv";
import { redisConnection } from "../middlewares/redisMiddlewares";
import {
  PublicClientApplication,
  ConfidentialClientApplication,
  AuthorizationUrlRequest,
  AuthorizationCodeRequest,
} from "@azure/msal-node";
import { CatchAsyncError } from "../middlewares/catchAsyncError";

dotenv.config();

const outlookRouter = express.Router();

const clientId = process.env.OUTLOOK_CLIENT_ID as string;
const clientSecret = process.env.OUTLOOK_CLIENT_SECRET as string;
const redirectUri = "http://localhost:8000/outlook/callback";

const scopes = ["user.read", "Mail.Read", "Mail.Send"];

const msalConfig = {
  auth: {
    clientId: clientId,
    authority: "https://login.microsoftonline.com/common",
    redirectUri: redirectUri,
  },
};

const pca = new PublicClientApplication(msalConfig);

const ccaConfig = {
  auth: {
    clientId: clientId,
    authority: "https://login.microsoftonline.com/common",
    clientSecret: clientSecret,
    redirectUri: redirectUri,
  },
};

const cca = new ConfidentialClientApplication(ccaConfig);

outlookRouter.get(
  "/signin",
  CatchAsyncError(async (req: Request, res: Response) => {
    const authCodeUrlParameters: AuthorizationUrlRequest = {
      scopes: scopes,
      redirectUri: redirectUri,
    };

    cca
      .getAuthCodeUrl(authCodeUrlParameters)
      .then((response) => {
        res.redirect(response);
      })
      .catch((error) => {
        console.error("Error getting auth code URL:", error);
        res.status(500).send("Error getting auth code URL");
      });
  })
);

outlookRouter.get(
  "/callback",
  CatchAsyncError(async (req: Request, res: Response) => {
    const tokenRequest: AuthorizationCodeRequest = {
      code: req.query.code as string,
      scopes: scopes,
      redirectUri: redirectUri,
    };

    try {
      const response = await cca.acquireTokenByCode(tokenRequest);
      const accessToken = response.accessToken;
      console.log(accessToken);

      const userProfile = await axios.get(
        "https://graph.microsoft.com/v1.0/me",
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const userData = userProfile.data;
      const mail = userData.mail;

      await redisConnection.set(mail, accessToken);
      console.log("User:", userData);
      res.send(userData);
    } catch (error) {
      console.error("Error in callback:", error);
      res.status(500).send("Error in callback");
    }
  })
);

export { outlookRouter };
