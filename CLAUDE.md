# RabbitHole — Project Context

## What It Is
Daily puzzle mobile game. Players trace a path through concept bubbles to connect a Start and End concept. React Native + Expo mobile app backed by Supabase.

## Tech Stack
- Mobile: Expo SDK 54, React Native 0.81.5, expo-router, TypeScript
- Backend: Supabase (Postgres + Auth)
- Build: EAS (profile: `preview` = TestFlight, `development` = dev client)
- Pipeline: Node.js + Wikidata SPARQL + OpenAI for narrative generation

## Key Commands
```bash
cd mobile
npx expo start --dev-client   # run on device (after dev build installed)
npx expo run:ios --device     # build + install via USB
eas build --platform ios --profile preview   # TestFlight build
eas build --platform ios --profile development  # dev client build
npx jest --no-coverage        # run tests
```

## Supabase
- Project URL: https://eaevegumlihsuagccczq.supabase.co
- Migrations: `supabase/migrations/`
- Must be applied manually via Supabase Dashboard → SQL Editor

## Category IDs (Production)
| Name    | ID |
|---------|----|
| History | f003887c-34ab-4a50-b2e3-db96f378cbdd |
| Movies  | 5f522844-78b3-464f-9105-d15a8f746d28 |
| Music   | bf80e8ab-7532-42f4-b717-1dc4b5ca4534 |
| Science | 55dcfe2f-84d7-44d6-9558-97de003c436e |
| Sport   | 945573e5-1c76-4bd3-b2a6-961276e1c224 |

**Starter categories for new users:** Movies + Sport

## Progression System
- XP: Easy=100, Medium=200, Hard=350 base + optimal path bonus (+50) + speed bonus (up to +50) + streak bonus (25×day)
- Level curve: 1-10=400 XP/level, 11-30=1000, 31-50=3000, 51+=5000
- Unlocks: Medium at level 5, Hard at level 12; category slots at 8, 16, 22
- Titles: Curious(1-4), Wanderer(5-9), Explorer(10-14), Deep Diver(15-19), Rabbit(20-29), White Rabbit(30-49), Mad Hatter(50-99), The Rabbit Hole(100+)

## Monetization
- RabbitHole+: $2.99/mo or $19.99/yr
- Free: today's puzzle + 7-day archive, all unlocked categories/difficulties
- Paid: full archive (30+ days) + leaderboard badge
- RevenueCat integration: not yet wired (SubscribeModal is UI-only stub)

## Known Stubs / TODO
- `streakDay` in results screen is hardcoded to `0` — needs real streak value wired in
- `SubscribeModal` onSubscribe handler needs RevenueCat wiring
- Difficulty gating on home screen is display-only (no enforcement on navigation)
