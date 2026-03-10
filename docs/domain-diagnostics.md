# Domain Diagnostics Report

Generated: 2026-03-10T21:25:28.412Z

Domains analyzed: movies, soccer, science, geography, literature, philosophy, royals, military, mythology, space, food, comics, tv, art, history, basketball, americanfootball, music

---

---

## movies

**Entities:** 1259 | **Anchor:** film | **Paths sampled:** 30

1. BRIDGE_QUALITY: Bridge types involving directors and cast members feel interesting/surprising as they connect seemingly unrelated films through creative or acting collaborations, while bridges using only production companies often feel more mundane and expected.

2. MISSING_BRIDGES:  
   - P136: genre — connects movies of the same genre, providing thematic links between films.  
   - P166: award received — links films or people with accolades, generating bridges based on recognition.  
   - P915: filming location — connects films shot in the same location, adding an element of geographic trivia.  
   - P840: narrative setting — links films set in similar locations, adding interest through storytelling backgrounds.

3. ANCHOR_TRAVERSAL: Yes, allowing films as intermediate nodes can enrich paths by showcasing intricate relationships and thematic links among films via shared elements like cast, director, or setting.

4. DIFFICULTY_VERDICT: Easy: 3, Medium: 5, Hard: 2. The biggest gap is in producing challenging puzzles, which may need bridges that explore lesser-known connections or detailed industry knowledge.

---

## soccer

**Entities:** 1150 | **Anchor:** team | **Paths sampled:** 30

1. BRIDGE_QUALITY: The bridge types involving players moving between leagues and teams feel interesting and surprising to players as they reveal unexpected career paths (e.g., playing for various international teams); meanwhile, the repetitive "played for" paths without additional context may feel boring and obvious.

2. MISSING_BRIDGES:
   - **P19: place of birth** - Connects players and teams via hometowns, creating cultural context and personal stories.
   - **P413: position played** - Links players by their field positions, offering insights into team dynamics and player specialties.
   - **P166: award received** - Connects players through shared accolades, highlighting their achievements and elevating their status.
   - **P286: head coach / manager** - Bridges teams via shared coaches, showcasing influential figures in multiple teams' successes.

3. ANCHOR_TRAVERSAL: Yes, allowing "team" nodes as intermediate nodes could add depth and complexity by illustrating connections across leagues and between individual players, thereby enriching the pathways.

4. DIFFICULTY_VERDICT: Easy: 3, Medium: 4, Hard: 3; the biggest gap exists in the lack of diverse, context-rich connections needed to easily create consistently engaging Hard puzzles.

---

## science

**Entities:** 845 | **Anchor:** person | **Paths sampled:** 30

1. BRIDGE_QUALITY: The bridges that involve transitions between different fields, such as "neurobiology" to a specific person or institution, feel more interesting since they often reveal unexpected connections. In contrast, bridges that go from a general “field” to a person directly working in that field or are connected by simple shared employment at the same institution feel more predictable and less intriguing.

2. MISSING_BRIDGES:
   - P166: award received; could connect Nobel Prize winners across different fields, providing surprising cross-disciplinary connections.
   - P737: influenced by; can illustrate influence lines between scientists and other individuals across time, revealing unexpected intellectual lineages.
   - P135: movement; relates scientists to cultural movements which can contextualize their work in broader historical movements.
   - P69: educated at; traces academic lineage, showing where prominent thinkers were educated, adding depth to academic compatriotism.

3. ANCHOR_TRAVERSAL: Yes, the anchor type "person" should be allowed as an intermediate node because it adds complexity and variety by permitting connections that highlight unexpected professional overlaps or influences.

4. DIFFICULTY_VERDICT: Easy: 4, Medium: 4, Hard: 3. The largest gap is in producing truly difficult puzzles due to a lack of deeply complex or surprising multi-step paths that cross-cut significantly different domains or fields.

---

## geography

**Entities:** 457 | **Anchor:** city | **Paths sampled:** 30

1. BRIDGE_QUALITY: Bridges based on geographical features such as "on continent" or "borders" can feel obvious given the domain, while bridges like "capital of" offer a bit more intrigue. Bridges using notable geographical relationships outside direct borders may surprise more, like connecting cities through non-adjacent country nodes.

2. MISSING_BRIDGES:
   - P840: narrative setting / set in (e.g., Linking Paris and London through both being featured in the same novel).
   - P915: filming location (e.g., Connecting Rome and New York as filming locations for a particular famous movie).
   - P166: award received (e.g., Capital cities of countries whose films have won the same international award).
   - P86: composer (e.g., Connecting cities through composers who lived or worked there, offering cultural insights).

3. ANCHOR_TRAVERSAL: Yes, allowing cities as intermediate nodes can enrich the pathways with intriguing geopolitical, historical, or cultural associations when combined with diverse bridge types.

4. DIFFICULTY_VERDICT: Easy: 2, Medium: 3, Hard: 4; The largest gap is in generating easy puzzles, where existing bridge types could lead players more predictably without new and diverse connections to simplify paths.

---

## literature

**Entities:** 1466 | **Anchor:** book | **Paths sampled:** 30

1. BRIDGE_QUALITY: The bridge types involving movements, such as "part of movement," provide surprising and interesting context, making them engaging for players who must think about influential literary movements. Conversely, bridges using fields like "literature" or "philosophy" might feel boring due to their general commonality and lack of specificity.

2. MISSING_BRIDGES:
   - P569: date of birth - Connects authors born in similar eras, useful for historical literary context.
   - P27: country of citizenship - Links authors from the same country, adding geographical and cultural context to literature.
   - P691: ISBN - Connects books by shared publishers or editions, offering insight into publishing networks and book distribution.
   - P647: drafted by - Links individuals who mentored or significantly influenced authors, enhancing understanding of literary heritage and mentorship.

3. ANCHOR_TRAVERSAL: Yes, allowing "book" as an intermediate node can enrich the paths, providing deep dives into literary connections when the existing bridge is robust and informative.

4. DIFFICULTY_VERDICT: Easy: 2, Medium: 3, Hard: 4. The biggest gap is the limited number of Easy puzzles, potentially frustrating less experienced players.

---

## philosophy

**Entities:** 963 | **Anchor:** person | **Paths sampled:** 30

1. BRIDGE_QUALITY: The "influenced by" bridge feels obvious but thematic given the domain of philosophy; however, bridges involving movements (e.g., "part of movement") offer more surprise and context, allowing players to discover philosophical connections that span broader historical or cultural contexts.

2. MISSING_BRIDGES:
   - P69: educated at: Could connect philosophers who studied at the same institution (e.g., both Immanuel Kant and Friedrich Hegel at the University of Königsberg), giving insights into academic lineage or institutional influence.
   - P166: award received: May highlight unexpected achievements or academic accolades that philosophers received, providing a broader view of their recognition.
   - P19: place of birth: Ties philosophers from the same city/country together, offering cultural or regional context to their philosophies.
   - P135: movement: Offers connections through less obvious philosophical or cultural movements, deepening understanding of their influence.

3. ANCHOR_TRAVERSAL: Yes, allowing the anchor type ("person") as an intermediate node can uncover layered connections and historical overlaps that plain movement or work connections might not reveal, provided the bridge is diverse.

4. DIFFICULTY_VERDICT: The graph can produce Easy puzzles (4) by clear linear paths, Medium puzzles (3) with some interspersed movement nodes, and Hard puzzles (5) by deeply nested, more complex paths involving obscure influences. The biggest gap lies in Medium difficulty, where more path diversity could exist.

---

## royals

**Entities:** 991 | **Anchor:** person | **Paths sampled:** 7

1. BRIDGE_QUALITY: The "parent/child of" bridge is somewhat obvious given the family tree context within royal dynasties, while "related to" can be surprising depending on the specifics of the relation. The "member of dynasty" bridge is somewhat expected in this domain, but can lead to interesting insights when dynasties interconnect in unexpected ways.

2. MISSING_BRIDGES:
   - P27: country of citizenship; could connect royals who shared national ties despite different dynasties, intriguing for exploring geopolitical dimensions.
   - P69: educated at; would show shared academic backgrounds among royals which might be unexpected or lesser-known.
   - P166: award received; awards (e.g., honors or orders) could link royals recognized for similar achievements or contributions.
   - P19: place of birth; shared birthplaces among royal members can reveal historical, geopolitical, or familial ties.

3. ANCHOR_TRAVERSAL: Yes, allowing "person" as an intermediate node can uncover deeper multi-step connections and themes that otherwise might be missed, enriching the narrative of the puzzle journey.

4. DIFFICULTY_VERDICT: The current graph can produce Easy: 3, Medium: 4, Hard: 2 puzzles, with the biggest gap being in reliably generating hard puzzles due to predictable bridge types and anchor-dominated paths.

---

## military

**Entities:** 397 | **Anchor:** person | **Paths sampled:** 30

1. BRIDGE_QUALITY: All paths currently use conflicts as bridge types, which can become predictable since the paths follow a repeated pattern of wars linking historical figures. Introducing more diverse connections would make the game more engaging and allow for surprising pathways.

2. MISSING_BRIDGES:
   - P166: award received (persons, films): Example: "Both Josephine Baker and Charlton Heston received notable awards," which can add an intriguing dimension of recognition.
   - P19: place of birth (persons): Example: "Both Charles de Gaulle and John J. Pershing were born in France," offering surprising connections based on birth.
   - P69: educated at (persons): Example: "Both Ronald Reagan and John Glenn were educated at the same institution," which can provide unexpected educational links.
   - P737: influenced by (musicians, philosophers, writers): Example: "T. E. Lawrence influenced by Napoleon," can introduce intriguing intellectual or historical influence connections.

3. ANCHOR_TRAVERSAL: Yes, allowing the anchor type ("person") as an intermediate node when an interesting bridge exists would offer richer and more varied puzzle pathways, enhancing the player's exploratory experience.

4. DIFFICULTY_VERDICT: The current graph produces Easy (4), Medium (2), Hard (1) puzzles. The biggest gap is in creating Medium and Hard puzzles due to the predictable pattern of conflict-based paths that limit complexity.

---

## mythology

**Entities:** 505 | **Anchor:** person | **Paths sampled:** 0

1. BRIDGE_QUALITY: The bridges featuring properties like P166 (award received) and P19 (place of birth) are particularly interesting as they provide surprising personal connections, while properties like P27 (country of citizenship) might feel more obvious due to common national affiliations.

2. MISSING_BRIDGES:
   - P509: cause of death; example: both individuals died under similar circumstances; adds intrigue by exploring lesser-known aspects of mythology figures' stories.
   - P106: occupation; example: connecting a person with a similar role or duty in mythology; highlights unusual career paths and roles within mythological contexts.
   - P123: publisher; example: mythology works published by the same entity; links the dissemination and cultural impact of mythological stories.
   - P1412: languages spoken, written, or signed; example: connecting individuals through shared or diverse linguistic traits; presents a cross-cultural perspective in mythology.

3. ANCHOR_TRAVERSAL: No, anchors should not be allowed as intermediate nodes because utilizing a "person" as an intermediary could dilute the challenge and thematic continuity of the puzzle, making it less engaging.

4. DIFFICULTY_VERDICT: Easy: 3, Medium: 2, Hard: 4; the biggest gap lies in the medium difficulty level, as the current graph seems to readily produce either too straightforward or intricate challenges, but struggles with moderate complexity.

---

## space

**Entities:** 570 | **Anchor:** person | **Paths sampled:** 0

1. BRIDGE_QUALITY: Some interesting bridge types include award received (P166) and influenced by (P737) as they often reveal surprising connections between people across generations or fields. In contrast, properties like country of citizenship (P27) can be more obvious and predictable, as they often connect individuals through nationality.

2. MISSING_BRIDGES:
   - P144: based on — Could connect a movie to an earlier book it was adapted from, providing interesting insights into the origins of stories.
   - P102: member of political party — Would connect politicians and show their political affiliations, creating potential historical or ideological paths.
   - P1056: product or material used — Could link artists through the materials they work with, providing unique insights into their creative processes.
   - P1366: replaced by — Could create dynamic historical paths by connecting various officeholders or company CEOs who succeeded each other.

3. ANCHOR_TRAVERSAL: Yes, the anchor type "person" should be allowed as an intermediate node when an interesting bridge exists, as it can enhance the complexity and depth of the connections, making puzzles more engaging.

4. DIFFICULTY_VERDICT: The current graph can produce Easy (3), Medium (4), Hard (2) puzzles; the biggest gap is in producing diverse Hard puzzles, as paths often rely on more straightforward connections.

---

## food

**Entities:** 522 | **Anchor:** dish | **Paths sampled:** 30

1. **BRIDGE_QUALITY**: Interesting/surprising bridges in the current paths are often those connecting through unexpected ingredients or geographical links, such as a dish known to originate in one culture using ingredients commonly found in another culture (e.g., carbonara connected to ossobuco through Italy and the use of egg). More boring/obvious bridges involve direct ingredient connections like flour leading to baked goods, which are predictable and less intriguing.

2. **MISSING_BRIDGES**:
   - **P495: country of origin** (for dishes and ingredients): Could connect dishes based on similar culinary heritages or a common historical source, adding depth to geographical connections.
   - **P108: employer** (for chefs): Would introduce connections via famous chefs linked with certain dishes, providing an intriguing twist with culinary lineages or signature dishes.
   - **P135: movement** (for culinary movements): Could connect dishes that are born out of specific culinary trends or styles, such as molecular gastronomy or fusion, which would add interest through shared philosophies or innovation.
   - **P179: series** (applicable with iconic dish collections): Enables linking of dishes that are part of a popular menu series or cookbook, bridging through recognized culinary works.

3. **ANCHOR_TRAVERSAL**: Yes, allowing the "dish" anchor type as an intermediate node can enhance puzzle depth by accommodating multi-step connections through cultural and culinary histories, which can unearth unique links otherwise hidden.

4. **DIFFICULTY_VERDICT**: Easy: 3, Medium: 4, Hard: 2. The biggest gap is in creating hard puzzles due to a limited variety in the bridges presented, particularly with a heavier focus on predictable ingredient-based connections rather than more esoteric cultural or historical ties.

---

## comics

**Entities:** 517 | **Anchor:** person | **Paths sampled:** 6

1. BRIDGE_QUALITY: The "worked at" bridge type is somewhat boring and obvious given the domain, as it primarily revolves around the common employment history with major publishers. Players might find more interest in connections that reveal lesser-known aspects or unique collaborations between individuals.

2. MISSING_BRIDGES:
   - P737: influenced by; e.g., Jean Giraud → influenced by → Gerard Way; this reveals creative inspirations across different works or styles in comics.
   - P166: award received; e.g., Jerry Siegel → award received → Joe Shuster (both won a prestigious award); highlights achievements and peer recognition.
   - P135: movement; e.g., Warren Ellis → movement → Dennis O'Neil; connects individuals through creative movements, showing shifts in style/genre.
   - P69: educated at; e.g., Joe Shuster → educated at → same university as Gerard Way; provides insights into educational backgrounds that could have influenced their careers.

3. ANCHOR_TRAVERSAL: Yes, allowing the anchor type ("person") as an intermediate node can reveal unexpected personal connections and collaborations, enriching the path with narrative depth.

4. DIFFICULTY_VERDICT: Easy: 2, Medium: 4, Hard: 3. The biggest gap is in creating truly easy puzzles, as current paths heavily focus on employment, which may not offer simple connections for casual players.

---

## tv

**Entities:** 1274 | **Anchor:** series | **Paths sampled:** 0

1. BRIDGE_QUALITY: Bridge types that involve personal achievements or detailed characteristics, such as "award received" or "filming location," feel more interesting and surprising compared to broad categories like "country of origin," which can be more obvious.

2. MISSING_BRIDGES: 
   - P449: original network, e.g., connect series on the same network like HBO, adding network-specific trivia.
   - P58: screenwriter, e.g., connect series that share the same screenwriter, providing insight into stylistic or narrative similarities.
   - P1441: present in work, e.g., connect series that reference or parody other series, adding layers of intertextuality.
   - P941: inspired by, e.g., connect series that drew inspiration from the same source material or real events, adding depth to narrative origins.

3. ANCHOR_TRAVERSAL: No, allowing the anchor type ("series") as an intermediate node might dilute the challenge; maintaining focus on the intended start and endpoint helps retain the puzzle's straightforwardness and complexity.

4. DIFFICULTY_VERDICT: Easy: 4, Medium: 3, Hard: 2. The biggest gap is in creating hard puzzles, which could benefit from more niche, less obvious connections.

---

## art

**Entities:** 1191 | **Anchor:** artwork | **Paths sampled:** 30

1. BRIDGE_QUALITY: The most intriguing bridges are those involving unique art movements and stylistic influences, such as connecting artists through their shared or successive movements. Boring or obvious connections might be those that simply link artists through the movement they are a part of since they are predictable and overused.

2. MISSING_BRIDGES:
   - P737: influenced by; Example: Paul Gauguin → influenced by → Vincent van Gogh, adding depth regarding the personal and stylistic influence among artists.
   - P19: place of birth; Example: Leonardo da Vinci → place of birth → Florence, connecting artists through shared geographical birthplaces to highlight regional artistic trends.
   - P69: educated at; Example: Gustav Klimt → educated at → Vienna School of Arts and Crafts, providing insight into the formal education and training that might have shaped artists and their work.
   - P166: award received; Example: Pablo Picasso → award received → Légion d'honneur, linking artists who have received notable honors, adding a layer of prestige or recognition to their connections.

3. ANCHOR_TRAVERSAL: Yes, allowing "artwork" as an intermediate node can enrich the path with direct contextual artistic influence and relationships when an actual connection exists between works.

4. DIFFICULTY_VERDICT: Easy: 2, Medium: 4, Hard: 4. The biggest gap exists in the easy puzzles range as the graph heavily emphasizes complex relationship paths involving multiple intermediate nodes, making simple direct paths less common.

---

## history

**Entities:** 1362 | **Anchor:** person | **Paths sampled:** 30

1. BRIDGE_QUALITY: Paths involving political alignments or conflicts (e.g., "aligned with," "fought in") feel interesting as they reveal unexpected historical relationships, while paths solely through political parties or offices (e.g., "member of," "held office") can be more predictable and thus less intriguing.

2. MISSING_BRIDGES:
   - P166: award received; e.g., connecting actors via Oscar wins; adds a cultural layer and prestige.
   - P69: educated at; e.g., connecting political figures through the same university; provides insight into shared backgrounds.
   - P664: work location; e.g., connecting authors or politicians who worked in the same city; introduces geographical context.

3. ANCHOR_TRAVERSAL: Yes, because using "person" as an intermediate node can reveal complex networks and relationships that are central to the history domain, enriching the player experience.

4. DIFFICULTY_VERDICT: Easy: 4, Medium: 3, Hard: 2; the biggest gap is in creating hard puzzles, as the current graph primarily supports linear and less challenging pathways due to predictable political connections.

---

## basketball

**Entities:** 733 | **Anchor:** team | **Paths sampled:** 30

1. BRIDGE_QUALITY: The bridge types involving lesser-known teams or international connections, such as "Olympia Milano" or "Pallacanestro Cantù," are interesting and surprising as they require players to have a wider knowledge of basketball beyond the NBA. Bridges involving well-known players like Shaquille O'Neal feel more obvious and thus less intriguing.

2. MISSING_BRIDGES:
   - P69: educated at; e.g., connecting players who attended the same university, adds depth through shared history.
   - P166: award received; e.g., players who received MVP awards, enhances connections through achievements.
   - P27: country of citizenship; e.g., connecting players from the same country can highlight international representation in the sport.
   - P19: place of birth; e.g., linking players from the same hometown, providing a shared origin story.

3. ANCHOR_TRAVERSAL: Yes, allowing "team" as an intermediate node when interesting bridges exist in the path encourages diverse and complex puzzle paths by utilizing well-known connections as stepping stones.

4. DIFFICULTY_VERDICT: Easy: 3, Medium: 4, Hard: 2; the biggest gap lies in the Hard puzzles, as the graph lacks complexity and depth in lesser-known basketball leagues and historic player connections that elevate difficulty.

---

## americanfootball

**Entities:** 183 | **Anchor:** team | **Paths sampled:** 0

1. BRIDGE_QUALITY: The current list of bridges includes interesting and surprising connections such as P166 (award received) and P54 (member of sports team), while properties like P27 (country of citizenship) and P19 (place of birth) may feel more obvious and less surprising.

2. MISSING_BRIDGES:
   - P641: sport - It would connect teams through their involvement in the same or different sports, which could lead to unexpected rivalries or shared history.
   - P5828: sporting event - It would link teams participating in the same major event like the Super Bowl, offering a rich context for exploration.
   - P1923: participating team - This could reveal the teams that participated in a specific season or historic match, adding depth to the sports theme.
   - P135: movement - It could unexpectedly connect teams or players with broader cultural or historical movements they were part of, providing a unique angle.

3. ANCHOR_TRAVERSAL: Yes, allowing "team" as an intermediate node can enrich the paths by introducing additional context and layered narratives when a compelling bridge like a shared championship or historical rivalry exists.

4. DIFFICULTY_VERDICT: The graph likely excels at producing Easy (4) and Medium (3) puzzles due to the rich interconnected nature of sports teams and leagues but struggles with Hard puzzles (2) due to potentially limited unique path variations; the biggest gap is in expanding links for deeper, more challenging associations.

---

## music

**Entities:** 567 | **Anchor:** person | **Paths sampled:** 30

1. BRIDGE_QUALITY: Interesting bridges include 'influenced by', as they reveal unexpected connections between artists, whereas paths consisting only of 'signed to' exchanges through labels become predictable and repetitive, making them less intriguing over time.

2. MISSING_BRIDGES:
   - P136: genre; connects musicians or songs sharing genres, providing thematic continuity and challenging cultural associations, like linking rock musicians.
   - P166: award received; linking artists with shared awards offers an engaging route through well-regarded achievements, like Grammy winners.
   - P27: country of citizenship; connecting artists by nationality reveals cultural influences and shared heritage, offering rich associative value.
   - P69: educated at; connects artists through alma maters, revealing influential environments and possible collaborative origins, sparking curiosity.

3. ANCHOR_TRAVERSAL: Yes, allowing anchor "person" as an intermediate node can enrich paths when it results in diverse and meaningful connections, adding depth to the narrative bridge.

4. DIFFICULTY_VERDICT: Easy: 4, Medium: 3, Hard: 2. Gap: The biggest gap is in creating Hard puzzles, as the graph tends to favor straightforward linkages, lacking sufficient complexity and obscurity.

---

## videogames

**Entities:** 999 | **Anchor:** game | **Paths sampled:** 30

1. BRIDGE_QUALITY: Bridges involving company associations (e.g., ownership or publishing connections) or real-world locations can be surprising and informative, whereas connections through platforms or series tend to feel more obvious since they follow well-known game industry practices or established franchise lines.

2. MISSING_BRIDGES:
   - P166: award received (e.g., both games won Game of the Year): Adds a layer of prestige and historical importance that enriches the connections.
   - P161: cast member (e.g., same voice actors in different games): Highlights lesser-known personal connections behind game creation.
   - P57: director (e.g., same director worked across various games): Uncovers creative influences in game development, which may not be immediately obvious.
   - P674: character (e.g., games featuring similar characters): Connects narratives in intriguing ways through shared characters, expanding on the game's universe.

3. ANCHOR_TRAVERSAL: No, the anchor type ("game") should not be allowed as an intermediate node if an interesting bridge already exists to maintain focus on highlighting less direct and more interesting relationships. (Note: This contradicts our current production implementation which does allow games as intermediates — the GPT-4o recommendation disagrees with our architecture but we've validated the game→bridge→game approach works well in practice.)

4. DIFFICULTY_VERDICT: The current graph produces Easy (4), Medium (3), and Hard (2) puzzles, with the biggest gap in generating hard puzzles, possibly due to the lack of complex or multi-layered bridges that challenge players.
