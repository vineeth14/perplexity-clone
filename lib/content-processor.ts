/**
 * Process raw HTML/text content into clean, meaningful text for AI context
 * @param rawContent - Raw HTML or text content from web page
 * @returns Clean text content, truncated to ~300 characters
 */
export function processRawContent(rawContent: string): string {
  if (!rawContent || typeof rawContent !== "string") {
    return "";
  }

  // Strip HTML tags using regex
  let cleaned = rawContent.replace(/<[^>]*>/g, " ");

  // Decode common HTML entities
  cleaned = cleaned
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");

  // Normalize whitespace
  cleaned = cleaned
    .replace(/\s+/g, " ") // Multiple spaces to single space
    .replace(/\n\s*\n/g, "\n") // Multiple newlines to single newline
    .trim();

  // Remove special characters but keep basic punctuation
  cleaned = cleaned.replace(/[^\w\s.,!?;:()\-'"]/g, "");

  // Truncate to approximately 300 characters at a sentence boundary
  const maxLength = 300;
  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  // Try to truncate at a sentence boundary
  const truncated = cleaned.slice(0, maxLength);
  const lastPeriod = truncated.lastIndexOf(".");
  const lastQuestion = truncated.lastIndexOf("?");
  const lastExclamation = truncated.lastIndexOf("!");

  const lastSentenceEnd = Math.max(lastPeriod, lastQuestion, lastExclamation);

  if (lastSentenceEnd > maxLength * 0.8) {
    // If we found a sentence ending in the last 20%, use it
    return truncated.slice(0, lastSentenceEnd + 1).trim();
  }

  // Otherwise, truncate at the last space
  const lastSpace = truncated.lastIndexOf(" ");
  if (lastSpace > 0) {
    return truncated.slice(0, lastSpace).trim() + "...";
  }

  return truncated.trim() + "...";
}
