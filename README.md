# WHYspace — AI Chatbot UI/UX

## Product idea

WHYspace is a calm, curious AI chatbot designed to help people ask better **“why?”** questions. The experience should feel thoughtful, friendly, and uncluttered—not technical or overwhelming.

## Visual direction

- **Style:** spacious, soft, intelligent, and human
- **Palette:** deep navy `#101828`, electric violet `#7C5CFC`, sky blue `#55C7F7`, warm white `#F8FAFC`, muted slate `#667085`
- **Typography:** Inter or Plus Jakarta Sans; large, confident headings and highly readable chat text
- **Shape language:** rounded cards, pill buttons, subtle borders, gentle shadows
- **Motion:** short fade and slide transitions; an animated three-dot “thinking” indicator; respect reduced-motion preferences

## Primary screen

### Desktop layout

1. **Left sidebar (260px)**
	- WHYspace logo and wordmark
	- `New conversation` primary button
	- Search conversations
	- Recent chats grouped by Today, Yesterday, and Earlier
	- Bottom: Settings, Help, and user profile menu
2. **Main chat area**
	- Top bar: conversation title, rename action, share action, and overflow menu
	- Centered welcome state when empty
	- Scrollable message stream
	- Fixed composer at the bottom
3. **Optional insight panel (desktop only)**
	- Collapsible “Explore further” panel with suggested follow-up questions, sources, and saved answers

### Mobile layout

- Sidebar becomes a slide-over drawer opened by a menu button.
- Keep the chat full width with a sticky top bar and composer.
- Move share, rename, and delete actions into the overflow menu.

## Empty state

```text
			 WHYspace
	Ask better questions. Go deeper.

	[ Why do habits shape identity? ]

	Try asking:
	[Explain a complex idea] [Help me decide]
	[Challenge my assumptions] [Explore a topic]
```

Use a subtle orbit/spark illustration, not a distracting mascot. The input is the visual focus.

## Chat experience


## Composer

```text
[ + ]  Ask WHYspace anything...                         [↑]
		 Attach file   Voice input   Model: Balanced
```
- Provide a helpful empty-input hint and an upload progress state.

## Onboarding

1. Welcome: “What are you curious about?”
2. Let users choose a focus: Learn, Create, Decide, or Reflect.
3. Explain privacy and conversation history in one concise screen.
4. Start with a suggested prompt; never require a long setup.

## Accessibility and trust

- Meet WCAG AA contrast requirements and support keyboard navigation throughout.
- Use semantic landmarks, labels, live regions for streamed responses, and screen-reader-friendly status messages.
- Never rely on color alone for state or errors.
- Make data controls discoverable: export, delete, history toggle, and clear conversation.
- Show sources when browsing is used and distinguish generated content from retrieved content.

## Core interaction states

- Empty, typing, generating, stopped, error, offline, upload progress, and rate limited.
- Errors should explain what happened and offer a next action: `Try again`, `Edit prompt`, or `Start a new chat`.
- Preserve typed text if a request fails.

## Suggested microcopy

- Welcome: **“Curiosity starts with why.”**
- New chat: **“What would you like to understand?”**
- Follow-up: **“Want to go one level deeper?”**
- Empty history: **“Your next good question belongs here.”**

## Success criteria

- A new user can send their first prompt in under 30 seconds.
- The current conversation and next action are always obvious.
- Long answers remain scannable through headings, spacing, and citations.
- Every destructive or privacy-related action is explicit, reversible where possible, and easy to find.
