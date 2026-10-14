# T-33 real-device check

Run against the production URL (or the latest preview). Portrait first; item 5 also checks landscape. Record the device, OS, browser, date and who ran it.

| Device | OS / browser | Date | Tester | Result |
|---|---|---|---|---|
| iPhone SE | | | | |
| Mid-range Android | | | | |

## Checks (tick each, per device)

1. [ ] Pick a product, enter a price: the verdict card is pinned at the top while you scroll the inputs.
2. [ ] The disclaimer bar and the FX badge are both visible on `/` and `/compare`.
3. [ ] Every control can be tapped first time with a thumb (market pills, product-search result rows, platform select, checkboxes, Suggest, Apply, Copy link, the Compare link, and the "Back to simulator" link on `/compare`).
4. [ ] **Keyboard open:** tap Selling price so the on-screen keyboard opens. The field you are typing in stays visible, and you can still read the verdict.
   - Type the first digit of the selling price on a fresh product: the verdict card appears pinned above the field. Check the field you are typing in does not jump out of view or under the keyboard (iOS Safari has no scroll anchoring). If it does, report it — layout change is a human design decision.
   - If the field or verdict is not usable, report it. The fallback is to drop the verdict card to non-sticky below 400px of visual-viewport height. That is a design decision for a human; do not change it without approval. It needs JS (`visualViewport`), because CSS `max-height` media queries do not shrink when the iOS keyboard opens.
5. [ ] Rotate to landscape and back: nothing is cut off and the page does not scroll sideways.
6. [ ] Increase the system text size one step: nothing overlaps and the breakdown table stays a table.
7. [ ] Screen reader pass (VoiceOver on iPhone, TalkBack on Android): the market switch is announced as a pressed/not-pressed button, the product search announces the result count, the verdict is read out with its label (not just a colour).
8. [ ] Keyboard-only pass on a laptop (Tab, Shift+Tab, Enter, Space only): pick a product, set a price, switch market, open `/compare`, return. A focus ring is visible at every stop.

## When you are done

- Record the local `pnpm e2e --workers=1` passed/skipped counts in the PR description (the implementing agent provides them).
- After the table above is filled in, tick the two `PROJECT_SPEC.md` §11.4 boxes: "Keyboard-only pass through the whole flow" and the real-device box.

## Result

- [ ] T-33 passes on both devices
- Defects found:
