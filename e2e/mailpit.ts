const MAILPIT_URL = 'http://127.0.0.1:54334';

interface MailpitMessage {
	ID: string;
}

interface MailpitMessageDetail {
	Text: string;
	HTML: string;
}

// Local Supabase routes outgoing auth emails to Mailpit instead of sending
// them — this fetches the most recent one for an address, retrying briefly
// since delivery isn't perfectly synchronous with the API call that sent it.
export async function getLatestEmailTo(email: string, timeoutMs = 10_000): Promise<string> {
	const deadline = Date.now() + timeoutMs;

	while (Date.now() < deadline) {
		const searchRes = await fetch(
			`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`
		);
		const searchData = (await searchRes.json()) as { messages: MailpitMessage[] };
		const latest = searchData.messages?.[0];

		if (latest) {
			const messageRes = await fetch(`${MAILPIT_URL}/api/v1/message/${latest.ID}`);
			const message = (await messageRes.json()) as MailpitMessageDetail;
			return message.Text || message.HTML;
		}

		await new Promise((resolve) => setTimeout(resolve, 200));
	}

	throw new Error(`No email arrived for ${email} within ${timeoutMs}ms`);
}

export function extractConfirmUrl(body: string): string {
	const match = body.match(/http:\/\/127\.0\.0\.1:5183\/auth\/confirm\?[^\s"'<>]+/);
	if (!match) {
		throw new Error('No /auth/confirm URL found in email body');
	}
	return match[0];
}
