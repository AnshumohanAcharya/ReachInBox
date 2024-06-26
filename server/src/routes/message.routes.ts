import express, { Request, Response } from "express";
import axios, { AxiosRequestConfig } from "axios";
import { redisConnection } from "../middlewares/redisMiddlewares";
import { CatchAsyncError } from "../middlewares/catchAsyncError";
import { sendMail } from "./googleAuth.routes";
import { sendEmailInQueue } from "../bullmq.worker";

const messageRouter = express.Router();
messageRouter.use(express.json());

// messageRouter.post(
//   "/send-mail",
//   CatchAsyncError(async (req: Request, res: Response) => {
//     try {
//       const data = sendMail(req.body);
//       res.status(200).json({ msg: "Email Sent Successfully", data });
//     } catch (err) {
//       console.error("Error sending email:", err);
//       res.status(400).json({ error: "Failed to send email" });
//     }
//   })
// );
messageRouter.post(
  "/send-mail",
  CatchAsyncError(async (req: Request, res: Response) => {
    try {
      const { from, to, id } = req.body;
      await sendEmailInQueue({ from, to, id });

      res.status(200).json({ msg: "Email job enqueued successfully" });
    } catch (err) {
      console.error("Error enqueuing email job:", err);
      res.status(400).json({ error: "Failed to enqueue email job" });
    }
  })
);

messageRouter.get(
  "/all-draft/:email",
  CatchAsyncError(async (req: Request, res: Response) => {
    try {
      const URL = `https://gmail.googleapis.com/gmail/v1/users/${req.params.email}/drafts`;
      const token = await redisConnection.get(req.params.email);

      if (!token) {
        return res.status(404).send("Token Not Found");
      }

      const config = createConfig(URL, token);
      const response = await axios(config);

      res.json(response.data);
    } catch (err: any) {
      console.error("Error fetching drafts:", err);
      res.status(500).send("Failed to fetch drafts: " + err.message);
    }
  })
);

messageRouter.get(
  "/read-mail/:email/message/:message",
  CatchAsyncError(async (req: Request, res: Response) => {
    try {
      const URL: string = `https://gmail.googleapis.com/gmail/v1/users/${req.params.email}/messages/${req.params.message}`;
      const token: string | null = await redisConnection.get(req.params.email);

      if (!token) {
        return res.status(401).send("Token Not Found"); // Assuming 401 Unauthorized status is appropriate
      }

      const config: AxiosRequestConfig = createConfig(URL, token);
      const response = await axios(config);

      res.json(response.data);
    } catch (err: any) {
      console.error("Error retrieving message:", err);
      res.status(500).send(err.message); // Internal Server Error
    }
  })
);

function createConfig(url: string, token: string): AxiosRequestConfig {
  return {
    method: "get",
    url: url,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  };
}

messageRouter.get(
  "/getMail/:email",
  CatchAsyncError(async (req: Request, res: Response) => {
    try {
      const url: string = `https://gmail.googleapis.com/gmail/v1/users/${req.params.email}/messages?maxResults=50`;
      const token: string | null = await redisConnection.get(req.params.email);

      if (!token) {
        return res.status(401).send("Token not found"); // Assuming 401 Unauthorized status is appropriate
      }

      const config: AxiosRequestConfig = createConfig(url, token);
      const response = await axios(config);

      res.json(response.data);
    } catch (error: any) {
      const errorMessage: string =
        error.response && error.response.data
          ? error.response.data.error.message
          : error.message;
      console.error("Error retrieving emails:", errorMessage);
      res.status(500).send(errorMessage); // Internal Server Error
    }
  })
);

messageRouter.get(
  "/userData/:email",
  CatchAsyncError(async (req: Request, res: Response) => {
    try {
      const email: string = req.params.email;
      const accessToken: string | null = await redisConnection.get(email);

      if (!accessToken) {
        return res.status(401).send("Access Token not found"); // Assuming 401 Unauthorized status is appropriate
      }

      const response = await axios.get(
        `https://gmail.googleapis.com/gmail/v1/users/${email}/profile`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      res.status(200).json(response.data);
    } catch (error: any) {
      console.error("Error retrieving user data:", error.message);
      res.status(500).json({ error: error.message }); // Internal Server Error
    }
  })
);

messageRouter.post(
  "/createLabel/:email",
  CatchAsyncError(async (req: Request, res: Response) => {
    try {
      const { email } = req.params;
      const accessToken: string | null = await redisConnection.get(email);
      const label = req.body;

      if (!accessToken) {
        return res.status(401).send("Access Token not found"); // Assuming 401 Unauthorized status is appropriate
      }

      console.log(accessToken, label);

      const response = await axios.post(
        `https://gmail.googleapis.com/gmail/v1/users/${email}/labels`,
        label,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      res.status(200).json(response.data);
    } catch (error: any) {
      console.error("Error creating label:", error.message);
      res.status(500).json({ error: error.message }); // Internal Server Error
    }
  })
);

messageRouter.post(
  "/addLabel/:email/messages/:id",
  CatchAsyncError(async (req: Request, res: Response) => {
    try {
      const { email, id } = req.params;
      const access_token: string | null = await redisConnection.get(email);

      if (!access_token) {
        return res.status(401).send("Access Token not found"); // Assuming 401 Unauthorized status is appropriate
      }

      const response = await axios.post(
        `https://gmail.googleapis.com/gmail/v1/users/${email}/messages/${id}/modify`,
        req.body,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${access_token}`,
          },
        }
      );

      res.status(200).json(response.data);
    } catch (error: any) {
      console.error("Error adding label to message:", error.message);
      res.status(500).json({ error: "Error while adding label to message" });
    }
  })
);

messageRouter.get(
  "/getLabel/:email/:labelId",
  CatchAsyncError(async (req: Request, res: Response) => {
    try {
      const { email, labelId } = req.params;
      const accessToken: string | null = await redisConnection.get(email);

      if (!accessToken) {
        return res.status(401).send("Access Token not found"); // Assuming 401 Unauthorized status is appropriate
      }

      const response = await axios.get(
        `https://gmail.googleapis.com/gmail/v1/users/${email}/labels/${labelId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      res.status(200).json(response.data);
    } catch (error: any) {
      console.error("Error retrieving label:", error.message);
      res.status(500).json({ error: "Error while fetching label information" });
    }
  })
);

messageRouter.post(
  "/addLabel/:email/messages/:id",
  CatchAsyncError(async (req: Request, res: Response) => {
    try {
      const { email, id } = req.params;
      const accessToken: string | null = await redisConnection.get(email);

      if (!accessToken) {
        return res.status(401).send("Access Token not found"); // Assuming 401 Unauthorized status is appropriate
      }

      const response = await axios.post(
        `https://gmail.googleapis.com/gmail/v1/users/${email}/messages/${id}/modify`,
        req.body,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      res.status(200).json(response.data);
    } catch (error: any) {
      console.error("Error adding label:", error.message);
      res.status(500).json({ error: "Error while adding label to message" });
    }
  })
);

export default messageRouter;
