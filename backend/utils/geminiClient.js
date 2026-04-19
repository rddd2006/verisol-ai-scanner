"use strict";

/**
 * geminiClient.js
 *
 * Multi-API adapter supporting:
 * - OpenRouter (OpenAI-compatible chat API)
 * - Google Gemini (native API)
 */

const OPENROUTER_URL = "https://openrouter.io/api/v1/chat/completions";
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models";

// Multi-key Gemini support with automatic failover
const GEMINI_API_KEYS = [
  process.env.GEMINI_API_KEY_1,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
  process.env.GEMINI_API_KEY_4,
  process.env.GEMINI_API_KEY_5,
].filter(Boolean); // Remove undefined keys

// Fallback: Single key for backward compatibility
if (GEMINI_API_KEYS.length === 0 && process.env.GEMINI_API_KEY) {
  GEMINI_API_KEYS.push(process.env.GEMINI_API_KEY);
}

// Track key health (when they hit rate limits)
const keyStatus = new Map(); // key -> { lastError, errorTime, failCount }
let currentKeyIndex = 0;

function getNextValidGeminiKey() {
  if (GEMINI_API_KEYS.length === 0) return null;
  
  // Find a key that hasn't failed recently (within last 60 seconds)
  const now = Date.now();
  for (let attempts = 0; attempts < GEMINI_API_KEYS.length; attempts++) {
    const key = GEMINI_API_KEYS[currentKeyIndex];
    const status = keyStatus.get(key);
    
    if (!status || now - status.errorTime > 60000) {
      // Key is good or error is old enough
      return key;
    }
    
    // Try next key
    currentKeyIndex = (currentKeyIndex + 1) % GEMINI_API_KEYS.length;
  }
  
  // All keys are rate limited, use the least recently failed
  let bestKey = GEMINI_API_KEYS[0];
  let oldestError = Infinity;
  for (const key of GEMINI_API_KEYS) {
    const status = keyStatus.get(key);
    if (!status || status.errorTime < oldestError) {
      bestKey = key;
      oldestError = status?.errorTime || 0;
    }
  }
  return bestKey;
}

function markKeyFailure(key, error) {
  const status = keyStatus.get(key) || { failCount: 0 };
  status.lastError = error;
  status.errorTime = Date.now();
  status.failCount = (status.failCount || 0) + 1;
  keyStatus.set(key, status);
  
  console.warn(
    `[Gemini] Key failed (attempt ${status.failCount}): ${error.message?.substring(0, 50)}...`
  );
  
  // Move to next key for next attempt
  currentKeyIndex = (currentKeyIndex + 1) % GEMINI_API_KEYS.length;
}

// Detect which API is available and configured
const hasOpenRouter = !!process.env.OPENAI_API_KEY;
const hasGemini = GEMINI_API_KEYS.length > 0;

const MODEL      = process.env.OPENAI_MODEL      || "openai/gpt-4o-mini";
const MODEL_FAST = process.env.OPENAI_MODEL_FAST || process.env.OPENAI_MODEL || "openai/gpt-4o-mini";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const GEMINI_MODEL_FAST = process.env.GEMINI_MODEL_FAST || GEMINI_MODEL;

/**
 * One-shot text generation.
 * Automatically selects OpenRouter or Gemini based on configured keys.
 * @param {string}  prompt
 * @param {object}  opts
 * @param {boolean} [opts.fast=false]
 * @param {number}  [opts.maxTokens=2048]
 * @param {number}  [opts.retries=2]
 * @returns {Promise<string>}
 */
async function generate(prompt, opts = {}) {
  const { fast = false, maxTokens = 2048, retries = 2 } = opts;

  if (!hasOpenRouter && !hasGemini) {
    throw new Error("Neither OPENAI_API_KEY (OpenRouter) nor GEMINI_API_KEY is set in backend/.env");
  }

  // Prefer Gemini if available (more reliable and cost-effective)
  if (hasGemini) {
    return generateGemini(prompt, { fast, maxTokens, retries });
  } else {
    return generateOpenRouter(prompt, { fast, maxTokens, retries });
  }
}

/**
 * Generate using OpenRouter (OpenAI-compatible API)
 */
async function generateOpenRouter(prompt, { fast, maxTokens, retries }) {
  const key = process.env.OPENAI_API_KEY;
  const model = fast ? MODEL_FAST : MODEL;

  const body = {
    model,
    messages: [{ role: "user", content: prompt }],
    max_tokens: maxTokens,
    temperature: 0.1,
  };

  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const res = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${key}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost:3001",
          "User-Agent": "VeriSol-AI-Scanner/2.0",
        },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(formatAPIError("OpenRouter", res.status, data));
      }

      const text = extractOpenRouterText(data);
      if (!text) throw new Error("OpenRouter response did not include output text");
      return text;
    } catch (err) {
      lastErr = err;
      if (!isRetryableError(err) || attempt === retries) break;
      await delay(1000 * (attempt + 1));
    }
  }

  throw lastErr;
}

/**
 * Generate using Google Gemini with multi-key failover
 */
async function generateGemini(prompt, { fast, maxTokens, retries }) {
  const model = fast ? GEMINI_MODEL_FAST : GEMINI_MODEL;

  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature: 0.1,
    },
  };

  let lastErr;
  let keyAttempts = 0;
  
  // Try each key with retries
  while (keyAttempts < GEMINI_API_KEYS.length) {
    const key = getNextValidGeminiKey();
    if (!key) {
      throw new Error("No Gemini API keys available");
    }

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        const url = `${GEMINI_URL}/${model}:generateContent?key=${key}`;
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });

        const data = await res.json().catch(() => ({}));
        
        if (!res.ok) {
          const error = new Error(formatAPIError("Gemini", res.status, data));
          
          // Rate limit error? Try next key
          if (res.status === 429) {
            markKeyFailure(key, error);
            keyAttempts++;
            break; // Break inner loop, try next key
          }
          
          throw error;
        }

        // Success! Reset error tracking for this key
        const status = keyStatus.get(key);
        if (status) {
          status.failCount = 0;
          status.errorTime = 0;
        }

        const text = extractGeminiText(data);
        if (!text) throw new Error("Gemini response did not include output text");
        return text;
      } catch (err) {
        lastErr = err;
        
        // Don't retry on rate limit with this key
        if (err.message?.includes("429")) {
          markKeyFailure(key, err);
          keyAttempts++;
          break; // Try next key
        }
        
        // Retry with same key if retries remain
        if (!isRetryableError(err) || attempt === retries) {
          keyAttempts++;
          break; // Try next key
        }
        
        await delay(1000 * (attempt + 1));
      }
    }
  }

  throw lastErr || new Error("All Gemini API keys exhausted");
}

/**
 * Generate and parse a JSON response.
 * Retries once with an error message if the first parse fails.
 * @param {string} prompt
 * @param {object} opts
 * @returns {Promise<object>}
 */
async function generateJSON(prompt, opts = {}) {
  const fullPrompt =
    prompt +
    "\n\nIMPORTANT: Respond with ONLY a valid JSON object. No markdown, no code fences, no prose before or after.";

  let raw = await generate(fullPrompt, opts);
  raw = stripJsonFences(raw);

  try {
    return JSON.parse(raw);
  } catch (firstErr) {
    const fixPrompt =
      `You returned invalid JSON:\n${raw.substring(0, 500)}\n\nError: ${firstErr.message}\n\nReturn ONLY the corrected JSON object.`;
    let raw2 = await generate(fixPrompt, { fast: true, maxTokens: opts.maxTokens ?? 2048 });
    raw2 = stripJsonFences(raw2);
    return JSON.parse(raw2);
  }
}

/**
 * Compatibility shim for older callers. Current codebase does not use chat.
 */
function startChat(systemInstruction) {
  const history = [];
  return {
    async sendMessage(message) {
      const prompt = `${systemInstruction || ""}\n\n${history.join("\n\n")}\n\nUSER:\n${message}`;
      const text = await generate(prompt);
      history.push(`USER:\n${message}`, `ASSISTANT:\n${text}`);
      return { response: { text: () => text } };
    },
  };
}

/**
 * Extract text from OpenRouter response (OpenAI format)
 */
function extractOpenRouterText(data) {
  if (Array.isArray(data.choices) && data.choices.length > 0) {
    const choice = data.choices[0];
    if (choice.message?.content) return choice.message.content;
  }
  return null;
}

/**
 * Extract text from Gemini response
 */
function extractGeminiText(data) {
  if (Array.isArray(data.candidates) && data.candidates.length > 0) {
    const candidate = data.candidates[0];
    if (candidate.content?.parts?.[0]?.text) {
      return candidate.content.parts[0].text;
    }
  }
  return null;
}

function stripJsonFences(raw) {
  return raw
    .replace(/^```(?:json)?\s*/im, "")
    .replace(/```\s*$/m, "")
    .trim();
}

function formatAPIError(provider, status, data) {
  const message = data?.error?.message || data?.message || "unknown error";
  const code = data?.error?.code || data?.error?.type || "api_error";
  return `${provider} API error ${status} (${code}): ${message}`;
}

function isRetryableError(err) {
  const msg = String(err?.message || err);
  if (/insufficient_quota|billing|current quota|invalid.*key|unauthorized/i.test(msg)) return false;
  return /\b(408|409|429|500|502|503|504)\b|rate limit|temporarily|timeout|overloaded|too many requests/i.test(msg);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { generate, generateJSON, startChat, MODEL, MODEL_FAST, GEMINI_MODEL, GEMINI_MODEL_FAST };
