# Community features: what exists, what does not, and what it would take

A static website has no server of its own. Anything shared between players needs a backend that somebody
runs, secures and pays attention to. This document says honestly where each feature stands in 4.0.

## Implemented (uses your Firebase Realtime Database)

| Feature | Works in legacy mode | Protected in secure mode |
|---|---|---|
| Online names and presence | Yes | Only the owner can change them |
| Friends, friend codes and requests | Yes | Yes |
| Rooms, parties and one-to-one matches | Yes | Participants only (not yet exercised end to end in secure mode) |
| Ranked and casual leaderboards | Yes | Others' entries cannot be changed; **your own score is still self-reported** |
| Reward codes | Yes | Administrators create them; one redemption per account; **total redemptions not capped** |
| Weekly challenge (University) | Yes: personal only, on the device | Not shared: there is no shared board |

## Not implemented

Teams, study groups, hackathons, competitions with prizes, tournaments with brackets, and any University
leaderboard are **not in this release**. No button or page claims they are.

## Why they are not there, and what each needs

All of them depend on results that other people will trust. That requires three things the site does not have:

1. **Trusted computation.** A server must decide the outcome. Today the player's own browser reports its
   score. Needed: Cloud Functions (Firebase Blaze plan, pay-as-you-go) or a Cloudflare Worker (has a free
   tier) that receives each answer, checks it against an answer key the browser never sees, and writes the
   rating itself. The database rules would then forbid clients writing `lb`, `matches/*/result` and reward
   redemptions entirely.
2. **Real identities.** Anonymous accounts are free to create in any number. Fair competitions need verified
   email at least, and rate limits per account and per address.
3. **Moderation and privacy.** Teams and groups mean user-written names and messages visible to others,
   which means reporting, blocking, removal, a named person who responds, and, if students are minors,
   legal duties that vary by country. Administrators should see only what moderation needs; private
   conversations should not be readable by them, and this design keeps it that way by not storing any.

### Suggested order, if you decide to build it

1. Server-validated match results and ratings (removes the largest integrity gap).
2. Server-side reward redemption with a real redemption cap.
3. Teams as a small extension of friends (membership list, combined rating), behind verified email.
4. Scheduled competitions and tournaments on top of 1 and 3.

Each step is a backend project with its own tests and running costs. None should be switched on for real
users before step 1 exists.
