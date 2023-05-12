function dotProduct(a, b) {
    return a.reduce((acc, value, index) => acc + value * b[index], 0);
}
function vectorLength(a) {
    return Math.sqrt(a.reduce((acc, value) => acc + value * value, 0));
}
export function cosineSimilarity(embeddingA, embeddingB) {
    const dotProductValue = dotProduct(embeddingA, embeddingB);
    const lengthA = vectorLength(embeddingA);
    const lengthB = vectorLength(embeddingB);
    return dotProductValue / (lengthA * lengthB);
}
