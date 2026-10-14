# T-33 real-device check

Run against the production URL (or the latest preview). Portrait only. Record the device, OS, browser, date and who ran it.

| Device | OS / browser | Date | Tester | Result |
|---|---|---|---|---|
| iPhone SE | | | | |
| Mid-range Android | | | | |

## Checks (tick each, per device)

1. [ ] Pick a product, enter a price: the verdict card is pinned at the top while you scroll the inputs.
2. [ ] The disclaimer bar and the FX badge are both visible on `/` and `/compare`.
3. [ ] Every control can be tapped first time with a thumb (market pills, platform select, checkboxes, Suggest, Apply, Copy link, Compare link).
4. [ ] **Keyboard open:** tap Selling price so the on-screen keyboard opens. The field you are typing in stays visible, and you can still read the verdict.
   - If it does not, report it. The fallback is to drop the verdict card to non-sticky below 400px of visual-viewport height. That is a design decision for a human; do not change it without approval.
5. [ ] Rotate to landscape and back: nothing is cut off and the page does not scroll sideways.
6. [ ] Increase the system text size one step: nothing overlaps and the breakdown table stays a table.
7. [ ] Screen reader pass (VoiceOver on iPhone, TalkBack on Android): the market switch is announced as a pressed/not-pressed button, the product search announces the result count, the verdict is read out with its label (not just a colour).
8. [ ] Keyboard-only pass on a laptop (Tab, Shift+Tab, Enter, Space only): pick a product, set a price, switch market, open `/compare`, return. A focus ring is visible at every stop.

## Result

- [ ] T-33 passes on both devices
- Defects found:
