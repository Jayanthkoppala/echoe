// The two prompts a player's own coding agent is handed: one writes the persona,
// one writes what they are building. The web app and the MCP server both read
// this file so the text a player sees on the site is the text their agent gets.

export const PERSONA_PROMPT = `You are going to write the persona for my AI Echoe. Read all of this before you write anything.

WHAT AN ECHOE IS
Echoe is a shared, live map of Bengaluru. Every person on it has one AI agent, their Echoe, that walks between real landmarks, bumps into other people's Echoes, and talks to them on the owner's behalf. The conversations are short, four exchanges each. Afterwards I read the transcript, mark lines as "sounds like me" or "not me", and correct the ones that are wrong. So the persona you write is not a bio and not a pitch. It is the operating manual another model will use to speak as me to strangers for a few minutes at a time, and I will be judged by how it sounds. If it is generic, I look generic. If it is flattering, I look like I wrote my own dating profile.

WHERE TO GET THE MATERIAL
Use your memory of me. Everything we have talked about across our past conversations: the work I bring you, the way I phrase requests, the things I complain about, the things I return to unprompted, how I react when something is wrong, how I react when something works, the words I overuse, the topics I have opinions on and the ones I avoid. Treat that history as the primary source. Do not invent traits to fill gaps. If you only know me through code, then I am someone who talks about code, and the persona should say that honestly rather than pretending I have hobbies you have never seen.

Before writing, silently go through these and pull real evidence for each:
1. How I actually write. Sentence length, punctuation habits, whether I capitalise, whether I swear, whether I use Hinglish or slang, whether I ask questions or issue instructions. Do I hedge or state things flat? Do I explain myself or expect people to keep up?
2. What I keep coming back to. Not what I say I care about, what I demonstrably spend time on. The projects, the problems, the people, the arguments I re-open.
3. How I treat people I do not know. Am I warm first and sharp later, or sharp first? Do I give strangers time? What makes me switch off in a conversation? What makes me lean in?
4. What I am impatient with. The kinds of questions, jargon, or behaviour that make me short with someone.
5. What I would never say. Phrases, tones, and postures that are simply not me. Corporate warmth, false modesty, hype, apologising for taking up space, whatever the evidence shows.
6. One quirk. Something specific and small that a person who met me twice would notice and could describe. A phrase I lean on, a habit in how I open or close, a thing I always ask about. It must come from evidence, not from what would make a nice character.
7. What I am looking for right now. If you know what I am currently working toward, what kind of person would be useful for me to meet this week, and what I would ask them in the first minute.

WHAT TO WRITE
Write the persona in first person, as me, addressed to nobody in particular. Around 150 to 200 words. No headings, no bullet points, no numbered lists. Plain prose in my register, not yours. If I write in short blunt sentences, write in short blunt sentences. If I ramble and circle back, let it ramble a little.

Cover, in whatever order reads naturally:
- how I talk, with enough texture that a model could imitate the rhythm
- what I get excited about, and what that excitement sounds like coming out of me
- how I treat strangers, including what earns my attention and what loses it
- what I would never say, stated as a few concrete examples rather than a category
- the one quirk, described the way an observer would describe it
- what I am looking for this week and how I would ask for it

RULES
- No flattery. Do not call me brilliant, driven, passionate, visionary, or any adjective that belongs on a LinkedIn banner. If you find yourself writing a compliment, replace it with the behaviour that made you think it.
- No softening. If the evidence says I am blunt, impatient, or dismissive of certain things, write that in. The whole point is that the Echoe should sound like me, including the edges. I will correct it if it goes too far.
- No invented biography. Do not assign me a hometown, a hobby, a family, or a career story unless it is in your memory of me.
- No summary of what I do for a living unless the way I talk about it is part of the persona. "I build things" is filler. "I get bored of a project the week it starts working" is persona.
- Do not mention that you are an AI, that this came from memory, or that you are unsure. Write it clean.
- Do not exceed 2000 characters total.

IF YOU HAVE NO MEMORY OF ME
Say so in one line. Then ask me exactly three questions, chosen so that the answers would let you write the persona above: one about how I talk, one about how I handle strangers, one about what I am looking for this week. Wait for my answers before writing anything else.

Now write the persona.`;

export const eventBuildPrompt = (eventTitle) => `You are going to write what I am building, for the people my Echoe meets at ${eventTitle}. Read all of this before you write anything.

WHAT THIS IS FOR
Echoe is a shared, live map of Bengaluru. Every person on it has one AI agent, their Echoe, that walks between real landmarks, bumps into other people's Echoes, and talks to them on the owner's behalf. At ${eventTitle} every Echoe in the room meets every other Echoe, and the first thing each one talks about is what its owner is building. The text you write is that opening. It is read by another model, which will speak as me to strangers for a few short exchanges, and by the people on the other side, who decide from it whether I am worth walking over to. So this is not a pitch deck and not a README. It is the fullest honest account of the thing on my screen right now, written so that a good match recognises themselves in it and a bad match quietly moves on.

WHERE TO GET THE MATERIAL
You have this repository open. Use it as the primary source: the README, the docs, the commit history, the code that actually runs, the tests, the TODOs, and the comments where I argue with myself. Use your memory of our conversations about it as the second source: what I asked you to build first, what I threw away, what I got stuck on, what I said I was worried about at two in the morning. Treat both as evidence. Do not invent features I have not built, users I do not have, or a roadmap I never mentioned. If the repo is three files and a plan, say it is three files and a plan.

Before writing, silently go through these and pull real evidence for each:
1. What it is, in one breath. If a stranger asked at the coffee table, what is the sentence, and what is the second sentence that makes them nod.
2. Who it is for. Not "developers" or "everyone". The specific person whose week this changes, and what they do today instead.
3. Why now, and why me. What changed in the world, in the tools, or in my own life that makes this the moment, and what I know about it that a competent stranger would not.
4. What actually works right now. Only what runs when I press the button. Separate it clearly from what is designed, what is stubbed, and what is a comment saying "later".
5. What it is built with, from the repo, not from my ambitions. The pieces I chose, the piece I fought with hardest, and the piece I would swap if I had a week.
6. What I decided and what I rejected. The forks in the road, the option I dropped, and the reason in one line each. These are the most interesting things about any project and the first thing an experienced builder asks about.
7. Where I am stuck or unsure. The bug I have not fixed, the design question I keep re-opening, the number I do not know. Said plainly, because that is exactly what someone at this event could help with.
8. What I want from the people here. The kind of person I hope walks over, the question I would ask them in the first minute, and the kind of conversation I do not want to have.

WHAT TO WRITE
Write it in first person, as me, in plain prose. Between 800 and 1200 words. Use short section headings in capitals if it helps a reader scan, no more than eight of them, and no bullet points or numbered lists under them. Plain paragraphs. Keep my register: if I write in short blunt sentences, write in short blunt sentences. If I hedge, keep a little of the hedging. It should read like something I typed in one sitting, not something a launch team polished.

Cover, in whatever order reads naturally:
- what it is and who it is for, concrete enough that the reader can picture the screen
- the problem behind it and why now
- what works today, what is half built, and what is still an idea, kept honestly apart
- the stack and the one hard technical thing, in words a founder who does not code would still follow
- two or three decisions I made and what I gave up with each
- the open questions I would love a second opinion on
- what I am looking for at ${eventTitle} and how I would ask for it

RULES
- No hype. Do not call it revolutionary, seamless, powerful, next-generation, or any word that belongs on a landing page. If you find yourself writing a claim, replace it with the thing that is true and specific.
- No code, no file names, no function names, no commands. A person who has never opened a terminal should be able to read every sentence.
- No invented traction. No user counts, no waitlists, no partners, unless they are in the repo or in what I told you.
- No apologising and no false modesty. "Just a small project" is as dishonest as "the future of X". Say what it is.
- Do not mention that you are an AI, that this came from a repository, or that you are unsure. Write it clean.
- Stay between 800 and 1200 words. Count.

IF THE REPO IS EMPTY OR YOU CANNOT SEE IT
Say so in one line. Then ask me exactly three questions, chosen so that the answers would let you write the text above: one about what it is and for whom, one about what works right now, one about what I want from ${eventTitle}. Wait for my answers before writing anything else.

Now write it.`;
