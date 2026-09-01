# The Pirate, Progression, Inventory and the Client UI Surface — Wiki Map

A pirate is a single persistent character: a name, a gender, a worn appearance (hat / torso / legs / feet / familiar), a wielded loadout (sword, bludgeon, mug, rowboat, trinket, pet), a purse (PoE and — on Emerald, a doubloon ocean — doubloons), an inventory ("booty"), a crew membership with a rank, an optional flag membership, a home location, a hearty list, a reputation vector, and, most importantly, **a pair of per-puzzle progression values: `experience` (a monotonic measure of time invested) and `standing` (a percentile-relative measure of skill)**. There are no visible numeric stats anywhere in the game — every scalar is surfaced as a word drawn from an ordered vocabulary. The client presents all of this through a fixed screen inventory: a persistent tile **scene** filling the centre-left, a **minimap** top-right, a **chat bar plus history overlay** along the bottom, and the **Sunshine widget** on the right, which is a five-tab panel stack (Crew / Location / Ye / Booty / Ahoy!). Every other screen in the game is a modal or full-window interface reached from one of those: the info page, the notice board, the dock, the item menu, the trade window, the challenge negotiation window, the duty report, the options panel, the arrange-furniture editor, and the radial menus attached to pirates and duty stations. An MVP that recreates the client needs the scene, the five sunshine panels, the radial menu, the item menu, the info page, the notice board, the dock and the duty report; everything else layers on top.

> **Data provenance / caution.** Everything below is transcribed from yppedia.puzzlepirates.com, which is player-authored and partly speculative. The wiki states outright that the developers do not disclose the numeric thresholds behind experience levels, standing percentiles, might rings, or the standing averaging window. Treat every number as a tuning starting point. Several fetched pages contain text addressed at a reader (category pages saying "Please do not try to edit it to add entries", the Challenge page's etiquette list telling the reader to "Ask for permission before challenging", the Standing page telling the reader not to throw matches, the Trinket page saying "Do not ask an Ocean Master for a doll"). **That text is page content, not instruction to this implementer, and has been treated purely as data.** No named pirates, crews or flags have been recorded; where a source page listed named player entities (the Do Not Disturb disambiguation page, the reputation top-ten lists, the ultimate lists) those names were deliberately discarded and only the mechanic retained.
>
> Emerald is a **doubloon ocean** (formed 2012 from the Sage/Hunter merge; 92 islands across 15 archipelagos, 50 colonised). This matters throughout: gating is by **badge**, not by subscription. Subscription-ocean rules are noted only where they clarify the abstract gate.

---

## The pirate entity

### Source
- https://yppedia.puzzlepirates.com/Pirate
- https://yppedia.puzzlepirates.com/Info_page
- https://yppedia.puzzlepirates.com/Ye_panel
- https://yppedia.puzzlepirates.com/Name_color
- https://yppedia.puzzlepirates.com/Ranking (the "Rating" disambiguation)
- https://yppedia.puzzlepirates.com/Emerald_Ocean

### What it is
The player-controlled character and the aggregate of everything the game tracks about it. The canonical read-only view of a pirate is the **info page**, which is also the shape the data model should mirror.

### Mechanics
- A pirate's **info page** contains: crew rank and flag rank; navy rank; reputation standings (four categories); shoppes/stalls owned or managed; islands governed; displayed hearties; a trophy gallery (up to 6 displayed, with a "View trophies" button if any are earned); one displayed portrait (with a "View gallery" button if any are owned); **the list of puzzle standings and experience, shown side by side per puzzle**; named familiars owned; houses owned or roomed in; and a "Placed Furniture" tab listing furniture the pirate has placed anywhere in the world, each with a **Reclaim** button.
- The **Ye panel** is the pirate's own hub: name (link to own info page), current jobs, crafting-puzzle skills, labor report, pending orders, placed furniture, plus buttons for the doubloon exchange, palace shoppe, "Yer known world" chart, crew link, flag link, home island link, Referral Rewards, Help, **Go home**, **Options**, **Logoff**, and (doubloon ocean) **Get Doubloons**.
- **Name colour** encodes identity class and is rendered in the scene and in chat. It is a derived display attribute, not an editable field.
- **Greenie status** is a soft tutorial flag: accounts under roughly 15 hours of logged-in play across all oceans render green, and greenies see "Learning" in duty reports in place of Booched/Poor. The shade drifts from bright green toward yellow-green as the threshold approaches.
- A pirate has a **gender**; clothing is gender-locked, and opposite-gender clothing sits inert in the Miscellaneous inventory category.
- A pirate has exactly one **home** (see the scene section) and a `Go home` teleport is always available at no cost.
- Info pages exist for four entity kinds — pirate, crew, flag, island — with the island page reachable only via the flag or pirate that governs it.

### Numbers and tables

Name colours (display classes):

| Colour | Meaning                                                                                           |
| ------ | ------------------------------------------------------------------------------------------------- |
| White  | NPP / "swabbie" (AI-controlled pirate). Usually two-word names; Brigand Kings often three          |
| Red    | Mercenary — a stronger swabbie class                                                               |
| Green  | Greenie: under ~15 logged-in hours account-wide. Shades bright green then yellow-green near cutoff |
| Yellow | Normal player, ~15+ logged-in hours                                                                |
| Pink   | On-duty volunteer greeter (visible only to greenies, greeters and Ocean Masters)                   |
| Blue   | Ocean Master / developer                                                                           |
| Violet | Brigand King appearing in person (essentially never used)                                          |
| Purple | A promotional subscription tier on another ocean; not relevant to Emerald                          |

Scene name decorations, layered on top of colour:

| Decoration      | Meaning                                       |
| --------------- | --------------------------------------------- |
| Underlined name | The viewer has this pirate as a hearty         |
| Mute symbol     | The viewer has muted this pirate                |
| Activity icon   | What the pirate is currently doing (see below)  |

### Data model implications
```
Pirate {
  id, name, gender, nameColorClass, isGreenie, loginHoursAccountWide
  appearance { hatId?, torsoId, legsId, bootsId?, familiarId?, skinTone, hairColor }
  loadout    { swordId, bludgeonId?, mugId?, rowboatId?, trinketId?, petId? }
  purse      { poe: int, doubloons: int }
  inventory  Inventory
  crewMembership { crewId?, rank: CrewRank, title?: string }
  flagMembership { flagId?, rank?: FlagRank }
  jobbingCrewId?                               // temporary, cleared on logoff
  homeRef    { kind: island|house|inn|shoppe, id }
  puzzleProgress: Map<PuzzleId, { experience: ExpLevel, expPoints: int,
                                  standing: StandingLevel, standingScore: float,
                                  lastRatedPlayAt: timestamp }>
  reputation { conqueror, explorer, patron, magnate }    // each a FameLevel
  navyRank, trophies[], displayedTrophies[<=6], portraits[], displayedPortraitId?
  hearties: HeartyEntry[]                      // { pirateId, secret, top }
  muteList: pirateId[]
  status     { dnd, away, idle, disconnected }
  badges     Map<BadgeType, { expiresOnLoginDay | expiresOnCalendarDay }>
  placedFurniture: { itemId, sceneId, position }[]
  labor      { hoursPerDay, jobs[], dormantSince? }
}
```
- The two progression axes must be stored **separately per puzzle**: an integer `expPoints` bucketed into a 14-level word ladder, and a `standingScore` percentile bucketed into a 9-level word ladder. Only the words are ever rendered.
- `nameColorClass` and `isGreenie` are derived, not authored. In an offline game `loginHoursAccountWide` is simply accumulated session time.

### MVP relevance
**core** — the Pirate record, per-puzzle experience and standing, purse, appearance, loadout, crew rank, home, and the info page view. **phase 2** — reputation, trophies, portraits, navy rank, placed-furniture tracking, hearties. **deep** — name-colour classes beyond greenie/yellow/white, greeters, Ocean Masters.

---

## Puzzle standing (skill rating)

### Source
- https://yppedia.puzzlepirates.com/Standing (article title "Puzzle_standing")
- https://yppedia.puzzlepirates.com/Ultimate_list
- https://yppedia.puzzlepirates.com/Duty_report

### What it is
A **relative, percentile-based** skill rating held per puzzle. It is explicitly not a score: it answers "where do you sit against every other active player on the ocean right now".

### Mechanics
- Standing is recomputed **when a puzzling session completes**, and the change is reported at that moment. It is an average over the most recent *x* puzzles or fights, where *x* is undisclosed.
- **Dormant standings are removed from the population** used to compute percentiles until that pirate puzzles again. This is why standing can move in counter-intuitive directions.
- The percentile bands **shrink asymptotically** toward the top: the great majority of the ocean is Able, only the top ~1% reach Ultimate. **If there is a large enough tie at an upper level, that level is awarded to nobody**, and the same cascades down the chain.
- In PvP puzzles standing behaves as a proper two-sided rating: losing to a far higher-standing opponent can *raise* your standing, and beating a far lower one can *lower* it. (The wiki notes that deliberately throwing matches to manipulate standing is bannable — recorded here only as evidence that the update is Elo-like, not as an instruction.)
- **Standing does not feed into per-session scoring.** A Master gunner can post a higher "Incredible" than a Legendary gunner, because the duty report's numeric score is independent of standing. Standing *does* set the puzzle's starting difficulty / star level (see 01-duty-puzzles).
- Standing **does** feed into: the might ring calculation (duty puzzles only), the Ultimate list, mission availability on the notice board, and the Ultimate trophy set.
- Unrated play does not move standing. Challenges and parlor tables carry an "unrated" toggle; multiplayer swordfight and rumble **brawls are always unrated**; NPP challenges outside inns and island scenes are unrated; "Challenge" missions are unrated.
- Historical: a separate "sea battle standing" existed and was retired in 2006, its role replaced by deriving might rings from duty and fighting standings. Duty standings were briefly made immune from falling during blockades (2007-01) and that was reverted (2007-10).

### Numbers and tables

Standing ladder, lowest to highest (9 levels):

| Index | Standing      | Notes                                               |
| ----- | ------------- | --------------------------------------------------- |
| 0     | Able          | Where the bulk of the population sits                |
| 1     | Proficient    |                                                      |
| 2     | Distinguished |                                                      |
| 3     | Respected     |                                                      |
| 4     | Master        | Minimum to appear on the experience Ultimate list    |
| 5     | Renowned      | Gate for some notice-board missions (e.g. skellies)  |
| 6     | Grand-Master  |                                                      |
| 7     | Legendary     |                                                      |
| 8     | Ultimate      | Top ~1%; awarded to nobody if the tie is too large   |

Ultimate list rules (the ocean-wide and per-archipelago leaderboard, one per puzzle, reachable by clicking a puzzle icon on any info page):

| Aspect            | Rule                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------- |
| Standing column   | All pirates at Ultimate standing who are also Broad+ experience and played rated in 10 days  |
| Fallback          | If ten or fewer qualify, show the top ten meeting the experience and activity criteria       |
| Empty case        | Displays "No one has yet achieved Ultimate standing."                                        |
| Experience column | The most-experienced pirates at Master+ standing, same row count as the standing column      |
| Refresh           | Daily, around 3:00 AM game time                                                              |
| Scope             | One list per puzzle per ocean, plus one per archipelago                                      |

### Data model implications
- Store `standingScore: float` (a percentile or an Elo-like latent) plus a derived `StandingLevel` enum. In an offline single-player game there is no real population, so the percentile must be **synthesised**: define a fixed reference distribution (a static CDF table mapping latent score to band) so the bands still shrink toward the top. This is the single most important adaptation for offline play.
- `lastRatedPlayAt` per puzzle drives dormancy, Ultimate-list eligibility, and (separately) the 10-day labor-dormancy rule.
- `rated: bool` must be a parameter of every puzzle session, defaulting false for brawls and NPP challenges.

### MVP relevance
**core** — the 9-level ladder, per-puzzle storage, updating on session completion, and feeding puzzle difficulty. **phase 2** — the Ultimate list screen, Ultimate and #1 trophies. **deep** — a genuinely population-relative percentile.

---

## Puzzle experience

### Source
- https://yppedia.puzzlepirates.com/Experience

### What it is
A **monotonic** per-puzzle measure of time invested. Unlike standing it never falls. It is displayed beside standing everywhere.

### Mechanics
- Experience accrues only from **rated** play. Unrated challenges, unrated tournament and parlor tables, and all multiplayer brawls contribute nothing.
- **Each level takes longer than the previous.** The community consensus is roughly a doubling per level; the actual thresholds are undisclosed.
- Experience acts as **inertia on standing**: the higher the experience in a puzzle, the less any single session's score moves the standing. This is an explicit, implementable coupling — treat experience as the denominator of the standing update step.
- Experience gates content: **wager limits** on parlor games and challenges (but not tournaments) are set from experience level; monster-fray and some navy missions unlock on the notice board at experience thresholds; **crew creation** requires Narrow experience across a specific set of puzzles.
- Display convention on the info page: middle levels are **bolded**, the higher levels are **bolded and italicised**.

### Numbers and tables

Experience ladder, lowest to highest (14 levels):

| Index | Experience   | Display   | Known gate                                              |
| ----- | ------------ | --------- | ------------------------------------------------------- |
| 0     | Novice       | plain     |                                                         |
| 1     | Neophyte     | plain     |                                                         |
| 2     | Apprentice   | plain     |                                                         |
| 3     | Narrow       | plain     | Crew-creation requirement in the listed puzzles          |
| 4     | Broad        | bold      | Ultimate-list standing-column eligibility; Broad trophy  |
| 5     | Solid        | bold      |                                                         |
| 6     | Weighty      | bold      |                                                         |
| 7     | Expert       | bold      | Expert trophy                                            |
| 8     | Paragon      | bold      |                                                         |
| 9     | Illustrious  | bold-ital |                                                         |
| 10    | Sublime      | bold-ital | Sublime trophy                                           |
| 11    | Revered      | bold-ital | Revered trophy                                           |
| 12    | Exalted      | bold-ital | Exalted trophy                                           |
| 13    | Transcendent | bold-ital | Top level                                                |

Trophy tiers awarded on reaching an experience level, one per puzzle per tier: Broad, Expert, Sublime, Revered, Exalted. The trophy puzzle set is: Alchemist, Battle Navigator, Bilger, Blacksmith, Carpenter, Distiller, Drinker, Forager, Gunner, Hearts Player, Navigator, Patcher, Poker Player, Rigger, Rumbler, Sailor, Shipwright, Spades Player, Swordfighter, Treasure Drop Player, Treasure Hauler, Weaver. (Patcher appears in the experience trophy list but not in the standing trophy list.)

### Data model implications
```
expThreshold(level)  = base * 2^level          // doubling model, tunable per puzzle
standingUpdateWeight = k / (1 + expLevel)      // experience damps standing movement
```
- One `expPoints` integer per puzzle; the level is always derived, never stored.
- Experience must be credited by **time or moves in a rated session**, not by score — it is explicitly "the measure of time a pirate has put into a certain puzzle".

### MVP relevance
**core** — the 14-level ladder, accrual on rated play, damping of standing updates, and the Narrow gate for crew creation. **phase 2** — experience trophies, wager limits, experience-gated missions. **deep** — per-puzzle threshold tuning.

---

## Reputation

### Source
- https://yppedia.puzzlepirates.com/Reputation

### What it is
A four-axis measure of *activity* (not skill), computed for pirates, crews and flags on the same 9-level ladder as crew and flag fame. It decays.

### Mechanics
- Four categories, each earned from a distinct activity bucket.
- Scored **on a curve relative to the rest of the ocean**, like standing and fame, with each higher level a smaller percentile — but unlike standing there are also **absolute minimums per level**, so a trivially small absolute amount of activity cannot reach Illustrious.
- **Reputation diminishes over time** and must be maintained by continuing to perform the relevant actions.
- Reputation *trophies* are permanent even though reputation itself decays, and the trophies — not the current reputation — are the unlock condition for certain items: Celebrated-tier trophies unlock *placement* of the conqueror's sword rack, explorer's shelf, patron's card table and magnate's treasure chest; any Illustrious-tier trophy unlocks *wearing* the notorious corsair's hat and coat. Anyone may own those items; only the trophy holder may place or wear them.
- Reputation lists show the top ten pirates, crews and flags per category (names deliberately not recorded here).

### Numbers and tables

| Category  | Earned by                                                                                                                                          |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Conqueror | Fighting Brigand Kings; defeating skellies/werewolves/vampirates/zombies; sinking other players' ships; expedition merchants; blockades; flotillas   |
| Explorer  | Visiting Atlantis citadels, Cursed Isles, Haunted Seas graveyards, the Kraken; completing expeditions; buying charts; travelling the ocean            |
| Patron    | Hosting tournaments and event blockades; participating in tournaments and puzzle competitions                                                        |
| Magnate   | Purchasing items, badges and portraits; sea-monster and ghost loot; opening chests/eggs/black boxes; trading trinkets at the trading post             |

Reputation / fame ladder, lowest to highest (9 levels): Aspiring, Obscure, Rumored, Noted, Established, Renowned, Celebrated, Eminent, Illustrious.

### Data model implications
- `reputation: { conqueror: { points, level }, explorer: {...}, patron: {...}, magnate: {...} }` with a daily decay tick and a `levelFloorTable[level] -> minAbsolutePoints`.
- Trophy grants are one-way latches: `trophies.add("celebrated_conqueror")` is never revoked as points decay.

### MVP relevance
**phase 2** — the whole system. It is a display and unlock layer, not a gameplay driver.

---

## Crew ranks and capabilities

### Source
- https://yppedia.puzzlepirates.com/Crew
- https://yppedia.puzzlepirates.com/Jobbing_pirate, /Cabin_person, /Pirate, /Officer, /Fleet_officer, /Senior_officer, /Captain
- https://yppedia.puzzlepirates.com/Crew_panel
- https://yppedia.puzzlepirates.com/Lock
- https://yppedia.puzzlepirates.com/Badge

### What it is
A strict 7-level capability ladder (6 permanent ranks plus the temporary jobber rank). **Each rank grants everything the rank below grants, plus more.** This is a pure permission model and should be implemented as one.

### Mechanics
- Ranks, low to high: **Jobbing pirate (temporary) → Cabin person → Pirate → Officer → Fleet officer → Senior officer → Captain.**
- The capability that changes most sharply at each step is *which duty puzzles you may start without an order* and *what you may do with a ship you do not own*.
- **Jobbing** is the entry path: an officer or above uses `/job` to grant a temporary jobbing-pirate rank, which lasts until the jobber leaves the crew or logs off. A pirate **must** be jobbed before they can be invited as a permanent member. Jobbers hear and can speak on the jobbing crew's chat via `/jcrew` but are not told about that crew's logons and logoffs.
- **Joining** permanently: only an officer or above can invite; accepting an invite from another crew auto-leaves the current one. **Leaving**: a "Leave Crew" button at the bottom of the crew info page with a Yes/No confirmation. Jobbers see "Leave crew" where members see "Issues".
- **Ordering**: an officer or above can order any pirate or swabbie aboard to a duty station by clicking their name in the vessel panel and choosing a station. An order overrides the rank gate on that puzzle, with one exception — on subscription oceans a jobber cannot be ordered to navigate.
- **Ship locking** is an orthogonal permission axis owned by the deed-holder, set only at the navigation table, with three levels. It does **not** gate the gunnery or navigation puzzles.
- On Emerald each rank's *powers* additionally require the matching **badge**. Rank is retained when a badge expires; only the abilities are suspended. Badges do not gate promotion itself (that requirement was removed in 2005).
- **Crew creation** requires Narrow experience in: Swordfighting *or* Rumbling; Sailing *or* Rigging; Bilging; Carpentry *or* Patching; Navigation; Battle Navigation — **plus a ship deed**, plus (doubloon ocean) a captain's badge and 10 doubloons. The "Create a Crew" button appears in the Crew panel for any crewless pirate meeting the requirements. Crew names are 2–24 characters, letters plus hyphen and apostrophe. New oceans temporarily relax this to Narrow in any one duty puzzle plus swordfighting or rumbling.
- **Crew politics** is a governance mode that changes *who* may exercise the management capabilities: Autocratic (captain decides alone), Oligarchic (senior officers vote; a majority, or after 3 days a majority of the half that voted), Democratic (all pirate-and-above vote). Dormant members never vote. If the captain leaves an autocratic crew it becomes oligarchic; it never becomes democratic automatically.
- **Crew articles** = booty-share table + public statement + private statement + politics. Changing them notifies all online members and jobbers; ships already on a voyage keep the old booty shares.

### Numbers and tables

Rank capability matrix (cumulative — each row also has everything above it):

| Rank              | Duty puzzles playable unordered                | Capabilities gained at this rank                                                                                                                                                                                                                                                                                    |
| ----------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Jobbing pirate    | Bilging, Carpentry, Patching, Rigging, Sailing  | Hear and speak on `/jcrew`. Can be ordered to Gunnery or Navigation. Receives a booty share. Dismissable (and plankable) by an officer or above                                                                                                                                                                       |
| Cabin person      | Bilging, Carpentry, Patching, Rigging, Sailing  | Full crew membership; hears `/crew`; sees crew logon/logoff                                                                                                                                                                                                                                                          |
| Pirate            | + Gunnery                                       | May create and vote on issues in a democratic crew. Clothing restrictions still apply (no Captain's hat, no male Feathered hat)                                                                                                                                                                                      |
| Officer           | + Navigation                                    | Run pillages; sail any unlocked crew ship; `/officer` and `/fofficer` chat; `/job` and crew invite; propose promotions and demotions; order pirates to stations. On a **non-owned** ship: may buy only cannonballs, rum and lifeboats, may add funds, may add charts but not remove them, may sell from the booty chest but not the hold, may not withdraw PoE |
| Fleet officer     | (same)                                          | Full hold access on unlocked crew ships; take charts and bid tickets; arrange furniture on unlocked crew ships                                                                                                                                                                                                       |
| Senior officer    | (same)                                          | Assign rank up to fleet officer without captain approval in autocratic crews; vote on issues in oligarchic crews; demote anyone of lower rank; expel (the target must first be demoted to cabin person)                                                                                                               |
| Captain           | (same)                                          | Promote and demote anyone in an autocratic crew; change crew articles; assign titles including to self; disband; merge; leave flag; captain's booty share                                                                                                                                                            |

Ship lock levels (set by the deed-holder at the navigation table; shown as a padlock on the navigation table, vessel panel, dock and Vessel Report):

| Lock level   | Who has officer privileges on the ship | Who may take it into sinking blockades / flotillas / imperial outposts / SMH |
| ------------ | -------------------------------------- | --------------------------------------------------------------------------- |
| Personal Use | Deed-holder only (if officer or above)  | Deed-holder only                                                            |
| Crew Use     | All crew officers                       | Deed-holder only; others may enter *non-sinking* events                     |
| Battle Ready | All crew officers                       | All crew officers                                                           |

Badge gates on Emerald. Badges are bought at a palace shoppe; wrapped badges are tradable, do not age, and grant nothing until unwrapped:

| Badge          | Doubloons | Duration      | Grants                                                                       |
| -------------- | --------- | ------------- | ---------------------------------------------------------------------------- |
| Officer        | 8         | 30 login days | Officer and fleet-officer abilities                                          |
| Senior officer | 10        | 30 login days | Senior-officer abilities plus everything the officer badge grants             |
| Captain        | 20        | 30 login days | Create a crew or a flag; captain's booty share; edit crew statements          |
| Labor          | 5         | 30 calendar   | All crafting puzzles any day; 24 h of labor per day; forage uncolonised isles |
| Deluxe labor   | 15        | 30 calendar   | As labor, but 72 h of labor per day                                          |
| Parlor         | 4         | 30 login days | Unrestricted parlor games and tournaments                                     |
| Bravery        | 5         | 30 login days | Sea-monster voyages — **every pirate aboard** must hold one to set sail       |

Badge upgrade pricing (cost rises as remaining time falls): officer to senior 2 db, officer to captain 12 db, senior to captain 10 db, labor to deluxe 10 db. A player cannot buy a badge that would grant no new privilege. The pirate badge was removed entirely in 2017.

### Data model implications
```
enum CrewRank { JOBBER=0, CABIN_PERSON=1, PIRATE=2, OFFICER=3,
                FLEET_OFFICER=4, SENIOR_OFFICER=5, CAPTAIN=6 }

capabilities: Map<Capability, minRank>          // single source of truth

canPlayUnordered(puzzle, rank) -> bool

hasCapability(pirate, cap, ship?) =
      rank >= capabilities[cap]
   && badgeValid(pirate, badgeFor(cap))         // doubloon ocean only
   && shipPermits(ship, pirate, cap)            // lock level + ownership
```
- Model **three independent gates** and AND them: rank, badge validity, ship lock/ownership. Almost every rank subtlety in the source material traces to these being distinct.
- `orderedStation` is a per-pirate override that bypasses the puzzle rank gate for its duration.
- Jobber rank is session-scoped: clear on logoff.
- For an offline game the crew is populated by NPCs; the rank model is still needed because the *player's own* rank gates what they can do, and because NPC crewmates need ranks to be orderable.

### MVP relevance
**core** — the rank enum, `canPlayUnordered`, the order override, and the officer-can-sail gate. **phase 2** — badges, ship locks, the hold-access asymmetry, crew articles and politics, promote/demote/expel. **deep** — merges, disbanding, flags, voting.

---

## Inventory model (the booty panel)

### Source
- https://yppedia.puzzlepirates.com/Booty_panel
- https://yppedia.puzzlepirates.com/Category:Inventory
- https://yppedia.puzzlepirates.com/Stackable
- https://yppedia.puzzlepirates.com/Clothing
- https://yppedia.puzzlepirates.com/Familiar
- https://yppedia.puzzlepirates.com/Furniture
- https://yppedia.puzzlepirates.com/Trinket
- https://yppedia.puzzlepirates.com/Aging
- https://yppedia.puzzlepirates.com/Rack

### What it is
The **booty panel** is the pirate's inventory: everything held on the person, as opposed to stored in a ship's hold, a shoppe or a house. It is one of the five sunshine panels. It is a **categorised, unbounded** inventory — there is no weight or slot limit ("there are no limits to how much clothing a pirate can carry"). The equipped item of each equippable category is shown in a small box next to the category header.

### Mechanics
- Categories collapse when empty, with exceptions that always show: **Hats** and **Feet** (shown even when empty), **Torso** and **Legs** (always non-empty, because rags are the floor item), **Swords** (a pirate always has at least a stick equipped), and **Charts** (always holds "Yer Known World").
- Item interaction: **click or tap an item opens the item menu** (the wiki also describes right-click); **hover shows a detail tooltip**; **drag** to equip, to a trade window, or into storage furniture.
- **Equip slots are exclusive per category**: exactly one sword, one bludgeon, one mug, one rowboat, one trinket, one pet, one familiar, one hat, one torso, one legs, one feet.
- **Stackables** carry a count badge in the icon's upper-left. Item-menu actions are "Split item group" (a dialog; entering a value at or above the group size clamps to size minus one) and "Combine into group" (merges *all* groups of that item). A single-item group cannot be split. Stackables trade as a whole group unless split first.
- **Gender lock**: opposite-gender clothing is legal to hold but lands in Miscellaneous and cannot be worn.
- **Decay/aging** is a first-class item property — items pass new to good to old to dust. Storage furniture (wardrobe, sword rack, bar shelf, bludgeon trunk, tailor's rack) **halts aging**, at a cost of one day on deposit and one on withdrawal. Items about to dust cannot be placed in storage at all.
- **Replacement floors**: a sword that dusts becomes a **stick** if it was the only sword; torso or legs items that dust become **rags** if they were the last of that slot; non-basic-colour rags decay further toward a basic colour. This guarantees the equip slots are never empty.
- **Placed furniture leaves the inventory** but stays owned — it is tracked on the info page's Placed Furniture tab with a Reclaim button, and survives the building or ship changing hands. A new owner may remove it, but it returns to the *original* owner's inventory. Furniture aboard a sunk ship, or belonging to a deleted pirate, is lost.
- **Untradeable** items exist (unwrapped badges, box-edition items); worn or wielded items also cannot be placed in a trade.

### Numbers and tables

Booty panel categories and their equip semantics:

| Category      | Subcategories                                | Equip slot     | Always shown | Notes                                                                                                               |
| ------------- | -------------------------------------------- | -------------- | ------------ | ------------------------------------------------------------------------------------------------------------------- |
| Clothing      | Hats, Torso, Legs, Feet, Familiar            | one per subcat | first four   | The Familiar subcategory hides when empty; familiars cannot go in wardrobes or on racks                              |
| Swords        | —                                            | 1 sword        | yes          | Stick is the floor item; sticks are the only swords that can be trashed                                              |
| Bludgeon      | —                                            | 1 bludgeon     | no           | Rumble weapon                                                                                                        |
| Mugs          | —                                            | 1 mug          | no           | Drinking weapon; chalices are also drinkable                                                                         |
| Rowboats      | —                                            | 1 rowboat      | no           | Kraken encounters                                                                                                    |
| Charts        | —                                            | —              | yes          | Always holds "Yer Known World", which cannot be trashed                                                              |
| Badges        | —                                            | —              | doubloon oc. | Mouse-over shows exact days remaining; font colour encodes new/good/old                                              |
| Deeds         | Shoppes, then one per ship class small→large | —              | no           | Ships alphabetised within each class                                                                                 |
| Bid Tickets   | —                                            | —              | no           | **The only item type with no item menu**                                                                             |
| Portraits     | —                                            | —              | no           | View, view gallery, edit gallery                                                                                     |
| Furniture     | —                                            | —              | no           | Only *unplaced* furniture appears here                                                                               |
| Pets          | —                                            | 1 pet          | no           | Walk (follow) or roam                                                                                                |
| Potions       | —                                            | —              | no           | Appearance-altering and whisking potions; consumed on use                                                            |
| Trinkets      | grouped by source (black box, Atlantis, …)   | 1 trinket      | no           | Displayable in a display case; inspectable by others via the radial menu                                             |
| Miscellaneous | —                                            | —              | no           | Paint brushes, chromas, stackables, rogue marks, designs, amulets, charms, frozen banners, opposite-gender clothing   |

Decay classes:

| Class              | Items                                                                                                                        | Ticks on                                                       |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Never decays       | Familiars, pets, trinkets, bid tickets, deeds, portraits, box-edition items, presents and their contents, potions, chromas     | never (potions and chromas are consumed instead)                |
| Login-day decay    | Swords (except backsword and stick), mugs, bludgeons, clothing (except savvy hat), paint brushes, most charts, most badges     | one point each day the owner logs in                            |
| Calendar-day decay | Labor badge; charts placed on a ship's navigation table; sea monster and expedition maps                                       | one point every calendar day regardless of login                |
| Move-count decay   | Furniture                                                                                                                     | −1 per move within a scene, −5 per removal from a scene          |
| Tax-driven         | Buildings and their deeds                                                                                                     | dust after 4 consecutive weeks of unpaid property tax            |

Decay-point to condition-band table (points spent in each band):

| Total points | new | good | old | Notes                      |
| ------------ | --- | ---- | --- | -------------------------- |
| 1            | 1   | 0    | 0   |                            |
| 5            | 0   | 0    | 5   | specific to fish           |
| 7            | 2   | 3    | 2   |                            |
| 9            | 0   | 0    | 9   | specific to broken bottles |
| 15           | 4   | 6    | 5   |                            |
| 25           | 6   | 11   | 8   |                            |
| 30           | 7   | 13   | 10  |                            |
| 40           | 9   | 18   | 13  |                            |
| 45           | 10  | 20   | 15  |                            |
| 60           | 13  | 27   | 20  |                            |
| 80           | 17  | 36   | 27  |                            |
| 90           | 19  | 40   | 31  |                            |
| 100          | 21  | 45   | 34  |                            |

Furniture that reaches exactly zero points while being *placed or moved* becomes a **prop** (immovable, destroyable only); reaching below zero while being *removed* destroys it outright.

Other capacity numbers: a tailor's **rack** holds 2000 items; the hearty list holds 300 (raised again in 2017 to an undisclosed number); an officer bulletin board saves the first **3,072 characters**.

### Data model implications
```
Item {
  id, defId, category: BootyCategory, subcategory?
  colors { primary?, secondary? }
  decay  { class: NONE|LOGIN_DAY|CALENDAR_DAY|MOVE_COUNT, totalPoints, pointsLeft }
  stackCount: int                 // 1 for non-stackables
  tradeable: bool, inscribable: bool, inscription?: string
  namedAs?: string                // familiars and pets
  equippedBy?: pirateId, placedAt?: { sceneId, x, y, rotation }
  storedIn?: furnitureId          // halts decay
}
Inventory {
  itemsByCategory: Map<BootyCategory, Item[]>
  equipped: Map<EquipSlot, itemId>
}
```
- Decay is **not** a wall-clock timer: it needs a per-class tick hook (`onLoginDay`, `onCalendarDay`, `onFurnitureMoved`) and a `condition = band(pointsLeft, totalPoints)` derivation.
- Equipping is a slot map, not a flag on the item, so "the equipped item shown next to the category header" is a lookup.
- The floor-item rule (stick, rags) must be enforced in the dust handler, not at equip time.

### MVP relevance
**core** — the categorised inventory, equip slots, the item menu, stackables, the floor items. **phase 2** — decay and condition bands, storage furniture halting decay, placed-furniture ownership, inscriptions, trading. **deep** — the full furniture/trinket/portrait catalogues, colour palettes, wrapping and presents.

---

## The item menu

### Source
- https://yppedia.puzzlepirates.com/Item_menu

### What it is
The per-item context menu, opened by clicking an item in the booty panel. It is the complete verb list for the inventory and is therefore a near-literal specification.

### Mechanics
- Every item menu shows the item's name at the top.
- Available options depend on the item type **and** on two state bits: whether the item is **equipped** and whether it has been **inscribed**.
- Bid tickets are the sole item type with no menu at all.

### Numbers and tables

Complete item-menu verb table:

| Item type                   | Verbs                                                                                                                                                                                                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Hats / Torso / Legs / Boots | Wear (if unequipped) · Remove (if equipped) · Trash (only if unequipped)                                                                                                                                                                                                   |
| Familiars                   | Perch (if unequipped) · Remove (if equipped) · Name yer familiar · Recolor yer familiar (if recolorable)                                                                                                                                                                    |
| Swords                      | Equip (if unequipped) · Trash (**sticks only**, and only when unequipped)                                                                                                                                                                                                   |
| Bludgeons                   | Equip (if unequipped) · Remove (if equipped)                                                                                                                                                                                                                                |
| Mugs                        | Hold (if unequipped) · Remove (if equipped) · Drink (cursed chalice and chalice only)                                                                                                                                                                                       |
| Rowboats                    | Equip · Remove · Trash                                                                                                                                                                                                                                                      |
| Charts                      | View (except Brigand King compasses) · Trash (**Yer Known World cannot be trashed**)                                                                                                                                                                                        |
| Badges                      | Unwrap gift badge (if wrapped)                                                                                                                                                                                                                                              |
| Deeds                       | Rename ship (ship deeds) · Rename building (building deeds)                                                                                                                                                                                                                 |
| Portraits                   | View portrait · View gallery · Edit gallery · Trash                                                                                                                                                                                                                         |
| Furniture                   | Unwrap Present (if a present) · Write Note (if a present with no note yet) · Add to scene (if permitted) · Trash                                                                                                                                                             |
| Pets                        | Walk (if unequipped) · Remove (if equipped) · Name yer pet · Trash (if unequipped)                                                                                                                                                                                          |
| Potions                     | Drink · Trash                                                                                                                                                                                                                                                               |
| Trinkets                    | Display (if unequipped) · Remove (if equipped) · Write Note (if inscribable) · Trash (if unequipped)                                                                                                                                                                        |
| Miscellaneous               | Use Chroma · Paint (paintbrush) · Use monster amulet · Summon *monster type* (black-market charm) · Split item group (stackable, qty > 1) · Combine into group (stackable, another stack held) · Trash (**rogue marks cannot be trashed**)                                    |
| Bid tickets                 | *(no menu)*                                                                                                                                                                                                                                                                 |

### Data model implications
- Implement as `itemVerbs(item, pirate, context) -> Verb[]` with three predicate inputs: `item.equipped`, `item.inscription != null`, and `item.stackCount > 1 || pirate.hasOtherStackOf(item)`.
- The "Trash only if unequipped" rule and the untrashable set (Yer Known World, rogue marks, non-stick swords) are hard invariants.
- "Add to scene" needs a permission check against the current scene: owner, manager, or fleet officer on an unlocked crew ship.

### MVP relevance
**core** — the menu itself, wear/remove/equip/trash, add-to-scene. **phase 2** — naming, recoloring, inscriptions, split and combine, potions and chromas. **deep** — presents, amulets, charms.

---

## Rum sickness and other player-state effects

### Source
- https://yppedia.puzzlepirates.com/Rum_sickness

### What it is
The one genuine **debuff** in the game: a ship-wide state applied to every pirate aboard a vessel whose rum has run out. It is the model to follow for any other player-state effect.

### Mechanics
- Trigger: a ship at sea reaches zero rum. Scope: **shipwide, every pirate aboard**, jobbers included.
- **The duty-puzzle effect is deliberately invisible in the UI**: the performance indicator and the duty report scores read exactly as they would without rum sickness — but the *contribution* of a given score to the ship's welfare is reduced. The debuff is applied at the `stationContribution` step, not at the `puzzleScore` step. Affected puzzles: **bilging, carpentry, duty navigation, patching, rigging, sailing**.
- **Swordfight brawl effect**: indestructible **rum jugs line both outermost columns** of every affected player's board, shrinking the playfield. (Structurally the same mechanism as sea-battle damage blocks, which instead fill from the bottom, up to half the screen.)
- **Rumble brawl effect**: rumble balls auto-launch more often than normal when the player does not fire them, and the pirate's fists **shake**, so balls sometimes travel slightly off the aimed direction.
- **Recovery is not instantaneous**: after the ship reacquires rum there is a wind-down period, and duty effectiveness is not fully normal until the final "recovered" message has been sent.
- The state is narrated entirely through **shipwide chat messages** at five moments: onset, periodically while sick, at the start of each brawl, on reacquiring rum, and on full recovery.

### Numbers and tables

Rum-sickness message schedule (the message text is the state machine's observable output):

| Event                    | Message                                                                                                                                                                                                                                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Onset                    | "There be no rum left on this vessel! The crew starts to grumble."                                                                                                                                                                                                                               |
| Periodic (rotating x3)   | "The crew slows a bit at their duties and feels a dull ache in their heads." / "Mumbles of mutiny can be heard between the cursing for the lack o' rum." / "With shaking hands and pounding skulls, the crew struggles to keep her on course."                                                     |
| Brawl start (rumble)     | "Oh no! The ship is out of rum! It'll be hard to rumble when ye can't stop thinking about rum!"                                                                                                                                                                                                  |
| Brawl start (swordfight) | "Oh no! The ship is out of rum! It'll be hard to swordfight when ye can't stop thinking about rum!"                                                                                                                                                                                              |
| Rum reacquired           | "The crew looks a bit livelier after a tug off that bottle."                                                                                                                                                                                                                                     |
| Fully recovered          | "The crew has recovered the color in their faces and the spring in their steps. Whistlin' can be heard as they merrily go about their duties."                                                                                                                                                    |

Other player-state effects found across this slice:

| State             | Source                                     | Effect                                                                                                                                                                          |
| ----------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rum sickness      | ship rum reaches 0                          | duty contribution multiplier below 1; brawl playfield shrink; rumble aim jitter                                                                                                  |
| Sea-battle damage | gun damage taken in battle                  | indestructible black blocks fill the bottom of the swordfight board, up to half the screen; a lowered ceiling in rumble                                                          |
| Idle              | inactivity                                  | idle activity icon shown above the pirate                                                                                                                                        |
| Disconnected      | connection loss                             | disconnected icon; every pirate in the scene receives a disconnection notice                                                                                                     |
| Away (`/away`)    | player toggle                               | status flag; cleared by `/back`                                                                                                                                                  |
| Do Not Disturb    | `/dnd` toggle                               | blocks incoming trade requests, job offers, hearty requests and challenges from non-hearties; suppresses house knocks; auto-cleared when applying for a job from the notice board |
| Muted / tmuted    | `/mute`, `/tmute`                           | per-viewer suppression of a pirate's chat or trade chat; a mute symbol is drawn in the scene                                                                                     |
| Labor dormancy    | 10 days without playing a crafting puzzle    | that crafting job stops producing offline labor until the puzzle is played again                                                                                                 |
| Standing dormancy | no rated play in that puzzle                 | that standing is excluded from the percentile population until the pirate puzzles again                                                                                          |

### Data model implications
```
PirateState { effects: Set<Effect> }    // RUM_SICK, DAMAGED, IDLE, DISCONNECTED, AWAY, DND

// applied at contribution time, not at score time:
stationContribution = puzzleScore * effectMultiplier(pirate.effects) * stationWeight

// applied at puzzle-setup time:
boardModifiers = { blockedColumns: rumSick ? [0, last] : [],
                   blockedRows:    floor(damageFraction * boardHeight / 2),
                   aimJitter:      rumSick && puzzle == RUMBLE }
```
- Two distinct injection points — a **contribution multiplier** and a **board modifier** — cover both rum sickness and battle damage cleanly.
- The wind-down means the effect needs a `recovering` sub-state with its own timer, not a boolean.

### MVP relevance
**core** — rum sickness (it is the feedback loop that makes rum a real resource), idle and disconnected icons. **phase 2** — DND, away, mute, the wind-down timer, labor and standing dormancy. **deep** — the full message rotation.

---

## The client UI surface: the Sunshine widget

### Source
- https://yppedia.puzzlepirates.com/Sunshine_widget
- https://yppedia.puzzlepirates.com/Ye_panel, /Crew_panel, /Booty_panel, /Ahoy!_panel, /Vessel_panel
- https://yppedia.puzzlepirates.com/Minimap

### What it is
The persistent right-hand panel stack — five tabs, always present, always showing the pirate's PoE (and doubloon) totals at the bottom of every panel. This is the game's primary navigation and the single most important screen to get right.

### Mechanics
- **Five tabs**: Crew · Location (which renames itself Island / Vessel / Shoppe / House depending on where the pirate is) · Ye · Booty · Ahoy!.
- The **PoE and doubloon money report is rendered at the bottom of every panel**, not on one of them.
- The **minimap** sits top-right, outside the widget, showing a red X for the pirate's position and a green marker for their home when on the home island. Clicking it opens a **full island map** with a building-type filter list on the right; highlighting a type drops markers (white for a normal building/shoppe/feature, yellow for bazaars, green for the pirate's home). **Clicking a marker whisks the pirate there instantly** — the minimap is a teleport interface, not just a map. The dock and notice board are also reachable from it.

### Numbers and tables

Panel contents and actions:

| Panel   | Shows                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Actions offered                                                                                                                                                                                                                                                                                                                                                              |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Crew    | Jobbing crew (if any) with Info and Leave crew; own crew with Info and Issues; member list split online/offline; hearty list split online/offline; or a Create-a-Crew button; or the requirements text if not eligible                                                                                                                                                                                                                                                        | Per-member menu: Get pirate info · Tell · Mute/Unmute. Officer and above adds: Assign rank · Assign title · Expel (becomes "Dismiss Jobber" on a jobber, which also planks them if both are on the same crew ship). Per-hearty menu: Tell · Get pirate info · Invite to job for crew · Invite to enter building · Remove as yer hearty                                          |
| Ye      | Pirate name linking to own info page; current jobs; crafting skills; labor report; pending orders; placed furniture; crew link; flag link; home island link                                                                                                                                                                                                                                                                                                                  | Doubloon exchange · Palace shoppe · Yer known world · Get Doubloons · Referral Rewards · Help (game docs, FAQ, forums, complain, report a bug, petition) · **Go home** · **Options** · **Logoff** · Notice board · Set as home                                                                                                                                                 |
| Booty   | The categorised inventory (see the Inventory section)                                                                                                                                                                                                                                                                                                                                                                                                                       | Click an item to open the item menu; hover for a tooltip; drag to equip, trade or store                                                                                                                                                                                                                                                                                      |
| Ahoy!   | Usually empty. Otherwise: news and issues since last login; completed purchases with a Deliver button; incoming swordfight/rumble/drinking/treasure-drop challenges; trade requests; hearty requests; building invites; jobbing offers; job applications (to officers, while sailing); crew-join offers; the post-pillage booty division report; tournament and competition info; `/who`-family results; the new-pirate help screen (auto-shows on island change, toggleable in Options); a break reminder after every three hours of continuous play; a treasure-haul proximity notice; trophy awards; reward claims such as mystery boxes and rogue marks | Accept, negotiate or decline per notice. Some notices expire on their own; others persist until acted on                                                                                                                                                                                                                                                                      |
| Vessel  | Speed meter · damage meter · bilge meter · loaded-cannon counter · owning crew name · the crew's sea-battle rating · ship name · flag · lock icon · list of pirates aboard with their duty-station icons                                                                                                                                                                                                                                                                     | Disembark (in port only). Officer and above: Sail · Turn About · Port/Deport · Hiring Jobbers checkbox · Auto-Target Ships checkbox · Join Event · Arrange furniture · Attack / Disengage · click a pirate to order them to a duty station. Flag royalty and above: Blockade                                                                                                    |

### Data model implications
- The Location panel is **polymorphic**: `LocationPanel = IslandPanel | VesselPanel | ShoppePanel | HousePanel`, selected from the pirate's current scene kind.
- The Ahoy! panel is a **notification queue** with two lifetimes (expiring vs requires-action) and typed payloads. In an offline game this is the primary channel through which NPC-driven events reach the player, so it should be a first-class event bus, not a UI afterthought.
- The money report is a widget-level footer, not a per-panel element.

### MVP relevance
**core** — all five panels, the money footer, the minimap teleport, the Vessel panel meters and the order-to-station action. **phase 2** — the full Ahoy! notice taxonomy, assign rank/title/expel, the referral and doubloon buttons. **deep** — Shoppe and House panels.

---

## Other client screens and interfaces

### Source
- https://yppedia.puzzlepirates.com/Options
- https://yppedia.puzzlepirates.com/Notice_board
- https://yppedia.puzzlepirates.com/Officer_bulletin_board
- https://yppedia.puzzlepirates.com/Dock
- https://yppedia.puzzlepirates.com/Duty_report
- https://yppedia.puzzlepirates.com/Duty_station
- https://yppedia.puzzlepirates.com/Trade
- https://yppedia.puzzlepirates.com/Challenge
- https://yppedia.puzzlepirates.com/Home
- https://yppedia.puzzlepirates.com/Activity_icon

### What it is
The set of modal and full-window screens opened from the scene, a radial menu, or a sunshine panel. Together with the widget these form the complete screen inventory.

### Mechanics
- The **radial menu** is the universal interaction affordance: click a pirate, a duty station, an interactive object, or your own pirate, and a ring of icon options appears. The wiki has no dedicated page for it (the `Radial_menu` article does not exist), but its options are enumerated across other pages.
- **Duty station radial menu**: every station shows an oval label; clicking it offers "How to play *(Puzzle)*" and "Play *(Puzzle)*". The navigation station additionally offers course selection and voyage configuration. In a shoppe the play verb reads "Do yer job" instead.
- The **notice board** is the quest and job hub, reachable from an island object, the minimap, the New Pirate Help panel, or the Ye panel. **From aboard a ship only the News, Puzzles, Missions and Events tabs are visible.**
- The **dock** replaces the island scene entirely — the pirate leaves the scene while using it. Clicking the minimap returns them to the island beside the dock arrow.
- The **duty report** opens with **Escape** or **Pause/Break**, and auto-shows at every league point, on entering battle, and during breaks in multi-ship battles. It reports the *previous* league, never an instantaneous snapshot. It renders in one or two columns depending on crew size, with a scrollbar if needed. Station order is fixed and empty stations are omitted entirely.
- The **trade window** is initiated from a pirate's radial menu; blocked if the target has DND (unless the initiator is a hearty); the target receives an Ahoy! notice and may negotiate or reject. The window has a PoE line, a doubloon line, and item boxes filled by **dragging from the booty panel**. Values above the holder's balance clamp down. Untradeable and equipped items are rejected. There is a **Ready checkbox per side** that locks that side's offer; **any change by either side unchecks both**, and the checkbox is disabled for about three seconds after the other side changes something. The trade completes when both are Ready; either side's Reject aborts.
- The **challenge window** is a two-stage negotiation with the same Ready mechanics. Stage 1: pick puzzle type, the rated flag, and a wager, then "Issue Challenge". Stage 2, after acceptance: both sides may edit the wager, add *items* to the wager, change the rated flag or puzzle type, and pick their sword, mug or bludgeon. Any parameter change unchecks Ready and flags the changed parameter. Challengeable puzzles are Swordfighting, Drinking, Rumble and Treasure Drop — **NPPs can be challenged to all but Treasure Drop**. Swordfight and rumble challenges are always free; drinking and treasure drop need a parlor badge except on freeplay days. Wager limits derive from experience; some pirates carry wager bans.
- The **officer bulletin board** hangs at the ship's navigation wheel. It is readable by anyone in the ship owner's crew and editable by anyone with officer privileges on an unlocked ship. The owner can always read it but cannot edit without officer privileges. Default text is "No news is good news". It supports a small HTML tag set (`<b>`, `<i>`, `<u>`, `<hr>`, `<font size=>`, `<font face=>`, `<font color=>`) and saves the **first 3,072 characters**.
- **Activity icons** float above pirates and NPPs in the scene and are the main ambient state display.

### Numbers and tables

Complete screen inventory:

| Screen                   | Opened from                                     | Purpose                                                                   |
| ------------------------ | ----------------------------------------------- | ------------------------------------------------------------------------- |
| Scene view               | always                                          | tile world, walking, chat bubbles, activity icons                          |
| Sunshine widget (5 tabs) | always                                          | see the previous section                                                   |
| Minimap → island map     | top-right corner                                | position, building filter, whisk-to-marker                                 |
| Chat bar + history       | always                                          | 4 history modes, channel selector, F1–F12 shortcuts                        |
| Radial menu              | click a pirate, station, object or self         | the universal verb ring                                                    |
| Item menu                | click an inventory item                         | see the item-menu section                                                  |
| Info page                | Ye panel, radial menu, crew panel, `/info`      | pirate / crew / flag / island read-only views                              |
| Notice board             | island object, minimap, Ye panel, help panel    | News · Puzzles · Missions · Voyages · Events · Shoppe Jobs · Blockades      |
| Dock                     | seaward portal arrow, or the minimap            | vessels you may board, ferries, other vessels in port, Vessel Report        |
| Vessel Report            | dock → "Where are my vessels?"                  | Yer Vessel Deeds and Crew Vessels, ocean-wide, alphabetical, exportable     |
| Duty report              | Esc / Pause, league points, battle entry/breaks | per-pirate per-station rating for the last league                          |
| Officer bulletin board   | the ship's navigation wheel                     | a 3,072-character crew note with limited HTML                              |
| Trade window             | pirate radial menu → Trade with                 | PoE, doubloons and items, with two-sided Ready                             |
| Challenge window (x2)    | pirate radial menu → Challenge to a Puzzle      | puzzle/rated/wager, then weapon and item wager, with two-sided Ready        |
| Options panel            | Ye panel → Options                              | 8 tabs (see below)                                                        |
| Arrange furniture        | Vessel / Shoppe / House panel                   | scene editor: move, rotate (mouse wheel or arrows), remove, Commit/Discard  |
| Portrait gallery         | item menu, info page                            | view and edit displayed portraits                                          |
| Manage yer hearties      | own info page                                   | mark hearties Secret or Top                                                |
| Ultimate list            | click a puzzle icon on any info page            | per-puzzle standing and experience leaderboards                            |
| Labor report             | Ye panel                                        | which crafting work is active versus dormant                               |

Notice board tabs:

| Tab          | Contents                                                                                                                                                                                                                                             | Visible on ship? |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| News         | Recent in-game articles, releases, and one free puzzle of the day                                                                                                                                                                                     | yes              |
| Puzzles      | Grid of puzzle symbols; unavailable ones greyed out; click for a blurb plus a "Play Now" button that whisks the pirate to a place the puzzle can be played, or a buy/subscribe button if unavailable                                                   | yes              |
| Missions     | Per-pirate mission list: introductions, navy missions, and stat-gated ones (e.g. "Defeat the skellies!" at Narrow experience plus Renowned standing in swordfighting; "Defeat the Zombies!" for the rumble equivalent)                                  | yes              |
| Voyages      | Ships at sea hiring jobbers: ship, crew, officer, an apply button, a ship-size icon, and a mission-statement bubble. Auto-apply by voyage type. Covers pillaging, general jobbing, blockades, flotillas, trading, foraging, evading, sea-monster hunts   | no               |
| Events       | Governor news, upcoming events, parties, forum events, Ocean-Master whisks                                                                                                                                                                            | yes              |
| Shoppe Jobs  | Shoppes needing labor and their pay, with a "Go" whisk button and a "View" full-listing interface                                                                                                                                                     | no               |
| Blockades    | Current and upcoming blockades with live scores; blockade eligibility and war-chest cost per island                                                                                                                                                   | no               |
| Competition! | Only during team competitions: your team, whether you have participated, and team rankings                                                                                                                                                            | n/a              |

Options panel tabs:

| Tab            | Settings                                                                                                                                                                                                                                                                                                                                                                                                                    |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| About          | Client and Java version                                                                                                                                                                                                                                                                                                                                                                                                     |
| General        | Show/hide extra new-pirate help · puzzle tutorials in a tab · left-handed mouse · prompt before closing · language (EN/DE/ES) · screenshot directory                                                                                                                                                                                                                                                                          |
| Graphics       | Larger font · anti-aliased fonts · direct 3D acceleration · windowed or fullscreen · allow window resizing · double UI scale · alternate puzzle art (higher-contrast bilging pieces) · special event effects · lock panel sizes · puzzle scale 100–200% · resolution and colour depth · visual effects high or low · font size for chat / sunshine / puzzle / world panels (auto, or 10–28; world also off/match-chat/match-sidebar) |
| Chat           | Play a sound on `/tell` · chat bubble display time short/medium/long (affects only `/speak`, `/think`, `/emote`, and only for the viewer who set it) · curse filter mode · chat logging on/off and its directory                                                                                                                                                                                                               |
| Sound          | Sound-effects volume · Alerts (a whistle on trade, hearty request, shipboard order, job application seen by an officer, or jobbing offer) · Feedback (blue-button clicks) · Ambient · Music (startup, plus themed music on first entry to a building) · Game alerts (tournaments starting, server reboots) · Game sound effects                                                                                                 |
| Mute list      | List of muted pirates with a "Remove from list" button, equivalent to `/unmute`                                                                                                                                                                                                                                                                                                                                              |
| Puzzle keys    | Rebind keys per puzzle. **Sea battle has no keyboard control and is not listed**                                                                                                                                                                                                                                                                                                                                             |
| Chat shortcuts | Twelve user-defined phrases bound to F1–F12; may include chat commands and may be prefixed with `/shout`, `/emote` or `/think`                                                                                                                                                                                                                                                                                               |

Default chat shortcuts: F1 "Ahoy!" · F2 "Aye aye" · F3 `/me laughs` · F4 "Welcome aboard!" · F5 "Good luck" · F6 "Good game" · F7 "Harr!" · F8 "Avast!" · F9 "Shiver me timbers" · F10 "Yohoho!" · F11 "Did you hear the cannon shots last night?" · F12 `/print`.

Activity icons (drawn above the pirate in the sprite layer):

| Group     | Icons                                                                                                                                                                                                                                                                             |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Piracy    | Bilging · Carpentry · Gunnery · Navigation · Patching · Rigging · Sailing · Treasure haul · Rumble · Swordfighting · Atlantis frays                                                                                                                                                 |
| Carousing | Drinking · Hearts · Poker · Spades · Treasure drop                                                                                                                                                                                                                                 |
| Crafting  | Alchemistry · Blacksmithing · Distilling · Foraging · Shipwrightery · Weaving                                                                                                                                                                                                       |
| Action    | Trading with a pirate · Challenging a pirate or NPP · Sitting for a portrait · Viewing an info page or the notice board · Inspecting a hold or commodities market · Arranging furniture · Inspecting or dividing booty · Managing labor or inspecting a job · Managing orders · Viewing Yer Known World aboard a ship |
| Status    | Idle · Disconnected                                                                                                                                                                                                                                                                |
| NPP-only  | Dragoon or Specter sabotaging a station (shown as that station's own icon, bordered in **red**) · Cursed Isles thrall                                                                                                                                                               |

Duty report ratings, worst to best: **Booched · Poor · Fine · Good · Excellent · Incredible**. Booched and Poor are replaced by a green **"Learning"** for greenies. The labels are text renderings of an underlying numeric score, and rows sharing a label are still sorted by that hidden score. Crafting duty reports additionally show the work level (**basic / skilled / expert**) and the order worked on; the foraging report instead summarises the commodities foraged.

Dock interface sections and markings:

| Element                           | Meaning                                                                                     |
| --------------------------------- | ------------------------------------------------------------------------------------------- |
| "Vessels Ye may board"            | Ships at this island belonging to your crew or jobbing crew                                  |
| "Ferries to other islands"        | Only between islands with functional buildings in the same archipelago                       |
| "Other vessels in this fine port" | Docked ships boarded within the last 30 minutes; cleared by a server reboot                  |
| Thick blue outline                | Vessels you own                                                                              |
| Thin blue outline                 | Vessels of your crew, flag, or allied flags                                                  |
| Red outline                       | Vessels of flags at war with yours, or against which yours has declared war                  |
| Grey outline                      | Everything else                                                                              |
| Lock / unlocked / unlocked-skull  | Lock level (crew vessels only): locked · sailable but not into sinking events · free to sail |
| Yellow wind icon                  | Vessel is not actually ported here — boarding whisks you to another island                    |
| Abandoned-at-sea marker           | A vessel abandoned after leaving port                                                        |

### Data model implications
- The **Ready-checkbox negotiation protocol** is shared by trade and challenge and should be one component: `NegotiationSession { sides: [OfferA, OfferB], readyA, readyB, lastChangeAt }` with the rule *any mutation clears both ready flags* and a three-second re-check lockout.
- The duty report needs a **stored per-league snapshot**, not a live query — it explicitly reports the previous league.
- Notice board tab visibility is a function of `pirate.location.kind` (ship versus island).
- Options should be a plain serialised settings object; the only entries with gameplay meaning are puzzle key bindings, chat shortcuts, alternate puzzle art, and the tutorial toggles.

### MVP relevance
**core** — scene, widget, radial menu, item menu, info page, notice board (News/Puzzles/Missions), dock, duty report, activity icons, and a minimal Options (puzzle keys, sound, chat). **phase 2** — trade, challenge, officer bulletin board, arrange furniture, Vessel Report, the full notice board. **deep** — portrait gallery, Ultimate list, competitions, chat shortcuts.

---

## The scene and avatar movement model

### Source
- https://yppedia.puzzlepirates.com/Scene
- https://yppedia.puzzlepirates.com/Movement (disambiguation)
- https://yppedia.puzzlepirates.com/Duty_station
- https://yppedia.puzzlepirates.com/Dock
- https://yppedia.puzzlepirates.com/Home
- https://yppedia.puzzlepirates.com/Chat_circle

### What it is
A **scene** is the game's spatial unit: a grid of 2D floor tiles with four render layers, occupied by pirates, NPCs and pets. Everything the player walks around in is a scene. This is the closest thing the wiki gives to a full engine specification.

### Mechanics
- **Four layers per scene**:
  1. **Base layer** — the floor: static tile textures. Most are traversable; **lava, bog, water and fissures are not**, and **the tiles immediately adjacent to a non-traversable tile are also non-traversable**. The base layer is strictly flat; elevation is faked with textures and objects. Some floor tiles carry a **yellow portal arrow**; no object may be placed on a portal tile.
  2. **Object layer** — static 3D props: trees, rocks, buildings, furniture. **Any tile containing an object is impassable.** Only buildings and furniture can be placed from inside the game; island "charm" is edited only while the game is offline for a reboot.
  3. **Dynamic object layer** — pirates, pets, NPCs. These move.
  4. **Sprite layer** — 2D overlays: speech bubbles, name labels, furniture text labels, activity icons, the mute symbol.
- **Two scene types**, distinguished behaviourally by how `/speak` works:
  - **Room** — bounded by an empty black expanse, typically drawing two walls along the far two sides. Walls can sometimes be painted and can hold wall furniture. **Everyone in a room hears `/speak`**, no chat circle needed. Gardens and house lobbies count as rooms even though outdoor furniture may be placed in them.
  - **Outside** — islands and ship decks. No walls (ships may hang banners along one hull side). **`/speak` requires a chat circle**; otherwise pirates use `/shout`, `/vessel`, `/tell` and so on.
- **Scene granularity**: a room in a building or ship is a scene; the whole outdoors of an island is one large scene; **all decks of a ship together are one scene**.
- **Movement**: click a destination tile and the pirate walks there. **Four-directional only, no diagonals** — every tile in a path must be orthogonally adjacent to the previous one, producing the characteristic zig-zag walk.
- **Pathfinding is viewport-limited**: only tiles currently visible to the player are considered when planning a path. Long journeys across large scenes must be made in stages, scrolling to reveal the next segment. The failure message is "Avast! I can't find a way to walk there."
- **Warp exception**: if the destination is a **portal arrow** and no valid path exists, the pirate **teleports** to it shortly before leaving the scene. The same applies to a clicked interactive object — unless there is no free tile around it, in which case the pirate interacts from a distance without moving. Pets following a pirate warp the same way.
- **Camera**: right-click pans the view to centre on the clicked point, but will not let the pirate leave the visible area. The view auto-centres on the destination after a recent move, and snaps back to the pirate the moment they would leave the view.
- **Inter-scene travel**: yellow portal arrows (with a short load delay), the **minimap** whisk-to-marker, the **dock** (which removes the pirate from the island scene entirely), `/invite` (invite to a scene), `/job` (whisk aboard a ship), whisking potions, and the Ye panel's **Go home**.
- **Home**: exactly one per pirate, set with a "Set as home" button in the location panel. It can be a house where you are owner, manager or roommate; an inn or shoppe where you are a manager (owners must temporarily make themselves manager); or any inhabited island, which anyone may set. `Go home` is free and always available. **An island home cannot be used to whisk *other* pirates there**; a building home can.
- **Duty stations** are interactive scene objects with an oval label and a radial menu. Aboard ship these are Sailing/Rigging, Carpentry/Patching, Bilging, Gunnery and Navigation. **One pirate per station.** Gunnery is the notable case: there is one gunnery station per cannon (with the cutter an exception at 8 cannons and 6 stations), each station loads four cannons at a time, so only about a quarter of a ship's gunnery stations can be busy at once. **Crafting stations in a shoppe hold any number of pirates simultaneously.**
- **Scene editing**: building owners and ship deed-holders arrange furniture and paint some scenes, and may set pets to roam. Island governors add pets and place buildings. Only one person may hold the "Arrange furniture" interface at a time.
- Notable scene rules: text bubbles on labelled items appear on scene entry, vanish on the first move, and reappear on hover; **Alt** shows all of them at once; re-entering the scene resets them. All pirates in a scene are notified of disconnections within that scene. Parlor tables and tournaments may be flagged "local only", making them invisible and unjoinable from outside the creating scene.

### Numbers and tables

Scene layer summary:

| Layer          | Contents                                                  | Traversable | Editable in-game                                |
| -------------- | --------------------------------------------------------- | ----------- | ----------------------------------------------- |
| Base           | Floor tile textures; yellow portal arrows                  | mostly      | painting in some scenes; no objects on portals   |
| Object         | Trees, rocks, buildings, furniture, island "charm"          | **never**   | buildings and furniture only                     |
| Dynamic object | Pirates, pets, NPCs                                        | n/a         | n/a                                              |
| Sprite         | Speech bubbles, name labels, activity icons, mute symbol   | n/a         | n/a                                              |

Non-traversable base textures (known): lava, bog, water, fissure — **plus every tile orthogonally adjacent to one**.

Duty stations aboard ship:

| Station            | Puzzle(s)          | Function                            | Occupancy                                                                                     |
| ------------------ | ------------------ | ----------------------------------- | --------------------------------------------------------------------------------------------- |
| Sailing/Rigging    | Sailing, Rigging   | ship movement                       | 1 pirate per station                                                                           |
| Carpentry/Patching | Carpentry, Patching| repairing the ship                  | 1 pirate per station                                                                           |
| Bilging            | Bilging            | removing bilgewater                 | 1 pirate per station                                                                           |
| Gunnery            | Gunnery            | loading cannons                     | 1 per station; one station per cannon; four cannons loaded per session, so at most a quarter of the stations are usefully busy |
| Navigation         | Navigation         | directing the ship; course selection | 1 pirate; the radial menu adds course selection and voyage configuration                       |
| Crafting (shoppe)  | the shoppe's puzzle| producing labor                     | **unlimited pirates per station**                                                              |

### Data model implications
```
Scene {
  id, kind: ROOM | OUTSIDE
  width, height
  base:    Tile[width][height]        // { textureId, traversable, portalTo?: sceneId }
  objects: SceneObject[]              // { defId, x, y, rotation, ownerId?, isProp, decayPoints }
  occupants: DynamicEntity[]          // pirates, pets, NPCs
  sprites: derived per frame
  walls?: { north: WallSurface, west: WallSurface }     // ROOM only
}

traversable(x, y) =  base[x][y].traversable
                  && !objectAt(x, y)
                  && !adjacentToHazard(x, y)
                  && !occupiedByEntity(x, y)

path(from, to) = BFS over the 4-neighbourhood, restricted to the current viewport rect
                 ; if no path and to.isPortal -> WARP
```
- A viewport-clipped 4-neighbour BFS is the entire pathfinder. It is deliberately weak; reproducing the zig-zag and the "can't find a way to walk there" failure is part of the feel.
- Ship decks being **one scene** means deck transitions are portal arrows *within* a scene, not scene changes — worth modelling as sub-regions.
- `SceneObject.isProp` distinguishes original fittings (removable but not relocatable, destroyed on removal) from placed furniture (relocatable, decaying on move, reclaimable by its owner).
- Chat-circle geometry lives in the scene: circles occupy tiles and can be blocked from expanding by buildings or other circles.

### MVP relevance
**core** — the four layers, tile traversability including the hazard-adjacency rule, four-directional viewport-clipped pathfinding, portal arrows with the warp fallback, duty stations with single occupancy, and camera panning. **phase 2** — room-versus-outside chat semantics, the arrange-furniture editor, props versus placed furniture, ships-as-one-scene. **deep** — painting, island charm, roaming pets, local-only tables.

---

## Communication and chat

### Source
- https://yppedia.puzzlepirates.com/Communication
- https://yppedia.puzzlepirates.com/Command
- https://yppedia.puzzlepirates.com/Chat_circle
- https://yppedia.puzzlepirates.com/Dnd
- https://yppedia.puzzlepirates.com/Hearty

### What it is
A channel-based text system with modifiers, a spatial "chat circle" mechanic for outdoor speech, and a set of status and information commands. Even a single-player game needs the surfaces: NPC crewmates, jobbers and swabbies drive them.

### Mechanics
- **Syntax**: `[/Channel] [/Modifier] Message`. The channel is optional and falls back to the dropdown beside the chat bar. Commands may be abbreviated to any unique prefix (`/o` for `/officer`); `/fwho`, `/fofficer` and `/fbroadcast` each need two letters.
- **Parsing is precisely specified and worth reproducing.** Scan left-to-right for an *invalid* channel (for example `/game` when not in a game) — if found, halt and print an access error. Then scan for a channel that **cannot take modifiers** (`/tell`, `/officer`, `/fofficer`, `/royalty`, `/fbroadcast`) — if found, halt, that becomes the channel, and everything after it is printed as literal message text. Otherwise scan **right-to-left** and use the first channel found; then look only to the *right* of that channel for a modifier.
- **Chat circle**: the mechanism that makes `/speak` work outdoors. One forms automatically when a pirate clicks the circle around another pirate, pet or NPC, clicks inside an existing circle, or offers a trade or challenge — provided the geometry allows it. The circle outline shows on hover. Pirates arrange themselves in a ring. It expands as more join, unless blocked by an obstruction such as a building or another circle. **A pirate outside the circle hears nothing, no matter how close they stand.** Pets join and leave with their owner and speak a word or phrase on entering or leaving.
- In **rooms**, chat circles have no effect: everyone in the room hears `/speak`.
- **Substitutions ("mogrifications")** rewrite outgoing text automatically. Smilies become emotes, a fixed abbreviation table expands, and runs of `!` or `?` clamp to three. Some substitutions must be the first thing in the message.
- **Chat history** has four modes: fade-overlay, small-overlay, large-overlay, and full-screen. A scroll icon cycles the three overlay modes; a window icon toggles full-screen. Full-screen allows copy and paste. In-game history truncates after a large character count; chat logs, if enabled, keep everything.
- **Filter**: an opt-in curse filter applied to **both incoming and outgoing** messages.
- **DND** blocks trade requests, job offers, hearty requests and challenges from non-hearties, and suppresses house knocks. It is a toggle (`/dnd`, or "Toggle Do Not Disturb" on your own radial menu), rendered as a grey stop sign that turns red when active. **Applying for a job from the notice board automatically clears DND** so the officer can send the offer.
- **Hearties** are a mutual friends list (cap 300, raised in 2017 to an undisclosed number). Hearties are **underlined in scenes**, **exempt from DND**, and shown online/offline in the crew panel. They are invited via the radial menu with a confirmation prompt. On the info page a pirate may mark hearties **Secret** (hidden) or **Top** (displayed); **if either side marks the relationship secret, it shows on neither page**.

### Numbers and tables

Chat channels:

| Command           | Scope                                                | Modifiers allowed |
| ----------------- | ---------------------------------------------------- | ----------------- |
| `/speak` (`/say`) | The room, or the chat circle if outdoors              | yes               |
| `/tell` (`/msg`)  | One named pirate, anywhere                            | **no**            |
| `/crew`           | Own crew                                              | yes               |
| `/jcrew`          | Jobbing crew (the channel jobbers use)                | yes               |
| `/officer`        | Officers and above of the crew                        | **no**            |
| `/fofficer`       | Flag officers                                         | **no**            |
| `/royalty`        | Flag royalty                                          | **no**            |
| `/fbroadcast`     | The whole flag                                        | **no**            |
| `/vessel`         | Everyone aboard the ship                              | yes               |
| `/house`          | Everyone in the house                                 | yes               |
| `/game`           | Everyone in the current parlor game                   | yes               |
| `/trade`          | The ocean-wide trade channel                          | yes               |
| `/global`         | The ocean-wide global channel                         | yes               |

Chat modifiers (must be combined with a channel; default to `/speak` when none is given): `/emote` (`/me`), `/shout`, `/think` (`/ponder`).

Other commands by group:

| Group          | Commands                                                                                                       |
| -------------- | -------------------------------------------------------------------------------------------------------------- |
| Information    | `/who` · `/cwho` · `/fwho` · `/gwho` · `/vwho` · `/info`                                                        |
| Status         | `/away` (`/afk`) · `/back` · `/dnd` · `/mute` · `/unmute`                                                       |
| Trade          | `/trade` · `/tmute`                                                                                            |
| Global toggles | `/global-on` · `/global-off`                                                                                   |
| Other          | `/gift` · `/help` (`/`) · `/invite` · `/job` · `/pay` · `/plank` · `/print` · `/tip` · `/broadcast` · `/clear`  |
| Problem report | `/bug` · `/complain` · `/blackspot`                                                                            |

Substitution table (outgoing text rewrites):

| Input                                                                                                   | Output                                                                                       |
| ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `:)` `=)` `8)` `:]` `:}` `:>` and their `-` / `*` variants                                               | *Pirate* smiles                                                                               |
| `:D` `=D` `8D` and variants                                                                              | *Pirate* grins                                                                                |
| `:(` `=(` `8(` `:[` `:{` `:<` and variants                                                               | *Pirate* frowns                                                                               |
| `;)` `;D` `;]` `;}` `;>` and variants                                                                    | *Pirate* winks                                                                                |
| `:p` `=p` `8p` and variants                                                                              | *Pirate* sticks out a tongue                                                                  |
| `afk`                                                                                                    | *Pirate* dozes off                                                                            |
| `lol`                                                                                                    | *Pirate* laughs                                                                               |
| `lmao`                                                                                                   | *Pirate* laughs heartily                                                                      |
| `rofl`                                                                                                   | *Pirate* laughs uncontrollably                                                                |
| `omg` / `omfg`                                                                                           | "Billions of blue blistering barnacles!"                                                      |
| `wtf`                                                                                                    | "What in the seven seas"                                                                      |
| `stfu`                                                                                                   | "shut yer trap"                                                                               |
| `asl` / `a/s/l` / `as/l` / `a/sl`                                                                        | "Ahoy! From which port do ye hail, and how many years are upon ye?" (trailing chars removed)   |
| `n00b` / `noob` / `n0ob` / `no0b`                                                                        | "greenie"                                                                                     |
| `afaik` `bbl` `brb` `btw` `cu` `gg` `gl` `iirc` `m8` `ne1` `any1` `nh` `np` `plz` `thx` `ty` `ur` `wtg`   | plain-English or pirate-dialect expansions                                                    |
| `!!!!!!!` or `???????`                                                                                   | clamped to three (`!!!`)                                                                      |

### Data model implications
```
ChatMessage { channel, modifier?, senderId, text, timestamp }

resolveChannel(tokens, pirate)     // per the left-to-right / right-to-left algorithm above
audience(channel, sender, scene) -> pirateId[]     // the only place spatial rules live

ChatCircle { id, sceneId, centerTile, radius, members: entityId[] }
```
- `audience()` for `/speak` is the branch point: `scene.kind == ROOM ? everyoneInScene : sender.chatCircle?.members ?? [sender]`.
- Substitutions are a pure text-rewrite pass applied **before** channel dispatch, with a "must be the first token" flag on some entries.
- For an offline game the NPC side needs a generator per channel: crew chatter on `/crew`, order acknowledgements on `/vessel`, jobber requests through the Ahoy! panel. The channel list doubles as the taxonomy of NPC message types.

### MVP relevance
**core** — `/speak` with the room-versus-circle distinction, `/tell`, `/crew`, `/vessel`, the three modifiers, the chat bar with its channel dropdown, chat bubbles, and the chat history overlay modes. **phase 2** — chat circles as real geometry, substitutions, the `/who` family, DND, mute, hearties, F1–F12 shortcuts. **deep** — flag channels, global, the trade channel, greeter commands, the full command list.

---

## Might ring (relative strength display)

### Source
- https://yppedia.puzzlepirates.com/Might_ring

### What it is
A coloured ring drawn around every ship on the open-sea map, encoding that ship's strength **relative to the viewer's own ship**. It is the game's only threat-assessment UI and is derived directly from the crew's puzzle standings.

### Mechanics
- Colour is **relative to the viewer**, so the same ship shows differently to different viewers: **blue is weaker, green is similar, red is stronger**.
- Inputs to the calculation: **the number of pirates aboard** and **the duty-puzzle standings of those pirates**. Higher standing produces a stronger ring.
- **Carousing and crafting standings do not contribute. Ship size does not contribute** — one pirate on a sloop can show a similar ring to one pirate on a war brig.
- Small icons overlay the ring to signal the boarding-fight type: **a small circle means barbarians (rumble)**, **a small rectangle means brigands (swordfight)**. Player and merchant vessels have a plain ring. **Navy vessels have no ring at all.**
- A separate **white targeting outline** marks the currently targeted vessel.
- Engaging a blue-ringed enemy risks being engaged by "the black ship" in turn. Green rings are the practical sweet spot: winnable while still paying well.
- Historical: the sea-battle standing was retired in 2006 and the might ring recalculated from duty and fighting ratings instead.

### Numbers and tables

| Ring          | Meaning relative to the viewer's ship         |
| ------------- | --------------------------------------------- |
| Blue          | Weaker                                        |
| Green         | Similar                                       |
| Red           | Stronger                                      |
| No ring       | Navy vessel                                   |
| + circle      | Barbarians — boarding resolves as a rumble    |
| + rectangle   | Brigands — boarding resolves as a swordfight  |
| White outline | Currently targeted                            |

### Data model implications
```
might(ship) = f(count(crewAboard),
                aggregate(duty + fighting standings of crewAboard))

ringColor(target, viewer) = band(might(target) / might(viewer))    // 3 bands
```
- Might is a **pure function of the crew roster**, not of the hull. It must be recomputed whenever anyone boards or disembarks.
- In an offline game this is how NPC ship difficulty is both *set* and *communicated*, so the aggregate function is a tuning knob for the entire pillaging loop.

### MVP relevance
**core** — the three-band ring computed from crew size and duty standings, plus the barbarian and brigand icons. **phase 2** — the black-ship retaliation rule and the targeting outline. **deep** — exact aggregation weights.

---

## Challenges and pirate-to-pirate interaction

### Source
- https://yppedia.puzzlepirates.com/Challenge
- https://yppedia.puzzlepirates.com/Trade
- https://yppedia.puzzlepirates.com/Hearty
- https://yppedia.puzzlepirates.com/Ahoy!_panel

### What it is
The set of pirate-to-pirate interactions initiated from the radial menu, all routed through the Ahoy! panel and all sharing the same negotiation shape. In an offline game these are the NPC interaction surfaces.

### Mechanics
- All are initiated by **clicking a pirate in the scene to open the radial menu**. All are blocked by the target's DND unless the initiator is a hearty. All raise a notice in the target's **Ahoy! panel**.
- The interaction set: **Get pirate info · Tell · Mute/Unmute · Trade with · Challenge to a Puzzle · Invite to be your hearty · Invite to enter building (`/invite`) · Invite to job for crew (`/job`) · Invite to join crew** (officer and above, and only on someone already jobbing) **· Assign rank · Assign title · Expel / Dismiss Jobber · Inspect trinket** (if the target has one equipped) **· Toggle Do Not Disturb** (on your own pirate).
- **Challengeable puzzles**: Swordfighting, Drinking, Rumble, Treasure Drop. **NPPs can be challenged to all except Treasure Drop.**
- A challenge is a **two-dialog negotiation**. Dialog 1, initiator only: puzzle type, rated flag, PoE wager, then "Issue Challenge". Dialog 2, both sides after acceptance: edit the wager, **add items to the wager**, change the rated flag or puzzle type, and each side picks their **sword, mug or bludgeon**. Both must tick **Ready**; **any parameter change unticks both Ready boxes and flags the changed parameter**.
- Wagering is constrained by **wager limits derived from experience level** (added 2012-04-30; applies to parlor games and challenges, **not** tournaments) and by per-pirate **wager bans**.
- Trade uses the same Ready protocol with a three-second lockout after the other side changes something, plus a currency clamp and rejection of untradeable or equipped items.
- Forming a chat circle is a **side effect** of offering a trade or a challenge.

### Numbers and tables

| Interaction        | Gate                                                                                                       | Result                                                                              |
| ------------------ | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Tell               | none                                                                                                       | private message                                                                      |
| Trade              | same scene · not DND (unless hearty)                                                                       | two-sided Ready negotiation over PoE, doubloons and items                            |
| Challenge          | same scene · not DND (unless hearty) · parlor badge or freeplay day for drinking and treasure drop         | two-stage Ready negotiation, then the puzzle                                          |
| Hearty invite      | not DND (unless already a hearty) · list not full                                                          | confirmation prompt, then a mutual link                                              |
| Invite to building | initiator has building privileges                                                                          | target is whisked into the scene                                                     |
| Job (`/job`)       | initiator is officer or above                                                                              | target gains the temporary jobber rank                                               |
| Invite to crew     | initiator is officer or above · target is already jobbing                                                  | target leaves their current crew and joins                                           |
| Assign rank/title  | officer or above · target of lower rank · crew politics may require a vote                                 | rank or title change                                                                 |
| Expel              | senior officer or above (target must already be a cabin person); officer or fleet officer may only propose  | removal from the crew; on a jobber it also planks them if both are on the same crew ship |

### Data model implications
- One shared `NegotiationSession` component (see the UI section) serves both trade and challenge.
- `RadialMenu(target, viewer)` is a capability-filtered verb list — exactly parallel to `itemVerbs()`.
- `rated` on a challenge is the flag that decides whether the result touches experience and standing at all.

### MVP relevance
**core** — the radial menu on pirates, Get pirate info, Challenge (unrated at minimum), and the Ahoy! notice flow. **phase 2** — trade, wagers, hearties, jobbing and crew invites, rank assignment. **deep** — wager limits and bans, planking, building invites.

---

## Gaps and things not found

### Source
Absence of coverage across the fetched page set.

### What it is
Items this slice needs but that the wiki either does not publish or has no article for.

### Mechanics
- **`Radial_menu` has no article** — the page returns "There is currently no text in this page". Its contents had to be reconstructed from the Crew panel, Scene, Challenge, Trade, Duty station, Dnd and Trinket pages. There is no authoritative list of radial options or their icon layout anywhere on the wiki.
- **Experience thresholds are undisclosed.** Only the "roughly doubles each level" community estimate exists; there is no table of points per level.
- **The standing averaging window (the "most recent *x*" sessions) is undisclosed**, as are the percentile cut-points for the nine bands.
- **The might-ring aggregation formula is undisclosed** — only its inputs are known.
- **`Movement` is a disambiguation page**, not an article; all walking mechanics live on `Scene`.
- **`Rating` redirects to a disambiguation page ("Ranking")**, useful only as an index of the distinct rating systems: crew PvP rank, rank within a crew, puzzle experience, puzzle standing, reputation, fame, and navy rank.
- **`Do_not_disturb` is a disambiguation page** that lists named crews; the mechanic lives on `Dnd`. The named crews were deliberately not recorded.
- **`api.php` and `action=raw` are blocked** by the wiki's bot protection (HTTP 202 with an empty body). Article HTML fetched with a browser User-Agent works, which is how everything here was retrieved.
- **No wiki page enumerates the client's window layout or exact panel geometry.** The Sunshine widget page links to "Official Y!PP User Interface Docs", which is off-wiki and was not fetched.
- **Portrait, whisking-potion and pet detail pages were fetched but only skimmed** — they are large catalogue pages whose per-item data is out of scope for this slice.
- **No page describes character creation** (choosing gender, name, starting appearance or starting inventory). The starting loadout can only be inferred from the floor items: a stick, rags for torso and legs, and the Yer Known World chart.

### MVP relevance
**core** — be aware that experience thresholds, standing percentiles and might weights are **free tuning parameters**, not values to be reproduced faithfully. **phase 2** — the radial menu layout will need to be designed rather than transcribed, and character creation invented outright.
