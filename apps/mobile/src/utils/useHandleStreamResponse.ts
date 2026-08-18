import React from 'react';

interface UseHandleStreamResponseProps {
	onChunk: (content: string) => void;
	onFinish: (content: string) => void;
}

export function useHandleStreamResponse({ onChunk, onFinish }: UseHandleStreamResponseProps) {
	const handleStreamResponse = React.useCallback(
		async (response: Response) => {
			// expo/fetch's Response.body isn't reliably a readable stream on every
			// native runtime (notably Expo Go) — when it's missing/unreadable, the
			// old code just returned silently, leaving onFinish never called and
			// the caller stuck in a permanent "loading" state. Fall back to a
			// single non-streamed read so the advisor always resolves either way.
			const reader = response.body?.getReader?.();
			if (!reader) {
				const text = await response.text();
				onChunk(text);
				onFinish(text);
				return;
			}

			try {
				const decoder = new TextDecoder();
				let content = '';
				while (true) {
					const { done, value } = await reader.read();
					if (done) {
						onFinish(content);
						break;
					}
					const chunk = decoder.decode(value, { stream: true });
					content += chunk;
					onChunk(content);
				}
			} catch (err) {
				console.error('Stream read failed, no partial content recovered:', err);
				onFinish('Something went wrong reaching the advisor. Try again in a moment.');
			}
		},
		[onChunk, onFinish]
	);
	return handleStreamResponse;
}

export default useHandleStreamResponse;
