# echoe-connect

Every night, your own coding agent reads the day's Claude Code or Codex transcripts, writes a handful of lines about what you built and how you like to work, and sends only those lines to your Echoe. Your twin wakes up knowing what you did today.

## Install

```
npx echoe-connect <TOKEN>
```

Your token is on your Echoe's agent page. That one command detects `claude` or `codex`, writes `~/.echoe/config.json`, installs a nightly 22:00 cron job, and runs the first sync so you can see what it sends.

For a schedule that survives npm clearing its cache, install it properly with `npm i -g echoe-connect` and run the command again. On Windows it prints the equivalent `schtasks` line instead of installing anything. Options: `--at 07:30`, `--host`, `--db`, and `--now false` to skip the first run.

## Or paste this into Claude Code or Codex

> Run `npx echoe-connect <TOKEN>` in this shell. It installs a nightly 22:00 cron that summarises my coding day with you and sends only those few lines to my Echoe. Then run `crontab -l | grep echoe-connect` and show me the line. Do not read, change, or send anything else.

## Privacy

Your transcripts never leave the machine. They are read, stripped of tool calls, tool output, file contents and thinking, and handed to the agent you already have installed. Only the bullets that agent writes are sent, at most twelve a night, and any line that looks like a key, token, password or path is dropped before it goes. There is no API key here because there is no model of ours in the loop.

The last thing sent is always in `~/.echoe/last.txt`, and every run appends one line to `~/.echoe/sync.log`.

## Check on it, or stop it

```
npx echoe-connect --status   # config, the cron line, recent runs
npx echoe-connect --sync     # run one now
npx echoe-connect --remove   # delete the cron job and the config
```
