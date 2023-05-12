import "dotenv/config";
import got, { HTTPError, RequestError } from "got";
import { load } from "cheerio";
import { writeFile } from "node:fs/promises";
import { encode } from "gpt-3-encoder";
Error.stackTraceLimit = 3;
const token = process.env.AZ_TOKEN;
if (!token) {
    throw new Error("No token provided");
}
const spClient = got.extend({
    prefixUrl: "https://lise2.sharepoint.com",
    headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json;odata=nometadata",
    },
    hooks: {
        beforeError: [
            (error) => {
                if (error instanceof HTTPError) {
                    const { statusCode, statusMessage, url, body } = error.response;
                    error.message = `HTTP Error: ${statusCode} - ${statusMessage}\n\nURL: ${url}\n\nResponse: ${JSON.stringify(JSON.parse(body), null, 3)}`;
                }
                else if (error instanceof RequestError) {
                    error.message = `Request Error: ${error.message}`;
                }
                // remove irrelevant properties
                // @ts-expect-error
                delete error.options;
                // @ts-expect-error
                delete error.timings;
                delete error.input;
                // @ts-expect-error
                delete error.code;
                return error;
            },
        ],
    },
});
const pageContentType = "0x0101009D1CB255DA76424F860D91F20E6C4118006F93D9628153AD4096B45E09F378D2FD00B75336EAAD10DE41B2006584B883265B";
const knowledgeBaseResponse = await spClient(`sites/KnowledgeBase/_api/web/lists/GetByTitle('Site Pages')/items?$select=ContentTypeId,FileRef,CanvasContent1,Title,Modified&$expand=Folder&$top=1000&$filter=ContentTypeId eq '${pageContentType}'`);
const rootPagesResponse = await spClient(`_api/web/lists/GetByTitle('Site Pages')/items?$select=ContentTypeId,FileRef,CanvasContent1,Title,Modified&$expand=Folder&$top=1000`);
const pagesKnowledgeBase = JSON.parse(knowledgeBaseResponse.body)
    .value;
const pagesRoot = JSON.parse(rootPagesResponse.body).value;
const pagesCount = pagesKnowledgeBase.length + pagesRoot.length;
console.log(`Found ${pagesCount} pages`);
const chunkedPages = [
    ...createChunkedPages([...pagesKnowledgeBase, ...pagesRoot]),
];
console.log(chunkedPages);
console.log(`Found ${chunkedPages.length} chunks (max 800 tokens) from ${pagesCount} pages`);
await writeFile("./data/sp-data.json", JSON.stringify(chunkedPages, null, 2));
function* createChunkedPages(pages, maxChunkTokens = 600) {
    for (const page of pages) {
        if (!page.CanvasContent1)
            continue;
        const parsed = parseContent(page);
        const chunks = splitContent(parsed.content, maxChunkTokens);
        for (const chunk of chunks) {
            yield {
                ...parsed,
                content: chunk,
                tokens: countTokens(chunk),
            };
        }
    }
}
function* splitContent(content, maxTokens = 800) {
    const paragraphs = content.split(/(?=<h2|<p|<div|<\/h2|<\/p|<\/div)/);
    let currentChunk = "";
    let currentTokens = 0;
    for (const paragraph of paragraphs) {
        const paragraphTokens = countTokens(paragraph);
        if (currentTokens + paragraphTokens <= maxTokens) {
            currentChunk += paragraph;
            currentTokens += paragraphTokens;
        }
        else {
            yield currentChunk;
            currentChunk = paragraph;
            currentTokens = paragraphTokens;
        }
    }
    if (currentChunk) {
        yield currentChunk;
    }
}
function parseContent(page) {
    const rawContent = page.CanvasContent1;
    // Remove SharePoint's HTML encoding
    const decodedHtml = rawContent
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&amp;#58;/g, ":")
        .replace(/&amp;#160;/g, " ");
    // Get the content
    const contentRegex = /<div data-sp-rte[^>]*>([\s\S]*?)<\/div>/g;
    const contentArr = [];
    let contentMatch;
    while ((contentMatch = contentRegex.exec(decodedHtml)) !== null) {
        contentArr.push(contentMatch[1]);
    }
    const content = contentArr.join("\n");
    const $ = load(content);
    $("span, em, br, strong, html, body, head").each(function () {
        $(this).replaceWith($(this).contents());
    });
    const finalContent = $.html();
    return {
        content: finalContent,
        link: `https://lise2.sharepoint.com${page.FileRef}`,
        title: page.Title,
        modified: page.Modified,
        tokens: countTokens(finalContent),
    };
}
function countTokens(value) {
    return encode(value).length;
}
