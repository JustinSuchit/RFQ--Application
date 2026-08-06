This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Supabase Storage

Create a private Supabase Storage bucket named `rfq-email-attachments`.
Attachment files are stored under:

`organizations/{organization_id}/emails/{email_message_id}/{attachment_id}-{file_name}`

## Optional Local Ollama RFQ Assist

The attachment pipeline can optionally ask a local Ollama model to extract RFQ item rows from text that was already produced by `pdf-parse` or image OCR. This does not replace PDF extraction or OCR; it only helps structure messy extracted text before pending items are inserted for review.

1. Install and start Ollama locally.
2. Pull a model, for example:

```bash
ollama pull llama3.1:8b
```

3. In `.env.local`, set:

```bash
OLLAMA_ENABLED=true
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3.1:8b
OLLAMA_RFQ_ASSIST_MODE=when_empty
```

`OLLAMA_RFQ_ASSIST_MODE=when_empty` keeps the current deterministic parser as the primary extractor and only asks Ollama when no item rows are found. Use `always` if you want Ollama to add candidates alongside the parser on every extraction.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
