## Design system
Before any UI work, read DESIGN.md. Build only from its tokens (design-system/tokens.css, loaded via src/styles/index.css). Never hard-code a colour, font size, radius or shadow; if a value is missing, add a token to design-system/roles.json and rebuild. Check new screens in light and dark mode and at 390px. Do not name a component class after a Tailwind utility (e.g. `outline`).
