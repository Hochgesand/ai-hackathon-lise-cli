import express from "express";
import "dotenv/config";
import { preparedTableOfContents, gptRequest } from "./chatKeywordFinder.js";
import cors from "cors";

const app = express();
app.use(cors());
const port = 8000;
app.get("/", (req, res) => {
  res.send("Express + TypeScript Server");
});
app.get("/generic_Keywords", async (req, res) => {
  res.send(await preparedTableOfContents());
});
app.get("/ask_question", async (req, res) => {
  res.send(await gptRequest(req.query["1"]));
});
app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});
