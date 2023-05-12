import "dotenv/config";
import { Configuration, OpenAIApi } from "openai";
import { createInterface } from "node:readline/promises";
import {readFile} from "fs/promises"
import { cosineSimilarity } from "./cosineSimilarity.js";
const apiKey = process.env.API_KEY;

const chunks = await readFile("./data/embeddings.json", "utf-8")
function getConfig(model) {
    return new Configuration({
        apiKey,
        basePath: `https://lise-openai-gpt4.openai.azure.com/openai/deployments/${model}`,
        baseOptions: {
            headers: {
                "api-key": apiKey,
            },
            params: {
                "api-version": "2023-03-15-preview",
            },
        },
    });
}
export async function preparedTableOfContents() {
    const adaModel = new OpenAIApi(getConfig("text-embedding-ada-002"));
    const gpt4Model = new OpenAIApi(getConfig("gpt4"));
    const eventsEmbeddings = await adaModel.createEmbedding({
        model: "text-embedding-ada-002",
        input: "Gib mir ein Inhaltsverzeichnis über deine Daten.",
    });
    const queryInhaltsverzeichnisEmbedding = eventsEmbeddings.data.data[0].embedding;
    const sourceData = JSON.parse(chunks);
    const rankedResults = sourceData.sort((a, b) => cosineSimilarity(queryInhaltsverzeichnisEmbedding, b.embedding) -
        cosineSimilarity(queryInhaltsverzeichnisEmbedding, a.embedding));
    // TODO: limit results by available tokens
    const topResults = rankedResults.slice(0, 8);
    const inhaltsverzeichnensRaw = topResults.map((result) => `${result.title}\n${result.content}\n${result.link}\n`);
    const tableOfContent = await gpt4Model.createChatCompletion({
        model: "gpt4",
        max_tokens: 50,
        messages: [
            {
                role: "system",
                content: "You are an AI assistant that helps people find information.",
            },
            {
                role: "system",
                content: "Use the given article excerpts to answer the questions below." +
                    "\nArticles\n" +
                    inhaltsverzeichnensRaw.join("\n"),
            },
            {
                role: "user",
                content: "Welche Daten hast du, gebe nur Infos aus die deiner Meinung nach auch Suchanfragen sind. " +
                    "Die Suchanfragen werden in einer Autovervollständigung verwendet" +
                    "Gib ausschließlich sinnvolle Keywords aus" +
                    "Bitte gebe mir die Menge an Worten kommasepariert aus: ",
            },
        ],
    });
    return Promise.resolve(tableOfContent.data.choices[0].message?.content.split(', ') ?? []);
}

export async function gptRequest(prompt) {
    const adaModel = new OpenAIApi(getConfig("text-embedding-ada-002"));
    const embeddingResponse = await adaModel.createEmbedding({
        model: "text-embedding-ada-002",
        input: prompt,
    });
    const queryEmbedding = embeddingResponse.data.data[0].embedding;
    const sourceData = JSON.parse(chunks);
    const rankedResults = sourceData.sort((a, b) => cosineSimilarity(queryEmbedding, b.embedding) -
        cosineSimilarity(queryEmbedding, a.embedding));
    // TODO: limit results by available tokens
    const topResults = rankedResults.slice(0, 8);
    const articles = topResults.map((result) => `${result.title}\n${result.content}\n${result.link}\n`);
    const gpt4Model = new OpenAIApi(getConfig("gpt4"));
    const newKeywordsPromise = gpt4Model.createChatCompletion({
        model: "gpt4",
        max_tokens: 50,
        messages: [
            {
                role: "user",
                content: "Suche mir alle Nomen aus dem Text raus die deiner Meinung nach auch Keywords sind. Bitte gebe mir die Liste kommasepariert aus: " +
                    "\nArticles\n" +
                    articles.join("\n"),
            }
        ]
    });
    const completion = await gpt4Model.createChatCompletion({
        model: "gpt4",
        messages: [
            {
                role: "system",
                content: "You are an AI assistant that helps people find information.",
            },
            {
                role: "system",
                content: "Use the given article excerpts to answer the questions below." +
                    "\nArticles\n" +
                    articles.join("\n"),
            },
            {
                role: "user",
                content: prompt,
            },
        ],
    });
    const resultMessage = completion.data.choices[0].message?.content;
    // console.log(resultMessage);
    const newKeywords = await newKeywordsPromise;
    const newKeywordsArray = newKeywords.data.choices[0].message?.content.split(', ');
    // console.log(newKeywordsArray);
    return Promise.resolve({ resultMessage: resultMessage, keywords: newKeywordsArray });
}

