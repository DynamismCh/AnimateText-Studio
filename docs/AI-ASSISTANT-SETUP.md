# AnimateText Studio AI assistant setup

The in-app assistant uses Google's Gemini Developer API. The API key is kept on the Vercel server and is not placed in the frontend bundle or committed to GitHub.

## 1. Create a key

1. Open [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Sign in and create an API key for the Gemini Developer API.
3. Do not paste the key into the app's chat, a source file, or a GitHub issue.

Google lists free-tier access for eligible Gemini models, but usage limits and model availability can change. Check the current [Gemini API pricing and free-tier details](https://ai.google.dev/gemini-api/docs/pricing).

## 2. Add it to Vercel

1. Open the [AnimateText Studio project in Vercel](https://vercel.com/nyikochauke084-3326/animate-text-studio).
2. Open **Settings → Environment Variables**.
3. Add a variable named `GEMINI_API_KEY` and paste the key as its value.
4. Select **Production** (and Preview if you want the assistant on preview deployments).
5. Save the variable and redeploy the latest deployment.

The default model is `gemini-3.5-flash`. If Google changes model availability for your account, you can set `GEMINI_MODEL` in Vercel to a currently available text model that your key can access.

## 3. Test it

1. Open the production app: https://animate-text-studio.vercel.app/
2. Scroll to **Studio assistant**.
3. Ask it to plan a Sunny and Bloop scene or explain an error.
4. If generation fails, choose **Diagnose latest error**.
5. If you need help in a separate conversation, click **Export diagnostics** and share the downloaded JSON report. It contains the current status, prompt, browser information, and recent errors, but not character image bytes or API keys. Review the report before sharing it.

## Free usage and safety

- The assistant is separate from WAN 2.2 video generation. A free Gemini quota does not increase WAN's free GPU quota.
- The API endpoint limits requests to 12 messages per hour per server instance/IP as a basic safeguard. Serverless limits are best-effort, not a full authentication system.
- Never commit `.env` files or API keys. Rotate the key immediately if it is accidentally exposed.
- The assistant receives only the app status, motion prompt, selected character name, and chat messages needed to help. It does not automatically see the live browser screen or read private GitHub/Vercel logs.
