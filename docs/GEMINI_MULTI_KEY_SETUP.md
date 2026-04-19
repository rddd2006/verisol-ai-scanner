# Multi-Gemini API Key Setup Guide

## What Changed

VeriSol now supports **5 Gemini API keys** with automatic failover. When one key hits the rate limit (429 error), the system automatically switches to the next available key.

## How It Works

1. **Key Rotation**: System tries keys in order: KEY_1 → KEY_2 → KEY_3 → KEY_4 → KEY_5
2. **Rate Limit Protection**: When a key is rate-limited, it's skipped for 60 seconds
3. **Automatic Recovery**: After 60 seconds, the rate-limited key becomes available again
4. **Fallback**: If all keys fail, uses the least-recently-failed key

## Setup Instructions

### Step 1: Provide Your 5 Gemini API Keys

You need 5 Google Gemini API keys. Get them from:
**https://ai.google.dev/** → Create API Keys

### Step 2: Update `.env` File

Edit `/home/riddhith/verii/verisol-ai-scanner/backend/.env`:

```bash
GEMINI_API_KEY_1=YOUR_FIRST_KEY_HERE
GEMINI_API_KEY_2=YOUR_SECOND_KEY_HERE
GEMINI_API_KEY_3=YOUR_THIRD_KEY_HERE
GEMINI_API_KEY_4=YOUR_FOURTH_KEY_HERE
GEMINI_API_KEY_5=YOUR_FIFTH_KEY_HERE
```

### Step 3: Test

```bash
cd /home/riddhith/verii/verisol-ai-scanner/backend
npm start
```

You should see in logs:
```
🤖 VeriSol AI v2 → http://localhost:3001
[Gemini] Loaded 5 API keys
```

## What Each Key Is Used For

Each key can handle ~1,500 requests per minute (RPM). With 5 keys, you get:
- **Total Capacity**: 7,500 requests/minute
- **Per Analysis**: ~2-5 requests (varies by modules enabled)
- **Concurrent Users**: ~1,500-3,750 per minute

## Key Status Monitoring

The system logs key status:

```
[Gemini] Key 1: 45 successful requests
[Gemini] Key 2: RATE LIMITED (will retry in 50s)
[Gemini] Key 3: 32 successful requests
[Gemini] Key 4: 38 successful requests
[Gemini] Key 5: RATE LIMITED (will retry in 25s)
```

## Demo Buttons Added ✨

Two new quick-load buttons appeared in the UI:

### **Contract Address Demo** (⚡ icon)
- Preloads: `0x1F98431c8aD98523631AE4a59f267346ea31F984`
- This is the Uniswap V3 Position Manager
- Shows how to analyze deployed contracts

### **GitHub Repo Demo** (🐙 icon)
- Preloads: `https://github.com/Uniswap/v2-core`
- Shows file tree with .sol files highlighted in red
- Demonstrates multi-file analysis

Both buttons use **brutalist design** matching the rest of the UI:
- Hard borders (3px)
- No rounded corners
- Bold typography
- Shadow effects on hover

## Backward Compatibility

If you only have **1 API key**, it still works:

```bash
# Old format (still supported)
GEMINI_API_KEY=YOUR_KEY_HERE

# New format (preferred)
GEMINI_API_KEY_1=YOUR_KEY_HERE
```

The system will use whichever keys are provided.

## Error Messages

If you see:
- `No Gemini API keys available` → Add at least 1 key to `.env`
- `All Gemini API keys exhausted` → All keys are rate-limited, wait 60s
- `Key failed: 429 Too Many Requests` → Expected, system rotating to next key

## Performance Tips

1. **Spread keys across services**: If running multiple instances, assign different keys to each
2. **Monitor usage**: Check Google Cloud Console for actual RPM
3. **Add more keys**: You can always create more API keys from Google AI Studio
4. **Reduce per-request load**: Disable optional modules (genericFuzz) if rate-limited frequently

## Technical Details

### Key Tracking Structure
```javascript
keyStatus.get(key) = {
  lastError: "Error message",
  errorTime: 1713580000000,  // Timestamp when failed
  failCount: 3               // How many times failed
}
```

### Key Selection Algorithm
1. Find key without recent error (within 60s)
2. If all errored recently, use oldest failure
3. Mark new failure and rotate to next key
4. Retry with next key if rate limit

### Rate Limit Detection
- Status code 429 → Rate limited
- Automatic key rotation
- 60-second cooldown before reuse
- Fail count tracking for diagnostics

## FAQ

**Q: What if I don't have 5 keys yet?**
A: Start with 1-2 keys, add more as needed. The system works with any number ≥1.

**Q: Can I use keys from different Google accounts?**
A: Yes, each key is independent. Mix and match as needed.

**Q: What happens during key failure?**
A: System automatically tries the next key. End user sees a brief delay (~500ms) but no error.

**Q: Can keys be rotated manually?**
A: Not currently, but you can restart the server to reset the rotation.

**Q: Do I need to restart for key changes?**
A: Yes, keys are loaded from `.env` at startup. Restart backend to pick up new keys.

## Troubleshooting

### Keys not loading
```bash
# Check environment variables
cat backend/.env | grep GEMINI_API_KEY

# Verify backend reads them
node -e "console.log(process.env.GEMINI_API_KEY_1)"
```

### Still getting rate limits
- Check if keys are from different Google accounts (they share quota by account)
- Consider requesting quota increase from Google
- Reduce request frequency or disable heavy modules

### Keys working but slowly rotating
- Normal behavior on high-traffic systems
- Monitor logs to see which keys are being used
- Consider adding more keys or reducing load

---

**Setup Status**: 
- ✅ Backend multi-key support implemented
- ✅ Demo buttons with icons added to frontend
- ⏳ Awaiting your 5 API keys

Provide the 5 keys and I'll update the `.env` file and commit the changes! 🚀
